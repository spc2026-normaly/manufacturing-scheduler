"use client";

import React, { useState, useEffect, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import AIChatbot from "./AIChatbot";

// Navigation items definition
const NAV_ITEMS = [
  { icon: "🏠", label: "메인", path: "dashboard" },
  { icon: "📄", label: "내 문서", path: "documents" },
  { icon: "📅", label: "양산 일정", path: "schedules" },
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  console.log("[AppLayout] Rendering, current toasts:", toasts);

  // Authentication states
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ emp_id: string; login_id: string; emp_name: string; emp_role: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login Form states
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Determine active menu based on URL pathname
  const activeMenu = pathname === "/employees" ? "팀원 관리" : pathname === "/safety-training" ? "안전 교육 현황" : pathname === "/equipments" ? "장비 관리" : pathname === "/documents" ? "내 문서" : pathname === "/schedules" ? "양산 일정" : "메인";

  // Fetch /api/auth/me to verify token
  const fetchMe = async (authToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        // Token expired or invalid
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to fetch user profile", err);
    } finally {
      setAuthLoading(false);
    }
  };

  // Restore token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      setToken(savedToken);
      fetchMe(savedToken);
    } else {
      setAuthLoading(false);
    }
  }, []);

  // Redirect members from root path to schedules
  useEffect(() => {
    if (!authLoading && user) {
      if (user.emp_role === "member" && pathname === "/") {
        router.replace("/schedules");
      }
    }
  }, [user, pathname, authLoading, router]);


  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPw.trim()) {
      setLoginError("아이디와 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setLoginSubmitting(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: loginId.trim(),
          password: loginPw.trim()
        })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        setToken(data.access_token);
        setUser(data.user_info);
        showToast(`${data.user_info.emp_name}님, 로그인되었습니다.`);
      } else {
        const errData = await res.json();
        setLoginError(errData.detail || "아이디 또는 비밀번호가 올바르지 않습니다.");
      }
    } catch (err) {
      setLoginError("서버 연결에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      showToast("로그아웃 되었습니다.");
      router.push("/");
    }
  };

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
    console.log("[showToast] Triggered with message:", message);
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // 1. Loading state
  if (authLoading) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#0f172a",
        color: "#fff",
        fontFamily: "sans-serif"
      }}>
        <div style={{
          border: "4px solid rgba(255, 255, 255, 0.1)",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          borderLeftColor: "#3b82f6",
          animation: "spin 1s linear infinite"
        }}></div>
        <p style={{ marginTop: "16px", color: "#94a3b8" }}>시스템 로딩 중...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 2. Non-authenticated state: Render login overlay
  if (!token || !user) {
    return (
      <ToastContext.Provider value={showToast}>
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "radial-gradient(circle at top right, #1e3a8a, #0f172a 70%)",
          color: "#fff",
          fontFamily: "'Outfit', 'Inter', sans-serif"
        }}>
          <div style={{
            width: "100%",
            maxWidth: "400px",
            padding: "40px",
            borderRadius: "16px",
            backgroundColor: "rgba(30, 41, 59, 0.7)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxSizing: "border-box"
          }}>
            {/* Logo */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "30px",
              gap: "10px"
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 2L4 7V15C4 22.2 9.1 28.9 16 30C22.9 28.9 28 22.2 28 15V7L16 2Z" fill="url(#login-grad)" />
                <path d="M16 8V24" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M10 14H22" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="login-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#3b82f6" />
                    <stop offset="1" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "20px", fontWeight: "bold", letterSpacing: "1px", lineHeight: "1.1" }}>linea</span>
                <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "600" }}>SafeFactory System</span>
              </div>
            </div>

            <h2 style={{ fontSize: "22px", fontWeight: "bold", textAlign: "center", marginBottom: "8px" }}>시스템 로그인</h2>
            <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", marginBottom: "30px" }}>배정받은 계정 아이디와 비밀번호를 입력해 주세요.</p>

            <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#cbd5e1", marginBottom: "6px", fontWeight: "500" }}>아이디</label>
                <input
                  type="text"
                  placeholder="ID 입력"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#cbd5e1", marginBottom: "6px", fontWeight: "500" }}>비밀번호</label>
                <input
                  type="password"
                  placeholder="Password 입력"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {loginError && (
                <div style={{ color: "#ef4444", fontSize: "13px", textAlign: "center", marginTop: "4px" }}>
                  ⚠️ {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginSubmitting}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "8px",
                  backgroundColor: "#3b82f6",
                  border: "none",
                  color: "#fff",
                  fontSize: "15px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  marginTop: "10px",
                  transition: "background-color 0.2s"
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#3b82f6")}
              >
                {loginSubmitting ? "로그인 중..." : "로그인"}
              </button>
            </form>

            <div style={{ marginTop: "25px", fontSize: "12px", color: "#64748b", textAlign: "center" }}>
              계정 발급은 부서 관리자에게 문의하세요.
            </div>
          </div>
        </div>

        {/* Toast Container */}
        <div className="toast-container login-toast">
          {toasts.map((toast) => (
            <div key={toast.id} className="toast-message animate-in">
              <span className="toast-icon">ℹ️</span>
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    );
  }

  // 3. Authenticated state: Render complete app
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
            <span className="sidebar-logo-text">Linea</span>
            <span className="sidebar-logo-sub">SafeFactory System</span>
          </div>
        </div>

        <span className="sidebar-section-label">메뉴</span>
        <div className="sidebar-nav-list">
          {NAV_ITEMS.filter((item) => {
            if (user?.emp_role === "member") {
              return item.path === "schedules" || item.path === "safety-training";
            }
            return true;
          }).map((item) => (
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
            <div className="user-profile" style={{ position: "relative" }}>
              <div className="user-info">
                <span className="user-name">{user.emp_name} ({user.emp_role === "leader" ? "Leader" : "Member"})</span>
                <span className="user-role">{user.emp_role === "leader" ? "관리자" : "팀원"}</span>
              </div>
              <div 
                className="user-avatar" 
                onClick={handleLogout}
                style={{ cursor: "pointer", transition: "transform 0.2s" }}
                title="클릭하여 로그아웃"
                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                <span>{user.emp_name[0]}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Dynamic Main Screen ── */}
        <main className="page-content">
          {user && user.emp_role === "member" && activeMenu !== "양산 일정" && activeMenu !== "안전 교육 현황" ? (
            <div className="placeholder-content card animate-in" style={{ borderColor: "#fca5a5" }}>
              <div className="placeholder-icon" style={{ fontSize: "48px", marginBottom: "16px" }}>🚫</div>
              <h2 style={{ color: "#dc2626" }}>접근 권한이 없습니다</h2>
              <p style={{ color: "#4b5563", marginTop: "8px", marginBottom: "20px" }}>
                이 페이지를 조회할 수 있는 권한이 없습니다. 양산 일정 또는 안전 교육 현황 메뉴를 이용해 주세요.
              </p>
              <button className="btn-primary" style={{ backgroundColor: "#dc2626" }} onClick={() => router.push("/schedules")}>
                양산 일정으로 이동
              </button>
            </div>
          ) : activeMenu === "메인" || activeMenu === "팀원 관리" || activeMenu === "안전 교육 현황" || activeMenu === "장비 관리" || activeMenu === "내 문서" || activeMenu === "양산 일정" ? (
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

      {/* ── AI Assistant Chatbot ── */}
      <AIChatbot />

      {/* ── Toast Container ── */}
      <div className="toast-container app-toast">
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
