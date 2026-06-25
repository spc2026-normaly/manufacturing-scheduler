"use client";

import React, { useState, useEffect, useRef } from "react";
import "./chatbot.css";

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
  time: string;
}

interface ChatSessionInfo {
  session_id: string;
  title: string;
  created_at: string;
  last_activity: string;
  count: number;
}

interface AIChatbotProps {
  initialMessages?: ChatMessage[];
}

// ── API calls ──────────────────────────────────────────────────────
async function fetchBotReply(message: string, sessionId: string | null, file?: File): Promise<{ reply: string; sessionId: string }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  if (file) {
    const formData = new FormData();
    formData.append("message", message);
    formData.append("file", file);

    if (sessionId) {
      formData.append("session_id", sessionId);
    }

    const res = await fetch("/api/csv-edit", { method: "POST", body: formData });
    if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
    const data: { reply: string; source: string; session_id?: string } = await res.json();
    return { reply: data.reply, sessionId: data.session_id || sessionId || "" };
  }

  if (message.toLowerCase().includes(".csv")) {
    const formData = new FormData();
    formData.append("message", message);
    const res = await fetch("/api/chatbot/edit-r2-document", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("❌ CSV Edit API 에러:", res.status, errText);
      throw new Error(`서버 오류: ${res.status}`);
    }

    const data: { reply: string; source: string; session_id?: string } = await res.json();
    return { reply: data.reply, sessionId: data.session_id || sessionId || "" };
  }

  const res = await fetch("/api/chatbot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("❌ 챗봇 API 에러:", res.status, errText);
    throw new Error(`서버 오류: ${res.status}`);
  }

  const data: { reply: string; source: string; session_id?: string } = await res.json();
  return { reply: data.reply, sessionId: data.session_id || sessionId || "" };
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  { sender: "bot", text: "안녕하세요! 업로드된 문서를 기반으로 궁금한 내용을 답변해 드립니다. 🤖", time: "방금" },
];

