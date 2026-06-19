from pydantic import BaseModel


class ChatRequest(BaseModel):
    """챗봇 요청 스키마"""
    message: str                    # 사용자가 입력한 메시지


class ChatResponse(BaseModel):
    """챗봇 응답 스키마"""
    reply: str                      # 봇이 돌려보내는 답변 텍스트
    source: str = "mock"            # 응답 출처 표시 (mock / rag / llm 등)
