import csv
import io
import re
import uuid
import os
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, Depends, Query, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from openai import OpenAI
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.chatbot import ChatRequest, ChatResponse, ChatMessageItem, ChatSessionItem
from app.services.document_service import search_rag_chunks, get_document_bytes, _upsert_document_metadata
from app.services.csv_sync_service import sync_schedule_input_csv
from app.services.r2_service import upload_bytes_to_r2
from app.models.document import Document
from app.models.employee import Employee
from app.models.chat_session import ChatSession
from app.models.chatbot_log import ChatbotLog
from app.routers.auth import ALGORITHM, get_employee_by_login_id
from app.services.token_service import log_token_usage


router = APIRouter(prefix="/api", tags=["chatbot"])
client = OpenAI(api_key=settings.OPENAI_API_KEY)

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

security_bearer = HTTPBearer(auto_error=False)


# ─── Auth Helper ─────────────────────────────────────────────────────────────

def get_optional_employee(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Optional[Employee]:
    """토큰이 있으면 검증하여 로그인 직원을 반환하고, 없으면 None을 반환하는 선택적 인증 Dependency"""
    if not credentials:
        return None
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        login_id: str = payload.get("sub")
        if login_id is None:
            return None
        return get_employee_by_login_id(db, login_id)
    except Exception:
        return None


# ─── Session Helpers ──────────────────────────────────────────────────────────

def _get_or_create_session(
    db: Session,
    session_id: Optional[str],
    emp_id: Optional[str],
    default_title: str
) -> str:
    """세션을 조회하거나 새로 생성합니다."""
    if not session_id:
        session_id = str(uuid.uuid4())
        
    title = default_title[:50] if default_title else "새로운 대화"
    
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not session:
        session = ChatSession(
            session_id=session_id,
            employee_id=emp_id,
            title=title,
            created_at=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        db.add(session)
        try:
            db.commit()
        except Exception:
            db.rollback()
            # 다른 프로세스에 의해 동시 생성되었는지 확인
            session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
            if not session:
                raise
    else:
        # 마지막 활동 시간 갱신
        session.last_activity = datetime.utcnow()
        # 원래 익명 세션이었는데 로그인한 사용자 ID가 전달되면 업데이트
        if emp_id and not session.employee_id:
            session.employee_id = emp_id
        try:
            db.commit()
        except Exception:
            db.rollback()
            
    return session_id


def _get_session_history(db: Session, session_id: str, limit: int = 10) -> list[dict]:
    """특정 세션의 대화 내역 중 최근 N턴을 가져와 list[dict] 포맷으로 반환합니다."""
    if not session_id:
        return []
    
    logs = (
        db.query(ChatbotLog)
        .filter(ChatbotLog.session_id == session_id)
        .order_by(ChatbotLog.created_at.desc())
        .limit(limit)
        .all()
    )
    # 시간 순(과거 -> 현재)으로 정렬하기 위해 리버싱
    logs.reverse()
    
    return [{"question": log.question, "answer": log.answer} for log in logs]


def _log_chatbot_interaction(
    db: Session,
    session_id: str,
    question: str,
    answer: str,
    source: str
):
    """Q&A 기록을 DB에 저장합니다."""
    log_entry = ChatbotLog(
        log_id=str(uuid.uuid4()),
        session_id=session_id,
        question=question,
        answer=answer,
        source=source,
        created_at=datetime.utcnow()
    )
    db.add(log_entry)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to save chatbot log: {e}")


def _build_context(chunks: list[dict]) -> str:
    """검색된 문서 청크들을 LLM 프롬프트용 컨텍스트 문자열로 변환"""
    lines: list[str] = []
    for idx, chunk in enumerate(chunks, start=1):
        lines.append(f"[{idx}] 문서: {chunk['file_name']}")
        lines.append(chunk["content"])
        lines.append("")
    return "\n".join(lines).strip()


def _answer_with_openai(db: Session, question: str, context: str, history: list[dict] = None) -> str:
    """OpenAI GPT-4o-mini를 사용해 문서 컨텍스트 기반 답변 생성 (대화 이력 포함)"""
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY가 설정되지 않았습니다.")

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    # 1. 시스템 프롬프트 준비
    messages = [
        {
            "role": "system",
            "content": (
                "당신은 제조 현장 도우미입니다. 반드시 제공된 문서 컨텍스트 안에서만 답변하세요. "
                "이전 대화 맥락(History)이 제공될 수 있으므로, 맥락이 이어지는 질문이라면 이전 대화를 참고하여 답변하세요. "
                "근거가 부족하면 모른다고 답하고 추가 문서를 요청하세요."
            ),
        }
    ]
    
    # 2. 대화 이력 추가
    if history:
        for turn in history:
            messages.append({"role": "user", "content": turn["question"]})
            messages.append({"role": "assistant", "content": turn["answer"]})
            
    # 3. 현재 질문 및 RAG 컨텍스트 추가
    messages.append({
        "role": "user",
        "content": f"질문:\n{question}\n\n참고 문서:\n{context}",
    })
    
    response = client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=messages,
        temperature=0.2,
    )
    
    # Log token usage
    usage = response.usage
    if usage:
        log_token_usage(
            db=db,
            feature="chatbot",
            model_name=settings.OPENAI_CHAT_MODEL,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            total_tokens=usage.total_tokens,
        )
        
    return response.choices[0].message.content or "답변을 생성하지 못했습니다."


# ─── API Endpoints ──────────────────────────────────────────────────────────

@router.post(
    "/chatbot",
    response_model=ChatResponse,
    summary="챗봇 메시지 처리 (RAG 기반)",
    description="사용자 질문 임베딩 후 pgvector에서 문서 청크를 검색해 답변을 생성합니다.",
)
async def chat(
    body: ChatRequest,
    k: int = Query(default=settings.RAG_TOP_K, ge=1, le=10),
    db: Session = Depends(get_db),
    current_emp: Optional[Employee] = Depends(get_optional_employee),
) -> ChatResponse:
    # 1. 세션 식별 및 생성
    emp_id = current_emp.emp_id if current_emp else None
    session_id = _get_or_create_session(db, body.session_id, emp_id, body.message)
    
    # 2. 대화 이력 조회 (최대 10개 턴)
    history = _get_session_history(db, session_id, limit=10)

    # 3. pgvector에서 문서 검색
    chunks = search_rag_chunks(db=db, query=body.message, top_k=k)
    if not chunks:
        reply = "관련 문서를 찾지 못했습니다. RAG 문서를 업로드하거나 동기화를 먼저 실행해 주세요."
        _log_chatbot_interaction(db, session_id, body.message, reply, "rag")
        return ChatResponse(
            reply=reply,
            source="rag",
            session_id=session_id,
        )

    context = _build_context(chunks)
    try:
        # OpenAI LLM으로 답변 생성
        reply = _answer_with_openai(db=db, question=body.message, context=context, history=history)
        _log_chatbot_interaction(db, session_id, body.message, reply, "rag")
        return ChatResponse(reply=reply, source="rag", session_id=session_id)
    except Exception:
        # LLM 오류 시 문서 발췌 반환 (폴백)
        snippet = context[:1200]
        reply = (
            "현재 LLM 응답 생성이 불가하여 검색된 문서 일부를 반환합니다.\n\n"
            f"{snippet}"
        )
        _log_chatbot_interaction(db, session_id, body.message, reply, "rag-fallback")
        return ChatResponse(
            reply=reply,
            source="rag-fallback",
            session_id=session_id,
        )


@router.post("/csv-edit", response_model=ChatResponse, summary="CSV 파일 수정 처리")
async def chat_csv_edit(
    message: str = Form(...),
    file: UploadFile = File(None),
    session_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_emp: Optional[Employee] = Depends(get_optional_employee),
) -> ChatResponse:
    """CSV 파일 수정 요청 처리 (대화 세션 및 이력 관리 포함)"""
    file_content = ""

    # 1. 세션 식별 및 생성
    emp_id = current_emp.emp_id if current_emp else None
    session_id = _get_or_create_session(db, session_id, emp_id, message)
    
    # 2. 대화 이력 조회 (최대 10개 턴)
    history = _get_session_history(db, session_id, limit=10)

    if file and file.filename:
        content = await file.read()
        ext = os.path.splitext(file.filename)[1].lower()

        if ext == ".csv":
            decoded = ""
            for encoding in ["utf-8-sig", "utf-8", "cp949", "euc-kr"]:
                try:
                    decoded = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            if not decoded:
                decoded = content.decode("cp949", errors="ignore")
            file_content = f"\n\n[첨부 CSV: {file.filename}]\n{decoded}"

    prompt = f"""사용자 요청: {message}
{file_content}

CSV 파일이 첨부되고 수정 요청이 있는 경우:
1. 수정된 전체 CSV 데이터를 반환해주세요 (모든 행 포함)
2. 응답 형식:
REPLY: (사용자에게 보여줄 메시지)
CSV:
(수정된 CSV 내용, 헤더 포함, 모든 행)
3. CSV 생성 시 주의사항:
   - 모든 행을 포함해야 함
   - 따옴표(")는 필요한 경우만 사용 (쉼표나 줄바꿈이 있는 필드만)
   - 원본 데이터 형식 유지

CSV 수정 요청이 없는 일반 질문은 그냥 답변해주세요."""

    # 3. GPT API 호출을 위한 메시지 리스트 구성
    messages = []
    if history:
        for turn in history:
            messages.append({"role": "user", "content": turn["question"]})
            messages.append({"role": "assistant", "content": turn["answer"]})
    
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.3,
    )

    # Log token usage
    usage = response.usage
    if usage:
        log_token_usage(
            db=db,
            feature="chatbot_csv_edit",
            model_name="gpt-4o-mini",
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            total_tokens=usage.total_tokens,
        )

    result = response.choices[0].message.content.strip()

    if "CSV:" in result and file and file.filename:
        parts = result.split("CSV:", 1)
        reply_text = parts[0].replace("REPLY:", "").strip()
        csv_data = parts[1].strip()

        filename = f"modified_{uuid.uuid4().hex[:8]}.csv"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        try:
            csv_reader = csv.reader(io.StringIO(csv_data))
            csv_lines = list(csv_reader)
            
            with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
                csv_writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
                csv_writer.writerows(csv_lines)
        except Exception:
            with open(filepath, "w", encoding="utf-8-sig") as f:
                f.write(csv_data)

        download_url = f"/api/download/{filename}"
        reply_text += f"\n\n📥 [수정된 파일 다운로드]({download_url})"
        
        _log_chatbot_interaction(db, session_id, message, reply_text, "gpt")
        return ChatResponse(reply=reply_text, source="gpt", session_id=session_id)

    _log_chatbot_interaction(db, session_id, message, result, "gpt")
    return ChatResponse(reply=result, source="gpt", session_id=session_id)


