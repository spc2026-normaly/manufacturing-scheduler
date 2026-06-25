"use client";

import React, { useState, useMemo, useEffect } from "react";

interface TrainingStatus {
  state: "completed" | "warning_mid" | "warning_high" | "expired" | "none";
  date?: string;
  dday?: string;
}

interface WorkerSafetyData {
  emp_name: string;
  login_id: string;
  trainings: TrainingStatus[];
}

interface ApiEmployee {
  emp_id: string;
  login_id: string;
  emp_name: string;
  emp_role: string;
  emp_date: string;
}

interface ApiSafetyTraining {
  training_id: string;
  emp_id: string;
  training_name: string;
  training_date: string;
  expired_date: string;
  training_status: string;
}

export default function SafetyTrainingPage() {
  const [workersData, setWorkersData] = useState<WorkerSafetyData[]>([]);
  const [trainingNames, setTrainingNames] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ emp_id: string; emp_name: string; emp_role: string; login_id: string } | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [todayStr, setTodayStr] = useState("");

  const getAuthHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return { "Content-Type": "application/json", "Authorization": token ? `Bearer ${token}` : "" };
  };

  const calculateTrainingStatus = (expiredDateStr: string): { state: TrainingStatus["state"]; dday: string } => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const baseDate = new Date(todayStr);
    const targetDate = new Date(expiredDateStr);
    const diffDays = Math.ceil((targetDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { state: "expired", dday: "만료" };
    else if (diffDays <= 7) return { state: "warning_high", dday: `D-${diffDays}` };
    else if (diffDays <= 30) return { state: "warning_mid", dday: `D-${diffDays}` };
    else return { state: "completed", dday: `D-${diffDays}` };
  };

  const fetchSafetyTrainings = async () => {
    try {
      const headers = getAuthHeaders();
      const meRes = await fetch("/api/auth/me", { headers });
      if (meRes.status === 403) { setIsForbidden(true); setLoading(false); return; }
      if (!meRes.ok) throw new Error("Failed to fetch current user");
      const meData = await meRes.json();
      setCurrentUser(meData);

      const tnRes = await fetch("/api/safety-trainings/training-names", { headers });
      if (tnRes.status === 403) { setIsForbidden(true); setLoading(false); return; }
      let names: string[] = [];
      if (tnRes.ok) {
        const tnData = await tnRes.json();
        names = tnData.training_names || [];
        setTrainingNames(names);
      }

      let employees: ApiEmployee[] = [];
      let trainingUrl = "/api/safety-trainings";

      if (meData.emp_role === "leader") {
        const empRes = await fetch("/api/employees?limit=500", { headers });
        if (empRes.status === 403) { setIsForbidden(true); setLoading(false); return; }
        if (!empRes.ok) throw new Error("Failed to fetch employees");
        const empResult = await empRes.json();
        employees = empResult.items;
      } else {
        employees = [{ emp_id: meData.emp_id, login_id: meData.login_id, emp_name: meData.emp_name, emp_role: meData.emp_role, emp_date: "" }];
        trainingUrl += `?emp_id=${meData.emp_id}`;
      }

      const trainingRes = await fetch(trainingUrl, { headers });
      if (trainingRes.status === 403) { setIsForbidden(true); setLoading(false); return; }
      if (!trainingRes.ok) throw new Error("Failed to fetch safety trainings");
      const trainings: ApiSafetyTraining[] = await trainingRes.json();

      const mappedWorkers: WorkerSafetyData[] = employees.map((emp) => {
        const empTrainings = trainings.filter((t) => t.emp_id === emp.emp_id);
        const trainingMap = new Map<string, TrainingStatus>();
        empTrainings.forEach((record) => {
          const statusCalc = calculateTrainingStatus(record.expired_date);
          trainingMap.set(record.training_name, { state: statusCalc.state, date: record.expired_date.replace(/-/g, "."), dday: statusCalc.dday });
        });
        const sourceNames = names.length > 0 ? names : ["안전교육1","안전교육2","안전교육3","안전교육4","안전교육5"];
        return { emp_name: emp.emp_name, login_id: emp.login_id, trainings: sourceNames.map((name) => trainingMap.get(name) || { state: "none" }) };
      });

      setWorkersData(mappedWorkers);
    } catch (err) {
      console.error("Failed to map safety trainings data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setTodayStr(`${yyyy}.${mm}.${dd}`);
    fetchSafetyTrainings();
  }, []);

  const filteredWorkers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return workersData;
    return workersData.filter((w) => w.emp_name.toLowerCase().includes(q));
  }, [workersData, searchQuery]);

  const stats = useMemo(() => {
    let totalCount = 0, completed = 0, warningMid = 0, warningHigh = 0, expired = 0;
    workersData.forEach((w) => {
      w.trainings.forEach((t) => {
        if (t.state !== "none") {
          totalCount++;
          if (t.state === "completed") completed++;
          else if (t.state === "warning_mid") warningMid++;
          else if (t.state === "warning_high") warningHigh++;
          else if (t.state === "expired") expired++;
        }
      });
    });
    return { totalCount, completed, warningMid, warningHigh, expired };
  }, [workersData]);

  const completedRate = stats.totalCount > 0 ? Math.round((stats.completed / stats.totalCount) * 100) : 0;
  const expiredRate = stats.totalCount > 0 ? Math.round((stats.expired / stats.totalCount) * 100) : 0;
  const warningRate = stats.totalCount > 0 ? (100 - completedRate - expiredRate) : 0;

  const renderBadge = (training: TrainingStatus) => {
    switch (training.state) {
      case "completed": return <div className="st-badge badge-green"><span className="badge-title">완료</span><span className="badge-date">{training.date}</span><span className="badge-dday">({training.dday})</span></div>;
      case "warning_mid": return <div className="st-badge badge-yellow"><span className="badge-title">7~30일</span><span className="badge-date">{training.date}</span><span className="badge-dday">({training.dday})</span></div>;
      case "warning_high": return <div className="st-badge badge-red"><span className="badge-title">7일 이하</span><span className="badge-date">{training.date}</span><span className="badge-dday">({training.dday})</span></div>;
      case "expired": return <div className="st-badge badge-gray"><span className="badge-title">만료</span><span className="badge-date">{training.date}</span><span className="badge-dday text-alert">({training.dday})</span></div>;
      default: return <div className="st-badge badge-none"><span className="badge-title">미완료</span><span className="badge-date">-</span></div>;
    }
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", color: "#64748b" }}>데이터 로딩 중...</div>;

  if (isForbidden) return (
    <div style={{ padding: "40px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div style={{ padding: "40px", textAlign: "center", border: "1px solid #fecaca", borderRadius: "12px", backgroundColor: "#fff", maxWidth: "500px", width: "100%" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚫</div>
        <h2 style={{ color: "#dc2626", fontSize: "20px", fontWeight: "bold" }}>접근 권한이 없습니다</h2>
        <p style={{ color: "#4b5563", marginTop: "8px", fontSize: "14px" }}>이 데이터를 조회할 수 있는 권한이 없습니다.</p>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`
        .st-search-box { position: relative; width: 220px; }
        .st-search-input { width: 100%; padding: 6px 32px 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none; background-color: #ffffff; color: #1e293b; transition: all 0.2s ease; }
        .st-search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
        .st-search-icon { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #94a3b8; pointer-events: none; }
        .st-table { width: 100%; border-collapse: collapse; text-align: left; }
        .st-table th { background-color: #f8fafc; padding: 12px 24px; font-size: 13px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; white-space: nowrap; position: sticky; top: 0; z-index: 1; }
        .st-table td { padding: 14px 24px; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .st-row:hover { background-color: #f8fafc; }
        .st-cell-name { font-weight: 600; color: #0f172a; }
        .st-cell-id { color: #64748b; font-family: monospace; }
        .st-badge { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; min-width: 110px; text-align: center; line-height: 1.3; border: 1px solid transparent; }
        .st-badge .badge-title { font-size: 11px; font-weight: 700; }
        .st-badge .badge-date { font-size: 10px; font-weight: 400; margin-top: 1px; opacity: 0.85; white-space: nowrap; }
        .st-badge .badge-dday { font-size: 10px; font-weight: 700; margin-top: 1px; }
        .st-badge .badge-dday.text-alert { color: #ef4444; }
        .badge-green { background-color: #e6f4ea; color: #137333; border-color: #ceead6; }
        .badge-yellow { background-color: #fff3e0; color: #e65100; border-color: #ffcc80; }
        .badge-red { background-color: #fce8e6; color: #c5221f; border-color: #fad2cf; }
        .badge-gray { background-color: #f1f3f4; color: #5f6368; border-color: #dadce0; }
        .badge-none { background-color: #fafafa; color: #94a3b8; border-color: #f1f5f9; }
        .st-empty-cell { text-align: center; padding: 40px !important; color: #64748b; font-size: 14px; }
        .st-progress-multi { display: flex; height: 10px; width: 100%; background-color: #f1f5f9; border-radius: 5px; overflow: hidden; }
        .st-progress-sec { height: 100%; transition: width 0.3s ease; }
        .st-progress-sec.completed { background-color: #22c55e; }
        .st-progress-sec.warning { background-color: #f97316; }
        .st-progress-sec.expired { background-color: #ef4444; }
      `}</style>

      {/* 헤더 */}
      {currentUser?.emp_role !== "member" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "16px 24px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>오늘 날짜 : {todayStr}</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", cursor: "pointer", fontSize: 13, color: "#334155", background: "#fff", whiteSpace: "nowrap" }}>
              📎 {selectedFile ? selectedFile.name.slice(0, 12) + "..." : "CSV 파일 선택"}
              <input type="file" accept=".csv" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
            </label>
            <button
              onClick={async () => {
                if (!selectedFile) { setUploadMessage("파일을 선택하세요."); return; }
                setUploadLoading(true); setUploadMessage(null);
                try {
                  const form = new FormData();
                  form.append("file", selectedFile as Blob, (selectedFile as File).name);
                  const token = localStorage.getItem("token");
                  const res = await fetch(`/api/safety-trainings/upload/csv`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form });
                  if (!res.ok) { const text = await res.text(); throw new Error(text || res.statusText); }
                  setUploadMessage("업로드 성공!");
                  await fetchSafetyTrainings();
                } catch (err: any) {
                  setUploadMessage(`실패: ${err?.message || err}`);
                } finally { setUploadLoading(false); }
              }}
              disabled={uploadLoading || !selectedFile}
              style={{ padding: "8px 16px", borderRadius: 8, background: selectedFile ? "#2563eb" : "#94a3b8", color: "#fff", border: "none", cursor: selectedFile ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}
            >
              {uploadLoading ? "업로드 중..." : "업로드"}
            </button>
            {uploadMessage && <span style={{ fontSize: 12, color: uploadMessage.includes("실패") ? "#ef4444" : "#22c55e", whiteSpace: "nowrap" }}>{uploadMessage}</span>}
            <div className="st-search-box">
              <input type="text" className="st-search-input" placeholder="이름 검색" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <span className="st-search-icon">🔍</span>
            </div>
          </div>
        </div>
      )}

      {/* 범례 */}
      {currentUser?.emp_role !== "member" && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, fontSize: 12, color: "#64748b" }}>
          {[["#22c55e","30일 이상"],["#f97316","7~30일"],["#ef4444","7일 이하"],["#94a3b8","만료"],["#cbd5e1","미완료"]].map(([color, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* 테이블 */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", padding: "20px 24px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{currentUser?.emp_role === "member" ? `${currentUser.emp_name}님의 안전 교육 현황` : "직원별 교육 현황 (만료일 표시)"}</span>
          {currentUser?.emp_role === "member" && <span style={{ fontSize: 13, fontWeight: "normal", color: "#64748b" }}>오늘 날짜 : {todayStr}</span>}
        </div>
        <div style={{ overflowX: "auto", maxHeight: "520px", overflowY: "auto" }}>
          <table className="st-table">
            <thead>
              <tr>
                <th style={{ minWidth: 150 }}>직원명</th>
                <th style={{ minWidth: 100 }}>아이디</th>
                {(trainingNames.length > 0 ? trainingNames : ["안전교육1","안전교육2","안전교육3","안전교육4","안전교육5"]).map((name, idx) => (
                  <th key={idx} style={{ minWidth: 110 }}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.length > 0 ? filteredWorkers.map((w, idx) => (
                <tr key={w.login_id} className="st-row" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <td className="st-cell-name">{w.emp_name}</td>
                  <td className="st-cell-id">{w.login_id}</td>
                  {(w.trainings || []).map((t, i) => <td key={i}>{renderBadge(t)}</td>)}
                </tr>
              )) : (
                <tr><td colSpan={(trainingNames.length || 5) + 2} className="st-empty-cell">검색 결과와 일치하는 직원이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}