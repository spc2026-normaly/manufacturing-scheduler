"use client";

import React, { useState, useMemo } from "react";

interface Employee {
  emp_id: string;
  login_id: string;
  emp_name: string;
  login_pw: string;
  emp_role: "leader" | "member";
}

const INITIAL_EMPLOYEES: Employee[] = [
  { emp_id: "emp_001", login_id: "emp1", emp_name: "이ㅇㅇ", login_pw: "password1", emp_role: "member" },
  { emp_id: "emp_002", login_id: "emp1", emp_name: "이ㅇㅇ", login_pw: "password2", emp_role: "member" },
  { emp_id: "emp_003", login_id: "emp1", emp_name: "이ㅇㅇ", login_pw: "password3", emp_role: "member" },
  { emp_id: "emp_004", login_id: "emp1", emp_name: "이ㅇㅇ", login_pw: "password4", emp_role: "member" },
  { emp_id: "emp_005", login_id: "emp1", emp_name: "이ㅇㅇ", login_pw: "password5", emp_role: "member" },
  { emp_id: "emp_006", login_id: "emp1", emp_name: "이ㅇㅇ", login_pw: "password6", emp_role: "member" },
  { emp_id: "emp_007", login_id: "leeyh",  emp_name: "이영희", login_pw: "pw12345",   emp_role: "leader" },
  { emp_id: "emp_008", login_id: "parkms", emp_name: "박민수", login_pw: "pw12345",   emp_role: "member" },
  { emp_id: "emp_009", login_id: "choijh", emp_name: "최지훈", login_pw: "pw12345",   emp_role: "member" },
  { emp_id: "emp_010", login_id: "jungsh", emp_name: "정수현", login_pw: "pw12345",   emp_role: "member" },
  { emp_id: "emp_011", login_id: "hongs",  emp_name: "홍길동", login_pw: "pw12345",   emp_role: "member" },
  { emp_id: "emp_012", login_id: "limkk",  emp_name: "임꺽정", login_pw: "pw12345",   emp_role: "leader" },
];

const ITEMS_PER_PAGE = 6;

interface TeamManagementProps {
  onShowToast: (msg: string) => void;
}

export default function TeamManagement({ onShowToast }: TeamManagementProps) {
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [visiblePwIds, setVisiblePwIds] = useState<Set<string>>(new Set());

  // Create form state
  const [formName, setFormName] = useState("");
  const [formId, setFormId] = useState("");
  const [formPw, setFormPw] = useState("");
  const [formRole, setFormRole] = useState<"leader" | "member">("member");

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

  const togglePwVisible = (id: string) => {
    setVisiblePwIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = (emp: Employee) => {
    if (confirm(`'${emp.emp_name}' 직원의 계정을 삭제하시겠습니까?`)) {
      setEmployees((prev) => prev.filter((e) => e.emp_id !== emp.emp_id));
      onShowToast(`'${emp.emp_name}' 계정이 삭제되었습니다.`);
      setCurrentPage(1);
    }
  };

  const handleExport = (emp: Employee) => {
    onShowToast(`'${emp.emp_name}' 직원 정보를 내보냈습니다.`);
  };

  const resetForm = () => {
    setFormName("");
    setFormId("");
    setFormPw("");
    setFormRole("member");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formId.trim() || !formPw.trim()) {
      alert("모든 항목을 입력해 주세요.");
      return;
    }
    if (employees.some((e) => e.login_id === formId.trim())) {
      alert("이미 사용 중인 아이디입니다.");
      return;
    }
    const newEmp: Employee = {
      emp_id: `emp_${Date.now()}`,
      login_id: formId.trim(),
      emp_name: formName.trim(),
      login_pw: formPw.trim(),
      emp_role: formRole,
    };
    setEmployees((prev) => [newEmp, ...prev]);
    setIsModalOpen(false);
    resetForm();
    setCurrentPage(1);
    onShowToast(`'${newEmp.emp_name}' 직원이 등록되었습니다.`);
  };

  // Build visible page numbers (show max 5)
  const pageNumbers: number[] = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

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
              paginated.map((emp, idx) => {
                const isFirst = idx === 0 && currentPage === 1;
                const pwVisible = visiblePwIds.has(emp.emp_id);
                return (
                  <tr key={emp.emp_id} className="tm-row">
                    <td className="tm-cell-name">{emp.emp_name}</td>
                    <td className="tm-cell-id">{emp.login_id}</td>
                    <td className="tm-cell-pw">
                      <button
                        type="button"
                        className="tm-eye-btn"
                        onClick={() => togglePwVisible(emp.emp_id)}
                        title={pwVisible ? "숨기기" : "보기"}
                      >
                        {pwVisible ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                      <span className="tm-pw-text">
                        {pwVisible ? emp.login_pw : "••••••••"}
                      </span>
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
    </div>
  );
}