@router.get("/chatbot/history", response_model=List[ChatMessageItem], summary="채팅 세션 대화 기록 조회")
async def get_chatbot_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_emp: Optional[Employee] = Depends(get_optional_employee),
):
    """특정 세션의 대화 이력을 시간 순서대로 조회합니다."""
    logs = (
        db.query(ChatbotLog)
        .filter(ChatbotLog.session_id == session_id)
        .order_by(ChatbotLog.created_at.asc())
        .all()
    )
    return [
        ChatMessageItem(
            log_id=log.log_id,
            question=log.question,
            answer=log.answer,
            source=log.source,
            created_at=log.created_at
        )
        for log in logs
    ]


@router.get("/chatbot/sessions", response_model=List[ChatSessionItem], summary="채팅 세션 목록 조회")
async def get_chatbot_sessions(
    local_ids: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_emp: Optional[Employee] = Depends(get_optional_employee),
):
    """현재 로그인한 직원의 세션 목록 또는 전달된 로컬 세션 ID 목록에 해당하는 세션 목록을 반환합니다."""
    if current_emp:
        query = db.query(ChatSession).filter(ChatSession.employee_id == current_emp.emp_id)
    else:
        if not local_ids:
            return []
        id_list = [i.strip() for i in local_ids.split(",") if i.strip()]
        query = db.query(ChatSession).filter(ChatSession.session_id.in_(id_list))
        
    sessions = query.order_by(ChatSession.last_activity.desc()).all()
    
    result = []
    for s in sessions:
        count = db.query(ChatbotLog).filter(ChatbotLog.session_id == s.session_id).count()
        result.append(
            ChatSessionItem(
                session_id=s.session_id,
                title=s.title,
                created_at=s.created_at,
                last_activity=s.last_activity,
                count=count
            )
        )
    return result


