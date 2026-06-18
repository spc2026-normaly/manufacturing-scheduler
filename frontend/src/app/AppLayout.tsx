"use client";

import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import TeamManagement from "./TeamManagement";

// Navigation items definition
const NAV_ITEMS = [
  { icon: "🏠", label: "메인", path: "dashboard" },
  { icon: "📅", label: "양산 일정", path: "schedules" },
  { icon: "📄", label: "내 문서", path: "documents" },
  { icon: "👥", label: "팀원 관리", path: "employees" },
  { icon: "📊", label: "안전 교육 현황", path: "safety-training" },
  { icon: "⚙️", label: "장비 관리", path: "equipments" },
  { icon: "⚙️", label: "설정", path: "settings" },
];

// Toast Context for child pages
export const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

// Live Clock Component
function LiveClock() {
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("ko-KR", { hour12: false }));
      setDateStr(now.toLocaleDateString("ko-KR", { 
        year: "numeric", 
        month: "long", 
        day: "numeric", 
        weekday: "short" 
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="topbar-datetime">
      <span className="topbar-date">{dateStr}</span>
      <span className="topbar-time">{timeStr}</span>
    </div>
  );
}

// Custom Toast Component for interactive feedback
interface Toast {
  id: number;
  message: string;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine active menu based on URL pathname
  const activeMenu = pathname === "/employees" ? "팀원 관리" : pathname === "/safety-training" ? "안전 교육 현황" : pathname === "/equipments" ? "장비 관리" : pathname === "/documents" ? "내 문서" : pathname === "/schedules" ? "양산 일정" : "메인";

  const [isAiOpen, setIsAiOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "bot"; text: string; time: string }>>([
    {
      sender: "bot",
      text: "안녕하세요! 업로드된 문서를 기반으로 궁금한 내용을 답변해 드립니다. 🤖",
      time: "방금",
    },
  ]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isAiOpen]);

  // Handle menu click
  const handleMenuClick = (label: string, path: string) => {
    if (path === "dashboard") {
      router.push("/");
    } else if (path === "employees") {
      router.push("/employees");
    } else if (path === "documents") {
      router.push("/documents");
    } else if (path === "schedules") {
      router.push("/schedules");
    } else if (path === "safety-training") {
      router.push("/safety-training");
    } else if (path === "equipments") {
      router.push("/equipments");
    } else {
      showToast(`'${label}' 메뉴는 개발 중입니다. 곧 릴리즈됩니다!`);
    }
  };

  // Toast helper
  const showToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Simulated AI Chatbot Response logic
  const sendBotResponse = (userMsg: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    
    let botResponse = "";
    const msgLower = userMsg.toLowerCase();
    
    if (msgLower.includes("주기") || msgLower.includes("압축기")) {
      botResponse = "압축기 점검 주기는 다음과 같습니다.\n\n* **일상 점검**: 매일\n* **정기 점검**: 1개월\n* **정밀 점검**: 6개월\n* **오버홀**: 1년\n\n(출처: 설비점검_리스트.xlsx)";
    } else if (msgLower.includes("보일러") || msgLower.includes("체크리스트")) {
      botResponse = "B공장 보일러 점검 체크리스트 핵심 요약입니다:\n\n1. **압력계 지침 확인** (정상 범위 유지 여부)\n2. **연소 상태 점검** (불꽃 색상 및 매연 여부)\n3. **급수 펌프 및 밸브 누수 여부**\n4. **배관 차단 밸브 오동작 검사**\n\n매주 금요일 정기 점검 시 기록 필수입니다.";
    } else if (msgLower.includes("미이수") || msgLower.includes("교육")) {
      botResponse = "안전 교육 미이수자 현황입니다:\n\n* **미이수 인원**: 총 8명 (이수율 93.7%)\n* **주요 미이수자**: 박사원, 임꺽정 (장기 출장 및 교대 근무 변경 사유)\n* **조치 계획**: 6월 22일까지 비대면 안전 보건 교육 보충 과정 이수 권고 문자 발송 완료.";
    } else if (msgLower.includes("출근") || msgLower.includes("직원") || msgLower.includes("인원")) {
      botResponse = "오늘 등록된 전체 직원은 **총 128명**이며, 금일 근무 편성에 따라 A동에 **총 11명**이 배치되어 정상 업무를 수행하고 있습니다.";
    } else {
      botResponse = `"${userMsg}"에 관한 RAG 조회 결과입니다.\n\n문서 분석 결과 관련 규정이 조회되었습니다. 추가 상세 데이터 확인을 위해서는 '내 문서'에서 표준 작업 절차서(SOP)를 참조하시기 바랍니다.`;
    }

    setChatMessages((prev) => [...prev, { sender: "bot", text: botResponse, time: timeString }]);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    const now = new Date();
    const timeString = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

    // Append user message
    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg, time: timeString }]);
    setChatInput("");

    // Generate bot response after short delay
    setTimeout(() => {
      sendBotResponse(userMsg);
    }, 600);
  };

  const handleSuggestionClick = (text: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    
    // Add user message
    setChatMessages((prev) => [...prev, { sender: "user", text: text, time: timeString }]);
    
    // Add bot response
    setTimeout(() => {
      sendBotResponse(text);
    }, 600);
  };

  return (
    <ToastContext.Provider value={showToast}>
      <div className="app-layout">
      {/* ── Sidebar (Deep Dark Blue) ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          {/* Safety/Shield style SVG logo for Linea */}
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-svg">
            <path d="M16 2L4 7V15C4 22.2 9.1 28.9 16 30C22.9 28.9 28 22.2 28 15V7L16 2Z" fill="url(#linea-grad)" />
            <path d="M16 8V24" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M10 14H22" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="linea-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3b82f6" />
                <stop offset="1" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
          </svg>
          <div className="logo-text-wrapper">
            <span className="sidebar-logo-text">linea</span>
            <span className="sidebar-logo-sub">SafeFactory System</span>
          </div>
        </div>

        <span className="sidebar-section-label">메뉴</span>
        <div className="sidebar-nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleMenuClick(item.label, item.path)}
              className={`nav-item ${activeMenu === item.label ? "active" : ""}`}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-item-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="system-status-indicator">
            <span className="status-dot online"></span>
            <span className="status-text">서버 정상 작동 중</span>
          </div>
        </div>
      </aside>

      {/* ── Main Wrapper ── */}
      <div className="main-content">
        {/* ── Topbar (Header - White Background) ── */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">
              {activeMenu === "메인" ? "메인 대시보드" : activeMenu}
            </span>
          </div>
          
          <div className="topbar-center">
            <LiveClock />
          </div>

          <div className="topbar-right">
            <div className="user-profile">
              <div className="user-info">
                <span className="user-name">김리더 (Leader)</span>
                <span className="user-role">관리자</span>
              </div>
              <div className="user-avatar">
                <span>K</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Dynamic Main Screen ── */}
        <main className="page-content">
          {activeMenu === "메인" || activeMenu === "팀원 관리" || activeMenu === "안전 교육 현황" || activeMenu === "장비 관리" || activeMenu === "내 문서" || activeMenu === "양산 일정" ? (
            children
          ) : (
            <div className="placeholder-content card animate-in">
              <div className="placeholder-icon">🛠️</div>
              <h2>{activeMenu} 페이지 준비 중</h2>
              <p>해당 기능은 다음 마일스톤에 포함되어 현재 프론트엔드 목업을 준비하고 있습니다.</p>
              <button className="btn-primary" onClick={() => router.push("/")}>
                대시보드로 돌아가기
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── Collapsible AI Assistant (RAG Chatbot Theme) ── */}
      <div className={`ai-assistant-container ${isAiOpen ? "open" : ""}`}>
        {/* Floating Button */}
        <button 
          className="ai-floating-btn" 
          onClick={() => setIsAiOpen(!isAiOpen)}
          title="AI 챗봇"
          aria-label="Toggle AI assistant"
        >
          <div className="ai-btn-glow"></div>
          <svg className="ai-robot-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="14" y="20" width="36" height="28" rx="8" fill="#ffffff" stroke="#1e3a8a" strokeWidth="3.5"/>
            <rect x="19" y="25" width="26" height="18" rx="4" fill="#1e293b"/>
            <circle cx="26" cy="34" r="3" fill="#38bdf8"/>
            <circle cx="38" cy="34" r="3" fill="#38bdf8"/>
            <line x1="32" y1="20" x2="32" y2="10" stroke="#1e3a8a" strokeWidth="3.5" strokeLinecap="round"/>
            <circle cx="32" cy="8" r="4" fill="#ef4444"/>
            <path d="M28 39H36" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Collapsible Chat Window */}
        <div className="ai-chat-panel">
          <div className="chat-header">
            <div className="chat-title-wrapper">
              <span className="chat-status-dot"></span>
              <h3>챗봇 (RAG 기반)</h3>
            </div>
            <button className="chat-close-btn" onClick={() => setIsAiOpen(false)}>×</button>
          </div>

          <div className="chat-message-list">
            {chatMessages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.sender}`}>
                <div className="message-bubble-wrapper">
                  <div className="message-bubble">
                    {msg.text.split("\n").map((line, lIdx) => (
                      <p key={lIdx} style={{ margin: line === "" ? "8px 0" : "2px 0" }}>
                        {line.split("**").map((part, pIdx) => 
                          pIdx % 2 === 1 ? <strong key={pIdx} style={{ color: "var(--accent-blue)" }}>{part}</strong> : part
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

          {/* Quick Suggestions as shown in the Mockup */}
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

          <form className="chat-input-area" onSubmit={handleSendMessage}>
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

      {/* ── Toast Container ── */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-message animate-in">
            <span className="toast-icon">ℹ️</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
    </ToastContext.Provider>
  );
}
