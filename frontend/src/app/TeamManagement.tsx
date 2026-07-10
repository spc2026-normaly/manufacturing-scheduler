"use client";

import React, { useState, useMemo, useEffect } from "react";

interface Employee {
  emp_id: string;
  login_id: string;
  emp_name: string;
  login_pw: string;
  emp_role: "leader" | "member";
  emp_date: string;
}

const ITEMS_PER_PAGE = 9;

interface TeamManagementProps {
  onShowToast: (msg: string) => void;
}

export default function TeamManagement({ onShowToast }: TeamManagementProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isForbidden, setIsForbidden] = useState(false);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formId, setFormId] = useState("");
  const [formPw, setFormPw] = useState("");
  const [formRole, setFormRole] = useState<"leader" | "member">("member");

  // Password change modal state
  const [isPwModalOpen, setIsPwModalOpen] = useState(false);
  const [targetEmpForPw, setTargetEmpForPw] = useState<Employee | null>(null);
  const [newPw, setNewPw] = useState("");

  // Helper for Authorization Headers
  const getAuthHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : ""
    };
  };

  // Fetch employees list
  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees?limit=500", {
        headers: getAuthHeaders()
      });
      if (res.status === 403) {
        setIsForbidden(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.items);
      } else {
        onShowToast("직원 목록을 가져오지 못했습니다.");
      }
    } catch (err) {
      console.error("Failed to fetch employees", err);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Filter by name search
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.emp_name.toLowerCase().includes(q));
  }, [employees, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleOpenPwModal = (emp: Employee) => {
    setTargetEmpForPw(emp);
    setNewPw("");
    setIsPwModalOpen(true);
  };

  const handleClosePwModal = () => {
    setTargetEmpForPw(null);
    setNewPw("");
    setIsPwModalOpen(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmpForPw) return;
    if (!newPw.trim()) {
      alert("비밀번호를 입력해 주세요.");
      return;
    }
    if (newPw.trim().length < 4) {
      alert("비밀번호는 최소 4글자 이상이어야 합니다.");
      return;
    }

    try {
      const res = await fetch(`/api/employees/${targetEmpForPw.emp_id}/password`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          new_password: newPw.trim()
        })
      });

      if (res.ok) {
        handleClosePwModal();
        onShowToast(`'${targetEmpForPw.emp_name}' 직원의 비밀번호가 변경되었습니다.`);
      } else {
        const errData = await res.json();
        alert(errData.detail || "비밀번호 변경에 실패했습니다.");
      }
    } catch (err) {
      alert("서버 통신 오류로 비밀번호를 변경하지 못했습니다.");
    }
  };

  const handleDelete = async (emp: Employee) => {
    if (confirm(`'${emp.emp_name}' 직원의 계정을 삭제하시겠습니까?`)) {
      try {
        const res = await fetch(`/api/employees/${emp.emp_id}`, {
          method: "DELETE",
          headers: getAuthHeaders()
        });
        if (res.ok) {
          fetchEmployees();
          onShowToast(`'${emp.emp_name}' 계정이 삭제되었습니다.`);
          setCurrentPage(1);
        } else {
          alert("직원 삭제에 실패했습니다.");
        }
      } catch (err) {
        alert("서버 통신 오류로 삭제하지 못했습니다.");
      }
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormId("");
    setFormPw("");
    setFormRole("member");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formId.trim() || !formPw.trim()) {
      alert("모든 항목을 입력해 주세요.");
      return;
    }
    if (employees.some((e) => e.login_id === formId.trim())) {
      alert("이미 사용 중인 아이디입니다.");
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0]; // 기존 레이아웃 유지를 위해 오늘 날짜 자동 할당
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          emp_name: formName.trim(),
          login_id: formId.trim(),
          login_pw: formPw.trim(),
          emp_role: formRole,
          emp_date: today
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        resetForm();
        fetchEmployees();
        setCurrentPage(1);
        onShowToast(`'${formName.trim()}' 직원이 등록되었습니다.`);
      } else {
        const errData = await res.json();
        alert(errData.detail || "직원 추가에 실패했습니다.");
      }
    } catch (err) {
      alert("서버 통신 오류로 직원을 추가하지 못했습니다.");
    }
  };

  // Build visible page numbers (show max 5)
  const pageNumbers: number[] = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

  if (isForbidden) {
    return (
      <div style={{ padding: "40px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh", width: "100%" }}>
        <div style={{ padding: "40px", textAlign: "center", borderColor: "#fca5a5", border: "1px solid #fecaca", borderRadius: "12px", backgroundColor: "#fff", maxWidth: "500px", width: "100%" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚫</div>
          <h2 style={{ color: "#dc2626", fontSize: "20px", fontWeight: "bold" }}>접근 권한이 없습니다</h2>
          <p style={{ color: "#4b5563", marginTop: "8px", fontSize: "14px" }}>
            이 데이터를 조회하거나 관리할 수 있는 권한이 없습니다. (API 403 Forbidden)
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="tm-page">

      {/* ── Sub-header: tab + search + add button ── */}
      <div className="tm-subheader">
        <span className="tm-tab-label">직원 목록</span>

        <div className="tm-subheader-right">
          <div className="tm-search-box">
            <input
              type="text"
              placeholder="이름 검색"
              value={searchQuery}
              onChange={handleSearch}
              className="tm-search-input"
            />
            <span className="tm-search-icon">🔍</span>
          </div>

          <button className="tm-add-btn" onClick={() => setIsModalOpen(true)}>
            + 직원 추가
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="tm-table-wrapper">
        <table className="tm-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>아이디</th>
              <th>비밀번호</th>
              <th>역할</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paginated.length > 0 ? (
              paginated.map((emp) => {
                return (
                  <tr key={emp.emp_id} className="tm-row">
                    <td className="tm-cell-name">{emp.emp_name}</td>
                    <td className="tm-cell-id">{emp.login_id}</td>
                    <td className="tm-cell-pw">
                      <button
                        type="button"
                        className="tm-btn tm-btn-export"
                        onClick={() => handleOpenPwModal(emp)}
                      >
                        비밀번호 변경
                      </button>
                    </td>
                    <td className="tm-cell-role">{emp.emp_role}</td>
                    <td className="tm-cell-actions">
                      <button
                        className="tm-btn tm-btn-delete"
                        onClick={() => handleDelete(emp)}
                      >
                        계정 삭제
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="tm-empty-cell">검색 결과가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer: count + pagination ── */}
      <div className="tm-footer">
        <span className="tm-count-text">전체 직원 {filtered.length}명</span>

        <div className="tm-pagination">
          <button
            className="tm-page-nav"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            &lt;
          </button>

          {pageNumbers.map((n) => (
            <button
              key={n}
              className={`tm-page-num ${currentPage === n ? "active" : ""}`}
              onClick={() => setCurrentPage(n)}
            >
              {n}
            </button>
          ))}

          <button
            className="tm-page-nav"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            &gt;
          </button>
        </div>
      </div>

      {/* ── Create Employee Modal ── */}
      {isModalOpen && (
        <div className="tm-modal-backdrop" onClick={() => { setIsModalOpen(false); resetForm(); }}>
          <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="tm-modal-header">
              <span className="tm-modal-title">직원 생성</span>
              <button className="tm-modal-close" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                ✕
              </button>
            </div>

            {/* Modal form */}
            <form className="tm-modal-form" onSubmit={handleCreate}>
              <div className="tm-field">
                <label className="tm-field-label">이름</label>
                <input
                  className="tm-field-input"
                  type="text"
                  placeholder="이름을 입력하세요"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="tm-field">
                <label className="tm-field-label">아이디</label>
                <input
                  className="tm-field-input"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                />
              </div>

              <div className="tm-field">
                <label className="tm-field-label">비밀번호</label>
                <input
                  className="tm-field-input"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={formPw}
                  onChange={(e) => setFormPw(e.target.value)}
                />
              </div>

              <div className="tm-field">
                <label className="tm-field-label">역할</label>
                <input
                  className="tm-field-input tm-field-role"
                  type="text"
                  placeholder="MEMBER"
                  value={formRole.toUpperCase()}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase();
                    if (v === "leader" || v === "LEADER".toLowerCase()) setFormRole("leader");
                    else setFormRole("member");
                  }}
                />
              </div>

              <div className="tm-modal-actions">
                <button type="button" className="tm-modal-cancel" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                  취소
                </button>
                <button type="submit" className="tm-modal-submit">
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Change Password Modal ── */}
      {isPwModalOpen && targetEmpForPw && (
        <div className="tm-modal-backdrop" onClick={handleClosePwModal}>
          <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="tm-modal-header">
              <span className="tm-modal-title">비밀번호 변경</span>
              <button className="tm-modal-close" onClick={handleClosePwModal}>
                ✕
              </button>
            </div>

            {/* Modal form */}
            <form className="tm-modal-form" onSubmit={handleUpdatePassword}>
              <div className="tm-field">
                <label className="tm-field-label">대상 직원</label>
                <div style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  background: "#f8fafc",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  fontWeight: 500
                }}>
                  {targetEmpForPw.emp_name} ({targetEmpForPw.login_id})
                </div>
              </div>

              <div className="tm-field">
                <label className="tm-field-label">새 비밀번호</label>
                <input
                  className="tm-field-input"
                  type="password"
                  placeholder="새 비밀번호를 입력하세요"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="tm-modal-actions">
                <button type="button" className="tm-modal-cancel" onClick={handleClosePwModal}>
                  취소
                </button>
                <button type="submit" className="tm-modal-submit">
                  변경
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