@router.delete("/chatbot/session/{session_id}", summary="채팅 세션 삭제")
async def delete_chatbot_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_emp: Optional[Employee] = Depends(get_optional_employee),
):
    """특정 세션과 그에 속한 모든 대화 로그를 삭제합니다."""
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
    if session.employee_id and current_emp and session.employee_id != current_emp.emp_id:
        raise HTTPException(status_code=403, detail="본인의 세션만 삭제할 수 있습니다.")
        
    db.delete(session)
    db.commit()
    return {"status": "success", "session_id": session_id}


@router.get("/download/{filename}", summary="수정된 파일 다운로드")
def download_file(filename: str):
    """수정된 CSV 파일 다운로드"""
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(path=filepath, filename=filename, media_type="text/csv")

# ─── R2 문서 수정 (DB 조회 → R2 다운로드 → GPT 수정 → 버전 재업로드) ─────

CSV_FILENAME_PATTERN = re.compile(r'[\[「『]?([^\]」』\s]+\.csv)[\]」』]?', re.IGNORECASE)
CSV_ENCODINGS = ("utf-8-sig", "utf-8", "cp949", "euc-kr")
CSV_VERSION_SUFFIX_PATTERN = re.compile(r'_v0\.(\d+)$')


def _extract_csv_file_name(message: str, db: Session) -> Optional[str]:
    """메시지에서 .csv 파일명을 추출 (대괄호/낫표로 감싸진 경우도 인식).
    ".csv" 확장자가 없으면 '~에서' 앞부분을 후보로 DB documents에서 가장 근접한 파일명을 찾는다."""
    match = CSV_FILENAME_PATTERN.search(message)
    if match:
        return match.group(1)

    if "에서" not in message:
        return None

    candidate = message.split("에서", 1)[0].strip(" \t[]「」『』'\"")
    if not candidate:
        return None

    return db.execute(
        select(Document.file_name)
        .where(Document.file_name.startswith(candidate))
        .order_by(func.length(Document.file_name))
    ).scalars().first()