function ExpandIcon({ expanded }: { expanded: boolean }) {
  return expanded ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export default function AIChatbot({ initialMessages }: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 세션 관련 상태
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionInfo[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    initialMessages ?? DEFAULT_MESSAGES
  );
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 로컬 세션 ID 목록을 localStorage에서 동기화하고 활성화된 세션 로드
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedSessionId = localStorage.getItem("chatbot_current_session_id");
    if (storedSessionId) {
      setSessionId(storedSessionId);
      loadChatHistory(storedSessionId);
    } else {
      // 세션이 없으면 새로 생성
      handleStartNewChat();
    }
    loadSessionsList();
  }, []);

  // 메시지가 바뀌거나 패널이 열릴 때 스크롤 최하단 이동
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isOpen, showSessions]);

  const getTimeString = () =>
    new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

  const formatDbTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "방금";
    }
  };

  // 특정 세션의 대화 이력을 가져와 뷰에 세팅
  const loadChatHistory = async (targetSessionId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/chatbot/history?session_id=${targetSessionId}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (res.ok) {
        const history: Array<{ question: string; answer: string; created_at: string }> = await res.json();
        if (history.length === 0) {
          setChatMessages(DEFAULT_MESSAGES);
        } else {
          const msgs: ChatMessage[] = [];
          history.forEach((h) => {
            msgs.push({
              sender: "user",
              text: h.question,
              time: formatDbTime(h.created_at),
            });
            msgs.push({
              sender: "bot",
              text: h.answer,
              time: formatDbTime(h.created_at),
            });
          });
          setChatMessages(msgs);
        }
      }
    } catch (err) {
      console.error("❌ 대화 내역 로드 에러:", err);
    }
  };

  // 세션 목록 API 호출
  const loadSessionsList = async () => {
    try {
      const token = localStorage.getItem("token");
      const localIds = localStorage.getItem("chatbot_local_session_ids") || "";
      const url = localIds 
        ? `/api/chatbot/sessions?local_ids=${encodeURIComponent(localIds)}` 
        : "/api/chatbot/sessions";

      const res = await fetch(url, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (res.ok) {
        const data: ChatSessionInfo[] = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("❌ 세션 목록 로드 에러:", err);
    }
  };

  // 새 대화 시작 (새로운 세션 생성)
  const handleStartNewChat = () => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    setSessionId(newId);
    localStorage.setItem("chatbot_current_session_id", newId);
    
    // 로컬 ID 목록 저장
    const localIdsStr = localStorage.getItem("chatbot_local_session_ids") || "";
    const localIds = localIdsStr ? localIdsStr.split(",") : [];
    if (!localIds.includes(newId)) {
      localIds.push(newId);
      localStorage.setItem("chatbot_local_session_ids", localIds.join(","));
    }

    setChatMessages(DEFAULT_MESSAGES);
    setShowSessions(false);
    loadSessionsList();
  };

  // 대화 목록에서 특정 세션 선택
  const handleSelectSession = (targetSessionId: string) => {
    setSessionId(targetSessionId);
    localStorage.setItem("chatbot_current_session_id", targetSessionId);
    loadChatHistory(targetSessionId);
    setShowSessions(false);
  };

  // 특정 세션 삭제
  const handleDeleteSession = async (targetSessionId: string) => {
    if (!confirm("이 대화를 삭제하시겠습니까?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/chatbot/session/${targetSessionId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });

      if (res.ok) {
        // 로컬 리스트에서 제거
        const localIdsStr = localStorage.getItem("chatbot_local_session_ids") || "";
        const localIds = localIdsStr ? localIdsStr.split(",") : [];
        const filteredIds = localIds.filter((id) => id !== targetSessionId);
        localStorage.setItem("chatbot_local_session_ids", filteredIds.join(","));

        // 만약 현재 보고있던 세션이 삭제되었다면 새 대화 생성
        if (sessionId === targetSessionId) {
          handleStartNewChat();
        } else {
          loadSessionsList();
        }
      } else {
        alert("대화 삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error("❌ 세션 삭제 에러:", err);
    }
  };

  const appendMessage = (msg: ChatMessage) =>
    setChatMessages((prev) => [...prev, msg]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg = text.trim();
    const fileLabel = attachedFile ? ` 📎 ${attachedFile.name}` : "";
    appendMessage({ sender: "user", text: userMsg + fileLabel, time: getTimeString() });
    setIsLoading(true);
    try {
      const result = await fetchBotReply(userMsg, sessionId, attachedFile || undefined);
      
      // 세션 ID가 바뀐 경우 동기화
      if (result.sessionId && result.sessionId !== sessionId) {
        setSessionId(result.sessionId);
        localStorage.setItem("chatbot_current_session_id", result.sessionId);

        const localIdsStr = localStorage.getItem("chatbot_local_session_ids") || "";
        const localIds = localIdsStr ? localIdsStr.split(",") : [];
        if (!localIds.includes(result.sessionId)) {
          localIds.push(result.sessionId);
          localStorage.setItem("chatbot_local_session_ids", localIds.join(","));
        }
      }
      
      appendMessage({ sender: "bot", text: result.reply, time: getTimeString() });
      loadSessionsList();
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

  const handleDownload = (fileId: string, fileName: string) => {
    const token = localStorage.getItem("token");
    fetch(`/api/documents/${fileId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
      });
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsExpanded(false);
    setShowSessions(false);
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const renderLine = (line: string, lIdx: number) => {
    // 다운로드 버튼 패턴: 📥 DOWNLOAD:{fileId}:{fileName}
    const downloadMatch = line.match(/📥 DOWNLOAD:([^:]+):(.+)/);
    if (downloadMatch) {
      const fileId = downloadMatch[1];
      const fileName = downloadMatch[2];
      return (
        <p key={lIdx} style={{ margin: "4px 0" }}>
          <button
            onClick={() => handleDownload(fileId, fileName)}
            style={{ padding: "6px 12px", borderRadius: 6, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}
          >
            📥 {fileName} 다운로드
          </button>
        </p>
      );
    }

    return (
      <p key={lIdx} style={{ margin: line === "" ? "8px 0" : "2px 0" }}>
        {line.split("**").map((part, pIdx) =>
          pIdx % 2 === 1 ? <strong key={pIdx} style={{ color: "var(--accent-blue)" }}>{part}</strong> : part
        )}
      </p>
    );
  };

  return (
    <div className={`ai-assistant-container ${isOpen ? "open" : ""}`}>
      <button className="ai-floating-btn" onClick={() => setIsOpen((prev) => !prev)} title="AI 챗봇" aria-label="Toggle AI assistant">
        <div className="ai-btn-glow" />
        <svg className="ai-robot-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="14" y="20" width="36" height="28" rx="8" fill="#ffffff" stroke="#1e3a8a" strokeWidth="3.5" />
          <rect x="19" y="25" width="26" height="18" rx="4" fill="#1e293b" />
          <circle cx="26" cy="34" r="3" fill="#38bdf8" />
          <circle cx="38" cy="34" r="3" fill="#38bdf8" />
          <line x1="32" y1="20" x2="32" y2="10" stroke="#1e3a8a" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="32" cy="8" r="4" fill="#ef4444" />
          <path d="M28 39H36" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className={`ai-chat-panel ${isExpanded ? "expanded" : ""}`}>
        <div className="chat-header">
          <div className="chat-title-wrapper">
            <span className="chat-status-dot" />
            <h3>챗봇 (RAG 기반)</h3>
          </div>
          <div className="chat-header-actions">
            {/* 세션 목록 버튼 */}
            <button
              type="button"
              className="chat-history-btn"
              onClick={() => {
                setShowSessions(!showSessions);
                if (!showSessions) {
                  loadSessionsList();
                }
              }}
              title={showSessions ? "대화창으로 돌아가기" : "이전 대화 목록"}
              aria-label="Toggle chat history"
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
                borderRadius: "50%",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
            >
              {showSessions ? (
                // 돌아가기 아이콘 (말풍선 모양)
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              ) : (
                // 목록 아이콘
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              )}
            </button>

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
            <button type="button" className="chat-close-btn" onClick={handleClose}>×</button>
          </div>
        </div>

        {/* 대화 목록 화면 */}
        {showSessions ? (
          <div className="session-list-container">
            <div className="session-list-header">
              <h4>이전 대화 목록</h4>
              <button
                type="button"
                className="new-session-btn"
                onClick={handleStartNewChat}
              >
                + 새 대화 시작
              </button>
            </div>
            <div className="session-items-wrapper">
              {sessions.length === 0 ? (
                <div className="no-sessions">이전 대화 내역이 없습니다.</div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.session_id}
                    className={`session-item-card ${s.session_id === sessionId ? "active" : ""}`}
                    onClick={() => handleSelectSession(s.session_id)}
                  >
                    <div className="session-item-info">
                      <div className="session-item-title" title={s.title}>
                        {s.title}
                      </div>
                      <div className="session-item-meta">
                        <span>{s.count}개의 대화</span>
                        <span>•</span>
                        <span>{new Date(s.last_activity).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="session-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(s.session_id);
                      }}
                      title="대화 삭제"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}