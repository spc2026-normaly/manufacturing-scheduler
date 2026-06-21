from openai import OpenAI
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas.chatbot import ChatRequest, ChatResponse
from app.services.document_service import search_rag_chunks

router = APIRouter(prefix="/api", tags=["chatbot"])


def _build_context(chunks: list[dict]) -> str:
    lines: list[str] = []
    for idx, chunk in enumerate(chunks, start=1):
        lines.append(f"[{idx}] 문서: {chunk['file_name']}")
        lines.append(chunk["content"])
        lines.append("")
    return "\n".join(lines).strip()


def _answer_with_openai(question: str, context: str) -> str:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY가 설정되지 않았습니다.")

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
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
        temperature=0.2,
    )
    return response.choices[0].message.content or "답변을 생성하지 못했습니다."


@router.post(
    "/chatbot",
    response_model=ChatResponse,
    summary="챗봇 메시지 처리",
    description="사용자 질문 임베딩 후 pgvector에서 문서 청크를 검색해 답변을 생성합니다.",
)
async def chat(
    body: ChatRequest,
    k: int = Query(default=settings.RAG_TOP_K, ge=1, le=10),
    db: Session = Depends(get_db),
) -> ChatResponse:
    chunks = search_rag_chunks(db=db, query=body.message, top_k=k)
    if not chunks:
        return ChatResponse(
            reply="관련 문서를 찾지 못했습니다. RAG 문서를 업로드하거나 동기화를 먼저 실행해 주세요.",
            source="rag",
        )

    context = _build_context(chunks)
    try:
        reply = _answer_with_openai(question=body.message, context=context)
        return ChatResponse(reply=reply, source="rag")
    except Exception:
        snippet = context[:1200]
        return ChatResponse(
            reply=(
                "현재 LLM 응답 생성이 불가하여 검색된 문서 일부를 반환합니다.\n\n"
                f"{snippet}"
            ),
            source="rag-fallback",
        )