def _decode_csv_bytes(data: bytes) -> Optional[str]:
    """여러 인코딩을 순서대로 시도하여 CSV 바이트를 텍스트로 디코딩"""
    for encoding in CSV_ENCODINGS:
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return None


def _edit_csv_with_gpt(db: Session, message: str, file_name: str, csv_text: str) -> tuple[str, Optional[str]]:
    """GPT-4o-mini에게 CSV 수정을 요청하고 (응답 메시지, 수정된 CSV) 튜플을 반환. CSV 수정이 아니면 csv는 None."""
    prompt = f"""사용자 요청: {message}

[파일: {file_name}]
{csv_text}

위 CSV 파일을 사용자 요청에 맞게 수정해주세요.

규칙:
- 미완료/미이수로 변경 시 해당 교육의 이수일 컬럼과 만료일 컬럼만 빈 값("")으로 변경, 다른 교육 컬럼은 절대 건드리지 말 것
- 예시: "교육1 미이수"면 "교육1 이수일", "교육1 만료일"만 비우고 교육2~5는 그대로 유지
- 헤더 행은 절대 변경하지 말 것
- 수정 대상 행 외 나머지 행도 절대 변경하지 말 것
- 장비 데이터 수정 시 변경 요청한 컬럼만 수정하고 나머지 컬럼은 절대 건드리지 말 것
- 장비 컬럼 목록: 장비ID, 장비명, 장비기호, 장비 전체, 가용 장비, 점검 주기, 다음 점검일, 최근 점검일, 적용제품군장비 휴식, 내구도, 장비휴식시간(분)
- 날짜 형식은 항상 YYYY-MM-DD 유지
- 숫자 컬럼은 숫자만 입력 (단위 텍스트 제외, 예: "30일" → "30")
- 수정 대상 행 외 나머지 행은 절대 변경하지 말 것
- 세미콜론(;)으로 구분된 컬럼값은 그대로 유지
- 작업 데이터 수정 시 변경 요청한 컬럼만 수정하고 나머지 컬럼은 절대 건드리지 말 것
- 작업 컬럼 목록: 작업ID, 작업명, 작업구분, 작업단계, 사용공장동, 필요장비, 작업시간_분, 적용제품군
- 작업구분은 "공정" 또는 "테스트"만 허용
- 필요장비는 세미콜론(;)으로 구분된 형식 유지 (예: 장비1;장비4)
- 작업시간_분은 숫자만 입력
- 수정 대상 행 외 나머지 행은 절대 변경하지 말 것

응답 형식:
REPLY: (사용자에게 보여줄 메시지)
CSV:
(수정된 CSV 내용)"""

    response = client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    usage = response.usage
    if usage:
        log_token_usage(
            db=db,
            feature="chatbot_edit_r2_document",
            model_name=settings.OPENAI_CHAT_MODEL,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            total_tokens=usage.total_tokens,
        )

    result = response.choices[0].message.content.strip()
    result = result.replace("```csv", "").replace("```", "").strip()

    if "CSV:" not in result:
        return result, None

    reply_part, csv_part = result.split("CSV:", 1)
    return reply_part.replace("REPLY:", "").strip(), csv_part.strip()


