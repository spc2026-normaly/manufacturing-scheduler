import csv
import io
import uuid
import os
from fastapi import APIRouter, UploadFile, File, Form, Depends, Query
from fastapi.responses import FileResponse
from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas.chatbot import ChatRequest, ChatResponse, ChatResponse
from app.services.document_service import search_rag_chunks

router = APIRouter(prefix="/api", tags=["chatbot"])
client = OpenAI(api_key=settings.OPENAI_API_KEY)

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _build_context(chunks: list[dict]) -> str:
    """검색된 문서 청크들을 LLM 프롬프트용 컨텍스트 문자열로 변환"""
    lines: list[str] = []
    for idx, chunk in enumerate(chunks, start=1):
        # 출처 명시 (문서 추적용)
        lines.append(f"[{idx}] 문서: {chunk['file_name']}")
        lines.append(chunk["content"])
        lines.append("")
    return "\n".join(lines).strip()


def _answer_with_openai(question: str, context: str) -> str:
    """OpenAI GPT-4o-mini를 사용해 문서 컨텍스트 기반 답변 생성"""
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY가 설정되지 않았습니다.")

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    # RAG 프롬프트: 시스템 메시지로 답변 범위 제한
    response = client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "당신은 제조 현장 도우미입니다. 반드시 제공된 문서 컨텍스트 안에서만 답변하세요. "
                    "근거가 부족하면 모른다고 답하고 추가 문서를 요청하세요."
                ),
            },
            {
                "role": "user",
                "content": f"질문:\n{question}\n\n참고 문서:\n{context}",
            },
        ],
        # 낮은 temperature: 창의성보다 정확성 우선
        temperature=0.2,
    )
    return response.choices[0].message.content or "답변을 생성하지 못했습니다."


@router.post(
    "/chatbot",
    response_model=ChatResponse,
    summary="챗봇 메시지 처리 (RAG 기반)",
    description="사용자 질문 임베딩 후 pgvector에서 문서 청크를 검색해 답변을 생성합니다.",
)
async def chat(
    body: ChatRequest,
    # RAG_TOP_K: 검색할 상위 N개 문서 청크
    k: int = Query(default=settings.RAG_TOP_K, ge=1, le=10),
    db: Session = Depends(get_db),
) -> ChatResponse:
    # pgvector에서 코사인 유사도 기반 문서 검색
    chunks = search_rag_chunks(db=db, query=body.message, top_k=k)
    if not chunks:
        # RAG 문서가 없으면 사용자에게 안내
        return ChatResponse(
            reply="관련 문서를 찾지 못했습니다. RAG 문서를 업로드하거나 동기화를 먼저 실행해 주세요.",
            source="rag",
        )

    context = _build_context(chunks)
    try:
        # OpenAI LLM으로 답변 생성
        reply = _answer_with_openai(question=body.message, context=context)
        return ChatResponse(reply=reply, source="rag")
    except Exception:
        # LLM 오류 시 문서 발췌 반환 (폴백)
        snippet = context[:1200]
        return ChatResponse(
            reply=(
                "현재 LLM 응답 생성이 불가하여 검색된 문서 일부를 반환합니다.\n\n"
                f"{snippet}"
            ),
            source="rag-fallback",
        )


# ─── CSV 수정 엔드포인트 ──────────────────────────────────
@router.post("/csv-edit", response_model=ChatResponse, summary="CSV 파일 수정 처리")
async def chat_csv_edit(
    message: str = Form(...),
    file: UploadFile = File(None)
) -> ChatResponse:
    """CSV 파일 수정 요청 처리"""
    file_content = ""

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
            file_content = f"\n\n[첨부 CSV: {file.filename}]\n{decoded[:3000]}"

    prompt = f"""사용자 요청: {message}
{file_content}

CSV 파일이 첨부되고 수정 요청이 있는 경우:
1. 수정된 전체 CSV 데이터를 반환해주세요
2. 응답 형식:
REPLY: (사용자에게 보여줄 메시지)
CSV:
(수정된 CSV 내용, 헤더 포함)

CSV 수정 요청이 없는 일반 질문은 그냥 답변해주세요."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    result = response.choices[0].message.content.strip()

    if "CSV:" in result and file and file.filename:
        parts = result.split("CSV:", 1)
        reply_text = parts[0].replace("REPLY:", "").strip()
        csv_data = parts[1].strip()

        filename = f"modified_{uuid.uuid4().hex[:8]}.csv"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "w", encoding="utf-8-sig") as f:
            f.write(csv_data)

        download_url = f"/api/chatbot/download/{filename}"
        reply_text += f"\n\n📥 [수정된 파일 다운로드]({download_url})"
        return ChatResponse(reply=reply_text, source="gpt")

    return ChatResponse(reply=result, source="gpt")


@router.get("/download/{filename}", summary="수정된 파일 다운로드")
def download_file(filename: str):
    """수정된 CSV 파일 다운로드"""
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(path=filepath, filename=filename, media_type="text/csv")
