"use client";

import React, { useState, useEffect, useRef } from "react";
import "./chatbot.css";

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
  time: string;
}

interface AIChatbotProps {
  initialMessages?: ChatMessage[];
}

async function fetchBotReply(message: string, file?: File): Promise<string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  if (file) {
    const formData = new FormData();
    formData.append("message", message);
    formData.append("file", file);
    const res = await fetch("/api/csv-edit", { method: "POST", body: formData });
    if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
    const data: { reply: string; source: string } = await res.json();
    return data.reply;
  }

  if (message.toLowerCase().includes(".csv")) {
    const formData = new FormData();
    formData.append("message", message);
    const res = await fetch("/api/chatbot/edit-r2-document", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
    const data: { reply: string; source: string } = await res.json();
    return data.reply;
  }

  const res = await fetch("/api/chatbot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
  const data: { reply: string; source: string } = await res.json();
  return data.reply;
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialMessages ?? DEFAULT_MESSAGES);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isOpen]);

  const getTimeString = () =>
    new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

  const appendMessage = (msg: ChatMessage) => setChatMessages((prev) => [...prev, msg]);

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

  const handleClose = () => { setIsOpen(false); setIsExpanded(false); };

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
            <button type="button" className="chat-expand-btn" onClick={handleToggleExpand} title={isExpanded ? "축소" : "전체 화면으로 확장"}>
              <ExpandIcon expanded={isExpanded} />
            </button>
            <button type="button" className="chat-close-btn" onClick={handleClose}>×</button>
          </div>
        </div>

        <div className="chat-message-list">
          {chatMessages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.sender}`}>
              <div className="message-bubble-wrapper">
                <div className="message-bubble">
                  {msg.text.split("\n").map((line, lIdx) => renderLine(line, lIdx))}
                </div>
                <span className="message-time">{msg.time}</span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-suggestions">
          <span className="chat-suggestions-title">💡 자주 묻는 질문</span>
          <button className="suggestion-btn" onClick={() => handleSend("압축기 점검 주기는 어떻게 되나요?")}>압축기 점검 주기는 어떻게 되나요?</button>
          <button className="suggestion-btn" onClick={() => handleSend("B공장 보일러 점검 체크리스트 보여줘")}>B공장 보일러 점검 체크리스트 보여줘</button>
          <button className="suggestion-btn" onClick={() => handleSend("안전교육 미이수자 명단을 알려줘")}>안전교육 미이수자 명단을 알려줘</button>
        </div>

        <form className="chat-input-area" onSubmit={handleFormSubmit}>
          <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".csv,.xlsx,.pdf" onChange={(e) => setAttachedFile(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "0 4px" }} title="파일 첨부">📎</button>
          {attachedFile && <span style={{ fontSize: 11, color: "#3b82f6", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachedFile.name}</span>}
          <input type="text" className="chat-textbox" placeholder={isLoading ? "응답을 기다리는 중..." : "질문을 입력하세요..."} value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={isLoading} />
          <button type="submit" className="chat-send-btn" disabled={isLoading}>{isLoading ? "..." : "전송"}</button>
        </form>
      </div>
    </div>
  );
}