def _normalize_csv_text(csv_text: str) -> str:
    """GPT가 반환한 CSV를 csv 모듈로 재파싱/재작성하여 따옴표·개행을 표준화"""
    try:
        rows = list(csv.reader(io.StringIO(csv_text)))
    except csv.Error:
        return csv_text

    buffer = io.StringIO()
    csv.writer(buffer, quoting=csv.QUOTE_MINIMAL, lineterminator="\n").writerows(rows)
    return buffer.getvalue()


def _next_version_file_name(db: Session, base_name: str, ext: str) -> str:
    """기존 버전 중 최대 버전 번호 + 1로 새 버전 파일명 생성 (예: base_v0.3.csv)"""
    # 기존 파일명에 이미 버전 접미사(_v0.x)가 있다면 제거하여 원본 베이스명을 획득합니다.
    match = CSV_VERSION_SUFFIX_PATTERN.search(base_name)
    if match:
        base_name = CSV_VERSION_SUFFIX_PATTERN.sub("", base_name)

    existing_names = db.execute(
        select(Document.file_name).where(Document.file_name.startswith(f"{base_name}_v"))
    ).scalars().all()

    max_version = 0
    for name in existing_names:
        stem = name.rsplit(".", 1)[0]
        suffix = stem[len(base_name):]
        match_ver = CSV_VERSION_SUFFIX_PATTERN.search(suffix)
        if match_ver:
            max_version = max(max_version, int(match_ver.group(1)))

    return f"{base_name}_v0.{max_version + 1}.{ext}"


