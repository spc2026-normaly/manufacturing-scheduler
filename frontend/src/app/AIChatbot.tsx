"use client";

import React, { useState, useEffect, useRef } from "react";
import "./chatbot.css";

// ── Types ──────────────────────────────────────────────────────────
interface ChatMessage {
  sender: "user" | "bot";
  text: string;
  time: string;
}

interface AIChatbotProps {
  /** 외부에서 초기 메시지를 주입할 수 있음 (선택) */
  initialMessages?: ChatMessage[];
}

// ── Simulated RAG response generator ──────────────────────────────
function generateBotResponse(userMsg: string): string {
  const msgLower = userMsg.toLowerCase();

  if (msgLower.includes("주기") || msgLower.includes("압축기")) {
    return "압축기 점검 주기는 다음과 같습니다.\n\n* **일상 점검**: 매일\n* **정기 점검**: 1개월\n* **정밀 점검**: 6개월\n* **오버홀**: 1년\n\n(출처: 설비점검_리스트.xlsx)";
  } else if (msgLower.includes("보일러") || msgLower.includes("체크리스트")) {
    return "B공장 보일러 점검 체크리스트 핵심 요약입니다:\n\n1. **압력계 지침 확인** (정상 범위 유지 여부)\n2. **연소 상태 점검** (불꽃 색상 및 매연 여부)\n3. **급수 펌프 및 밸브 누수 여부**\n4. **배관 차단 밸브 오동작 검사**\n\n매주 금요일 정기 점검 시 기록 필수입니다.";
  } else if (msgLower.includes("미이수") || msgLower.includes("교육")) {
    return "안전 교육 미이수자 현황입니다:\n\n* **미이수 인원**: 총 8명 (이수율 93.7%)\n* **주요 미이수자**: 박사원, 임꺽정 (장기 출장 및 교대 근무 변경 사유)\n* **조치 계획**: 6월 22일까지 비대면 안전 보건 교육 보충 과정 이수 권고 문자 발송 완료.";
  } else if (msgLower.includes("출근") || msgLower.includes("직원") || msgLower.includes("인원")) {
    return "오늘 등록된 전체 직원은 **총 128명**이며, 금일 근무 편성에 따라 A동에 **총 11명**이 배치되어 정상 업무를 수행하고 있습니다.";
  }
  return `"${userMsg}"에 관한 RAG 조회 결과입니다.\n\n문서 분석 결과 관련 규정이 조회되었습니다. 추가 상세 데이터 확인을 위해서는 '내 문서'에서 표준 작업 절차서(SOP)를 참조하시기 바랍니다.`;
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    sender: "bot",
    text: "안녕하세요! 업로드된 문서를 기반으로 궁금한 내용을 답변해 드립니다. 🤖",
    time: "방금",
  },
];

// ── Expand/Collapse Icon SVG ───────────────────────────────────────
function ExpandIcon({ expanded }: { expanded: boolean }) {
  return expanded ? (
    /* 닫기/축소: 오른쪽 화살표 (패널을 우측으로 닫는 느낌) */
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ) : (
    /* 확장: 왼쪽 화살표 (우측으로 펼치는 느낌) */
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function AIChatbot({ initialMessages }: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    initialMessages ?? DEFAULT_MESSAGES
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지가 바뀌거나 패널이 열릴 때 스크롤 최하단 이동
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isOpen]);

  const getTimeString = () =>
    new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const appendMessage = (msg: ChatMessage) =>
    setChatMessages((prev) => [...prev, msg]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const userMsg = text.trim();
    appendMessage({ sender: "user", text: userMsg, time: getTimeString() });
    setTimeout(() => {
      appendMessage({
        sender: "bot",
        text: generateBotResponse(userMsg),
        time: getTimeString(),
      });
    }, 600);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(chatInput);
    setChatInput("");
  };

  const handleSuggestionClick = (text: string) => handleSend(text);

  const handleClose = () => {
    setIsOpen(false);
    setIsExpanded(false);
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className={`ai-assistant-container ${isOpen ? "open" : ""}`}>
      {/* ── 플로팅 버튼 ── */}
      <button
        className="ai-floating-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        title="AI 챗봇"
        aria-label="Toggle AI assistant"
      >
        <div className="ai-btn-glow" />
        <svg
          className="ai-robot-icon"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="14" y="20" width="36" height="28" rx="8" fill="#ffffff" stroke="#1e3a8a" strokeWidth="3.5" />
          <rect x="19" y="25" width="26" height="18" rx="4" fill="#1e293b" />
          <circle cx="26" cy="34" r="3" fill="#38bdf8" />
          <circle cx="38" cy="34" r="3" fill="#38bdf8" />
          <line x1="32" y1="20" x2="32" y2="10" stroke="#1e3a8a" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="32" cy="8" r="4" fill="#ef4444" />
          <path d="M28 39H36" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* ── 채팅 패널 ── */}
      <div className={`ai-chat-panel ${isExpanded ? "expanded" : ""}`}>
        {/* 헤더 */}
        <div className="chat-header">
          <div className="chat-title-wrapper">
            <span className="chat-status-dot" />
            <h3>챗봇 (RAG 기반)</h3>
          </div>
          <div className="chat-header-actions">
            {/* 확장/축소 버튼 */}
            <button
              type="button"
              className="chat-expand-btn"
              onClick={handleToggleExpand}
              title={isExpanded ? "축소" : "전체 화면으로 확장"}
              aria-label="Toggle chat panel size"
            >
              <ExpandIcon expanded={isExpanded} />
            </button>
            {/* 닫기 버튼 */}
            <button
              type="button"
              className="chat-close-btn"
              onClick={handleClose}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
        </div>

        {/* 메시지 목록 */}
        <div className="chat-message-list">
          {chatMessages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.sender}`}>
              <div className="message-bubble-wrapper">
                <div className="message-bubble">
                  {msg.text.split("\n").map((line, lIdx) => (
                    <p key={lIdx} style={{ margin: line === "" ? "8px 0" : "2px 0" }}>
                      {line.split("**").map((part, pIdx) =>
                        pIdx % 2 === 1 ? (
                          <strong key={pIdx} style={{ color: "var(--accent-blue)" }}>
                            {part}
                          </strong>
                        ) : (
                          part
                        )
                      )}
                    </p>
                  ))}
                </div>
                <span className="message-time">{msg.time}</span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 빠른 질문 제안 */}
        <div className="chat-suggestions">
          <span className="chat-suggestions-title">💡 자주 묻는 질문</span>
          <button
            className="suggestion-btn"
            onClick={() => handleSuggestionClick("압축기 점검 주기는 어떻게 되나요?")}
          >
            압축기 점검 주기는 어떻게 되나요?
          </button>
          <button
            className="suggestion-btn"
            onClick={() => handleSuggestionClick("B공장 보일러 점검 체크리스트 보여줘")}
          >
            B공장 보일러 점검 체크리스트 보여줘
          </button>
          <button
            className="suggestion-btn"
            onClick={() => handleSuggestionClick("안전교육 미이수자 명단을 알려줘")}
          >
            안전교육 미이수자 명단을 알려줘
          </button>
        </div>

        {/* 입력창 */}
        <form className="chat-input-area" onSubmit={handleFormSubmit}>
          <input
            type="text"
            className="chat-textbox"
            placeholder="질문을 입력하세요..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <button type="submit" className="chat-send-btn">
            전송
          </button>
        </form>
      </div>
    </div>
  );
}
