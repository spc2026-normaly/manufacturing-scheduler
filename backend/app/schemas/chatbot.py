from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatRequest(BaseModel):
    """챗봇 요청 스키마"""
    message: str                    # 사용자가 입력한 메시지
    session_id: Optional[str] = None # 채팅 세션 ID (없으면 백엔드에서 생성)


class ChatResponse(BaseModel):
    """챗봇 응답 스키마"""
    reply: str                      # 봇이 돌려보내는 답변 텍스트
    source: str = "mock"            # 응답 출처 표시 (mock / rag / llm 등)
    session_id: Optional[str] = None # 활성화된 채팅 세션 ID


class ChatMessageItem(BaseModel):
    """대화 기록 내 개별 질문/답변 쌍 스키마"""
    log_id: str
    question: str
    answer: str
    source: str
    created_at: datetime


class ChatSessionItem(BaseModel):
    """채팅 세션 요약 정보 스키마"""
    session_id: str
    title: str
    created_at: datetime
    last_activity: datetime
    count: int