@router.post("/chatbot/edit-r2-document", response_model=ChatResponse, summary="R2 문서 수정")
async def edit_r2_document(
    message: str = Form(...),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """
    DB에서 파일명으로 문서 찾기 → R2 다운로드 → GPT 수정 → 버전 이름으로 R2 재업로드
    예시: "직원안전교육.csv에서 정우진 교육1을 미완료로 바꿔줘"
    """
    # 1. 메시지에서 파일명 추출
    file_name = _extract_csv_file_name(message, db)
    if not file_name:
        return ChatResponse(
            reply="파일명을 찾을 수 없습니다. 예시: '직원안전교육.csv에서 정우진 교육1을 미완료로 바꿔줘'",
            source="gpt",
        )

    # 2. DB에서 파일 찾기
    doc = db.execute(select(Document).where(Document.file_name == file_name)).scalars().first()
    if not doc:
        return ChatResponse(reply=f"'{file_name}' 파일을 DB에서 찾을 수 없습니다. 파일명을 정확히 입력해주세요.", source="gpt")

    # 3. R2에서 파일 다운로드
    try:
        _, file_bytes = get_document_bytes(db=db, file_id=doc.file_id)
    except Exception as e:
        return ChatResponse(reply=f"R2에서 파일을 가져오는 중 오류가 발생했습니다: {e}", source="gpt")

    # 4. CSV 디코딩
    decoded = _decode_csv_bytes(file_bytes)
    if decoded is None:
        return ChatResponse(reply="CSV 파일 인코딩을 인식할 수 없습니다.", source="gpt")

    # 5. GPT에 수정 요청
    try:
        gpt_reply, csv_data = _edit_csv_with_gpt(db=db, message=message, file_name=file_name, csv_text=decoded)
    except Exception as e:
        return ChatResponse(reply=f"GPT 응답 생성 중 오류가 발생했습니다: {e}", source="gpt")

    if csv_data is None:
        # CSV 수정이 필요 없는 일반 답변
        return ChatResponse(reply=gpt_reply, source="gpt")

    # 변경 내용 설명 없이 완료 메시지만 응답 (다운로드 버튼으로 결과 확인)
    reply_text = "수정이 완료되었습니다."

    # 6. CSV 형식 표준화 + 버전 이름 생성 (예: 직원안전교육_v0.1.csv)
    normalized_csv = _normalize_csv_text(csv_data)
    base_name, ext = file_name.rsplit(".", 1)
    new_file_name = _next_version_file_name(db, base_name, ext)

    # 7. R2 경로 설정 (원본과 같은 폴더)
    original_prefix = doc.file_path.rsplit("/", 1)[0] + "/" if "/" in doc.file_path else ""
    new_r2_key = f"{original_prefix}{new_file_name}"
    new_bytes = normalized_csv.encode("utf-8-sig")

    # 8. R2에 업로드
    try:
        upload_bytes_to_r2(data=new_bytes, r2_key=new_r2_key, content_type="text/csv")
    except Exception as e:
        return ChatResponse(reply=f"R2 업로드 중 오류가 발생했습니다: {e}", source="gpt")

    # 9. DB에 새 문서 메타데이터 저장 (+ 안전교육 CSV면 관련 테이블도 동기화)
    try:
        new_doc, _ = _upsert_document_metadata(
            db,
            uploader=doc.uploader,
            file_name=new_file_name,
            file_size=len(new_bytes),
            file_extension=ext,
            file_path=new_r2_key,
            file_updated_at=datetime.utcnow(),
        )

        if "안전교육" in file_name or "safety" in file_name.lower():
            try:
                sync_schedule_input_csv(db=db, file_name=new_file_name, file_bytes=new_bytes)
                reply_text += "\n✅ 안전교육 DB도 업데이트되었습니다."
            except Exception as e:
                reply_text += f"\n⚠️ 안전교육 DB 업데이트 실패: {e}"

        db.commit()
        db.refresh(new_doc)
    except Exception as e:
        db.rollback()
        return ChatResponse(reply=f"DB 저장 중 오류가 발생했습니다: {e}", source="gpt")

    # 10. 다운로드 링크 반환
    reply_text += f"\n\n📥 DOWNLOAD:{new_doc.file_id}:{new_file_name}"
    return ChatResponse(reply=reply_text, source="gpt")

# ─── Text-to-SQL 엔드포인트 ──────────────────────────────────
DB_SCHEMA = """
테이블 목록 및 스키마:

1. employees (직원)
   - emp_id: 직원ID (PK)
   - login_id: 로그인ID
   - emp_name: 이름
   - emp_role: 역할 (leader/member)
   - emp_date: 입사일

2. safety_training (안전교육)
   - training_id: 교육ID (PK)
   - emp_id: 직원ID (FK -> employees)
   - training_name: 교육명
   - training_date: 이수일
   - expired_date: 만료일
   - training_status: 상태 (completed 등)

3. equipments (장비)
   - eq_id: 장비ID (PK)
   - eq_name: 장비명
   - eq_count: 전체수량
   - available_eq_count: 사용가능수량
   - check_cycle: 점검주기(일)
   - eq_status: 상태
   - check_date: 다음점검일
   - recent_check_date: 최근점검일

4. orders (주문)
   - order_id: 주문ID (PK)
   - order_num: 주문번호
   - product_name: 제품명
   - order_count: 수량
   - due_date: 납기일
   - order_status: 상태

5. schedules (일정)
   - id: 일정ID (PK)
   - task_id: 작업ID
   - order_id: 주문ID
   - start_date: 시작일
   - end_date: 종료일
   - factory: 공장
"""

@router.post("/chatbot/text-to-sql", response_model=ChatResponse, summary="Text-to-SQL 기반 데이터 조회")
async def text_to_sql(
    body: ChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    from sqlalchemy import text as sql_text

    # 1. LLM에게 SQL 생성 요청
    sql_prompt = f"""당신은 PostgreSQL 전문가입니다. 아래 DB 스키마를 보고 사용자 질문에 맞는 SQL 쿼리를 생성해주세요.

{DB_SCHEMA}

사용자 질문: {body.message}

규칙:
- SELECT 쿼리만 생성 (INSERT/UPDATE/DELETE 금지)
- 결과는 SQL 쿼리만 반환 (설명 없이)
- 코드블록(```) 없이 순수 SQL만
- employees 테이블 join 시 emp_name 컬럼 사용
- 한국어 이름으로 검색할 때는 employees.emp_name 사용"""

    sql_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": sql_prompt}],
        temperature=0,
    )

    generated_sql = sql_response.choices[0].message.content.strip()
    generated_sql = generated_sql.replace("```sql", "").replace("```", "").strip()

    # 2. SQL 실행
    try:
        result = db.execute(sql_text(generated_sql))
        rows = result.fetchall()
        columns = result.keys()
        
        if not rows:
            data_str = "조회 결과가 없습니다."
        else:
            header = " | ".join(columns)
            data_rows = [" | ".join(str(v) for v in row) for row in rows]
            data_str = header + "\n" + "\n".join(data_rows)
    except Exception as e:
        return ChatResponse(reply=f"SQL 실행 오류: {e}\n\n생성된 SQL: {generated_sql}", source="sql")

    # 3. 결과를 LLM에 줘서 자연어 답변 생성
    answer_prompt = f"""사용자 질문: {body.message}

조회 결과:
{data_str}

위 데이터를 바탕으로 사용자 질문에 친절하게 한국어로 답변해주세요."""

    answer_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": answer_prompt}],
        temperature=0.3,
    )

    reply = answer_response.choices[0].message.content.strip()
    return ChatResponse(reply=reply, source="sql")