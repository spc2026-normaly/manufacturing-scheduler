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

// ── API call: POST /api/chatbot ────────────────────────────────────
async function fetchBotReply(message: string, file?: File): Promise<string> {
  const formData = new FormData();
  formData.append("message", message);
  if (file) formData.append("file", file);

  const res = await fetch("/api/chatbot", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
  const data: { reply: string; source: string } = await res.json();
  return data.reply;
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
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg = text.trim();
    const fileLabel = attachedFile ? ` 📎 ${attachedFile.name}` : "";
    appendMessage({ sender: "user", text: userMsg + fileLabel, time: getTimeString() });
    setIsLoading(true);
    try {
      const reply = await fetchBotReply(userMsg, attachedFile || undefined);
      appendMessage({ sender: "bot", text: reply, time: getTimeString() });
    } catch (err) {
      appendMessage({ sender: "bot", text: "⚠️ 서버와 통신 중 오류가 발생했습니다.", time: getTimeString() });
    } finally {
      setIsLoading(false);
      setAttachedFile(null);
    }
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
                  {msg.text.split("\n").map((line, lIdx) => {
                    const cleanLine = line.replace(/📥\s*/, "");
                    const linkMatch = cleanLine.match(/\[(.+?)\]\((\/api\/.+?)\)/);
                    if (linkMatch) {
                      return (
                        <p key={lIdx} style={{ margin: "2px 0" }}> 
                          <a
                            href={linkMatch[2]}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#3b82f6", textDecoration: "underline", cursor: "pointer" }}
                          >
                            {linkMatch[1]}
                        </a>
                      </p>
                      );
                    }
                    return (
                      <p key={lIdx} style={{ margin: line === "" ? "8px 0" : "2px 0" }}>
                        {line.split("**").map((part, pIdx) =>
                          pIdx % 2 === 1 ? (
                            <strong key={pIdx} style={{ color: "var(--accent-blue)" }}>{part}</strong>
                          ) : (
                            part
                          )
                        )}
                      </p>
                    );
                  })}
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
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".csv,.xlsx,.pdf"
            onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "0 4px" }}
            title="파일 첨부"
          >
            📎
          </button>
          {attachedFile && (
            <span style={{ fontSize: 11, color: "#3b82f6", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {attachedFile.name}
            </span>
          )}
          <input
            type="text"
            className="chat-textbox"
            placeholder={isLoading ? "응답을 기다리는 중..." : "질문을 입력하세요..."}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" className="chat-send-btn" disabled={isLoading}>
            {isLoading ? "..." : "전송"}
          </button>
        </form>
      </div>
    </div>
  );
}
