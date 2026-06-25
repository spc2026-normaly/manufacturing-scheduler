import csv
import io
import uuid
import os
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, Depends, Query, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas.chatbot import ChatRequest, ChatResponse, ChatMessageItem, ChatSessionItem
from app.services.document_service import search_rag_chunks
from app.models.employee import Employee
from app.models.chat_session import ChatSession
from app.models.chatbot_log import ChatbotLog
from app.routers.auth import ALGORITHM, get_employee_by_login_id

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


def _answer_with_openai(question: str, context: str, history: list[dict] = None) -> str:
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
        reply = _answer_with_openai(question=body.message, context=context, history=history)
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

# ─── DB 문서 찾아서 R2에서 수정 후 재업로드 ──────────────────
@router.post("/chatbot/edit-r2-document", response_model=ChatResponse, summary="R2 문서 수정")
async def edit_r2_document(
    message: str = Form(...),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """
    DB에서 파일명으로 문서 찾기 → R2 다운로드 → GPT 수정 → 버전 이름으로 R2 재업로드
    예시: "직원안전교육.csv에서 정우진 교육1을 미완료로 바꿔줘"
    """
    from app.models.document import Document
    from app.services.r2_service import upload_bytes_to_r2
    from app.services.document_service import get_document_bytes, _upsert_document_metadata
    from app.services.csv_sync_service import sync_schedule_input_csv
    from sqlalchemy import select
    import re

    # 1. 메시지에서 파일명 추출 (따옴표 또는 .csv 확장자로 감지)
    file_name_match = re.search(r'[\[「『]?([^\]」』\s]+\.csv)[\]」』]?', message, re.IGNORECASE)
    if not file_name_match:
        return ChatResponse(reply="파일명을 찾을 수 없습니다. 예시: '직원안전교육.csv에서 정우진 교육1을 미완료로 바꿔줘'", source="gpt")

    file_name = file_name_match.group(1)

    # 2. DB에서 파일 찾기
    doc = db.execute(select(Document).where(Document.file_name == file_name)).scalar_one_or_none()
    if not doc:
        return ChatResponse(reply=f"'{file_name}' 파일을 DB에서 찾을 수 없습니다. 파일명을 정확히 입력해주세요.", source="gpt")

    # 3. R2에서 파일 다운로드
    try:
        _, file_bytes = get_document_bytes(db=db, file_id=doc.file_id)
    except Exception as e:
        return ChatResponse(reply=f"R2에서 파일을 가져오는 중 오류가 발생했습니다: {e}", source="gpt")

    # 4. CSV 디코딩
    decoded = ""
    for encoding in ["utf-8-sig", "utf-8", "cp949", "euc-kr"]:
        try:
            decoded = file_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if not decoded:
        return ChatResponse(reply="CSV 파일 인코딩을 인식할 수 없습니다.", source="gpt")

    # 5. GPT에 수정 요청
    prompt = f"""사용자 요청: {message}

[파일: {file_name}]
{decoded}

위 CSV 파일을 사용자 요청에 맞게 수정해주세요.
응답 형식:
REPLY: (사용자에게 보여줄 메시지)
CSV:
(수정된 CSV 내용, 헤더 포함, 모든 행)

CSV 생성 시 주의사항:
- 미완료로 변경 시 해당 교육의 이수일, 만료일 컬럼 둘 다 빈 값("")으로 변경
- 모든 행을 포함해야 함
- 원본 데이터 형식 유지
- JSON이나 코드블록 없이 순수 CSV만 반환"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    result = response.choices[0].message.content.strip()
    result = result.replace("```csv", "").replace("```", "").strip()

    if "CSV:" not in result:
        return ChatResponse(reply=result, source="gpt")

    parts = result.split("CSV:", 1)
    reply_text = parts[0].replace("REPLY:", "").strip()
    csv_data = parts[1].strip()

    # 6. 버전 이름 생성 (예: 직원안전교육_v0.1.csv)
    base_name = file_name.rsplit(".", 1)[0]
    ext = file_name.rsplit(".", 1)[1]

    # 기존 버전 찾기
    existing_versions = db.execute(
        select(Document).where(Document.file_name.like(f"{base_name}_v%"))
    ).scalars().all()

    version_num = len(existing_versions) + 1
    new_file_name = f"{base_name}_v0.{version_num}.{ext}"

    # 7. R2 경로 설정 (원본과 같은 폴더)
    original_prefix = "/".join(doc.file_path.split("/")[:-1]) + "/"
    new_r2_key = f"{original_prefix}{new_file_name}"

    # 8. 수정된 CSV를 바이트로 변환
    new_bytes = csv_data.encode("utf-8-sig")

    # 9. R2에 업로드
    try:
        upload_bytes_to_r2(data=new_bytes, r2_key=new_r2_key, content_type="text/csv")
    except Exception as e:
        return ChatResponse(reply=f"R2 업로드 중 오류가 발생했습니다: {e}", source="gpt")

    # 10. DB에 새 문서 메타데이터 저장
    from datetime import datetime
    new_doc, _ = _upsert_document_metadata(
        db,
        uploader=doc.uploader,
        file_name=new_file_name,
        file_size=len(new_bytes),
        file_extension=ext,
        file_path=new_r2_key,
        file_updated_at=datetime.utcnow(),
    )

    # 11. 안전교육 CSV면 DB도 업데이트
    if "안전교육" in file_name or "safety" in file_name.lower():
        try:
            sync_result = sync_schedule_input_csv(
                db=db, file_name=new_file_name, file_bytes=new_bytes
            )
            reply_text += f"\n✅ 안전교육 DB도 업데이트되었습니다."
        except Exception as e:
            reply_text += f"\n⚠️ 안전교육 DB 업데이트 실패: {e}"

    db.commit()

    # 12. 다운로드 링크 반환
    reply_text += f"\n\n📥 DOWNLOAD:{new_doc.file_id}:{new_file_name}"

    return ChatResponse(reply=reply_text, source="gpt")