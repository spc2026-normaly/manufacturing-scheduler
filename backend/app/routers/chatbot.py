"""
챗봇 API 라우터
--------------
POST /api/chatbot
  - 요청: { "message": "..." }
  - 응답: { "reply": "hello world", "source": "mock" }

향후 RAG 파이프라인 / LLM 호출로 교체할 자리입니다.
"""

from fastapi import APIRouter

from app.schemas.chatbot import ChatRequest, ChatResponse

router = APIRouter(prefix="/api", tags=["chatbot"])


# ── 임시 키워드 매핑 (나중에 RAG/LLM으로 교체) ──────────────────────
MOCK_RESPONSES: dict[str, str] = {
    "압축기": "압축기 점검 주기는 다음과 같습니다.\n\n* **일상 점검**: 매일\n* **정기 점검**: 1개월\n* **정밀 점검**: 6개월\n* **오버홀**: 1년\n\n(출처: 설비점검_리스트.xlsx)",
    "주기":   "압축기 점검 주기는 다음과 같습니다.\n\n* **일상 점검**: 매일\n* **정기 점검**: 1개월\n* **정밀 점검**: 6개월\n* **오버홀**: 1년",
    "보일러": "B공장 보일러 점검 체크리스트 핵심 요약입니다:\n\n1. **압력계 지침 확인** (정상 범위 유지 여부)\n2. **연소 상태 점검** (불꽃 색상 및 매연 여부)\n3. **급수 펌프 및 밸브 누수 여부**\n4. **배관 차단 밸브 오동작 검사**\n\n매주 금요일 정기 점검 시 기록 필수입니다.",
    "체크리스트": "B공장 보일러 점검 체크리스트 핵심 요약입니다:\n\n1. **압력계 지침 확인**\n2. **연소 상태 점검**\n3. **급수 펌프 및 밸브 누수 여부**\n4. **배관 차단 밸브 오동작 검사**",
    "미이수": "안전 교육 미이수자 현황입니다:\n\n* **미이수 인원**: 총 8명 (이수율 93.7%)\n* **주요 미이수자**: 박사원, 임꺽정\n* **조치 계획**: 6월 22일까지 비대면 교육 보충 과정 이수 권고 문자 발송 완료.",
    "교육": "안전 교육 미이수자 현황입니다:\n\n* **미이수 인원**: 총 8명 (이수율 93.7%)\n* **이수율**: 93.7%",
    "직원": "오늘 등록된 전체 직원은 **총 128명**이며, 금일 근무 편성에 따라 A동에 **총 11명**이 배치되어 있습니다.",
    "인원": "오늘 등록된 전체 직원은 **총 128명**이며, 금일 근무 편성에 따라 A동에 **총 11명**이 배치되어 있습니다.",
    "출근": "오늘 출근 인원은 A동 **11명**, 전체 **128명** 등록 기준입니다.",
}


def _mock_reply(message: str) -> str:
    """키워드 매칭으로 임시 응답 생성. 매칭 없으면 'hello world' 반환."""
    msg_lower = message.lower()
    for keyword, reply in MOCK_RESPONSES.items():
        if keyword in msg_lower:
            return reply
    # ── 기본 응답 (임시 hello world) ──────────────────────────────
    return "hello world"


@router.post(
    "/chatbot",
    response_model=ChatResponse,
    summary="챗봇 메시지 처리",
    description="사용자 메시지를 받아 임시 응답을 반환합니다. 추후 RAG/LLM으로 교체 예정.",
)
async def chat(body: ChatRequest) -> ChatResponse:
    """
    - 입력: `{ "message": "질문 내용" }`
    - 출력: `{ "reply": "응답 내용", "source": "mock" }`
    """
    reply = _mock_reply(body.message)
    return ChatResponse(reply=reply, source="mock")
