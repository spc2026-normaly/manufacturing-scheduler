import React from "react";
import { TabType, MonthWeek, ProductionTask } from "../../types/schedule";
import styles from "./GanttMonthView.module.css";

interface GanttMonthViewProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  setCurrentTab: (tab: TabType) => void;
  tasks: ProductionTask[];
  factoryFilter: string;
  setFactoryFilter: (filter: string) => void;
  orderNumFilter: string;
  setOrderNumFilter: (filter: string) => void;
  ganttGroupBy: "facility" | "order";
  setGanttGroupBy: (group: "facility" | "order") => void;
  ordersList: string[];
  monthWeeks: MonthWeek[];
  currentWeekIndexInMonth: number;
  setHoveredTask: (task: ProductionTask | null) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  showToast: (msg: string) => void;
  handleMoveTask: (taskId: string, targetWeekIndex: number) => void;
  isEditMode: boolean;
  setIsEditMode: (val: boolean) => void;
}

export function GanttMonthView({
  selectedDate,
  setSelectedDate,
  setCurrentTab,
  tasks,
  factoryFilter,
  setFactoryFilter,
  orderNumFilter,
  setOrderNumFilter,
  ganttGroupBy,
  setGanttGroupBy,
  ordersList,
  monthWeeks,
  currentWeekIndexInMonth,
  setHoveredTask,
  handleMouseMove,
  showToast,
  handleMoveTask,
  isEditMode,
  setIsEditMode,
}: GanttMonthViewProps) {

  const [collapsedOrders, setCollapsedOrders] = React.useState<Record<string, boolean>>({});

  // Helper to map colorClass name to local CSS Module style key
  const getColorClass = (colorClass: string) => {
    switch (colorClass) {
      case "bar-green": return styles.barGreen;
      case "bar-blue": return styles.barBlue;
      case "bar-orange": return styles.barOrange;
      case "bar-purple": return styles.barPurple;
      case "bar-teal": return styles.barTeal;
      case "bar-pink": return styles.barPink;
      case "bar-indigo": return styles.barIndigo;
      default: return styles.barPurple;
    }
  };

  // 전체 접기/펼치기 핸들러
  const handleCollapseAll = () => {
    const newCollapsed: Record<string, boolean> = {};
    tasks.forEach((t) => {
      newCollapsed[`${t.facility}_${t.orderNum}`] = true;
      newCollapsed[`${t.orderNum}_${t.facility}`] = true;
    });
    setCollapsedOrders(newCollapsed);
    showToast("📁 모든 일정을 접었습니다.");
  };

  const handleExpandAll = () => {
    setCollapsedOrders({});
    showToast("📂 모든 일정을 펼쳤습니다.");
  };

  return (
    <div className={`${styles.ganttContainer} animate-in`}>
      <div className={styles.ganttHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select
            className={styles.ganttSelect}
            value={ganttGroupBy}
            onChange={(e) => setGanttGroupBy(e.target.value as "facility" | "order")}
          >
            <option value="facility">공장동 기준 정렬</option>
            <option value="order">주문번호 기준 정렬</option>
          </select>
          <select
            className={styles.ganttSelect}
            value={factoryFilter}
            onChange={(e) => setFactoryFilter(e.target.value)}
          >
            <option value="">공장동 선택 - 전체</option>
            <option value="A동">A동 (확산/세정/금속)</option>
            <option value="B동">B동 (식각/이온주입)</option>
            <option value="C동">C동 (박막/노광)</option>
            <option value="D공장동">D공장동</option>
            <option value="E공장동">E공장동</option>
            <option value="F공장동">F공장동</option>
            <option value="G공장동">G공장동</option>
          </select>
          <select
            className={styles.ganttSelect}
            style={{ minWidth: "180px" }}
            value={orderNumFilter}
            onChange={(e) => setOrderNumFilter(e.target.value)}
          >
            <option value="">주문번호 선택 - 전체</option>
            {ordersList.map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>

          {/* 전체 접기/펼치기 버튼 */}
          <button
            onClick={handleExpandAll}
            className={styles.ganttTextBtn}
            style={{
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              color: "#334155",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              marginLeft: "10px"
            }}
          >
            📂 전체 펼치기
          </button>
          <button
            onClick={handleCollapseAll}
            className={styles.ganttTextBtn}
            style={{
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              color: "#334155",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            📁 전체 접기
          </button>
        </div>

        {/* 편집 모드 토글 버튼 우측 정렬 */}
        <button
          className={`${styles.editModeBtn} ${isEditMode ? styles.active : ""}`}
          onClick={() => {
            setIsEditMode(!isEditMode);
            showToast(
              isEditMode
                ? "🔒 일정 편집 모드가 비활성화되었습니다. (드래그 불가)"
                : "🔓 일정 편집 모드가 활성화되었습니다! 주간 블록을 드래그해서 자유롭게 일정을 이동해보세요."
            );
          }}
          style={{
            background: isEditMode ? "linear-gradient(135deg, #fef2f2, #fee2e2)" : "white",
            border: isEditMode ? "1.5px solid #f87171" : "1.5px solid #d1d5db",
            color: isEditMode ? "#dc2626" : "#374151",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "12.5px",
            fontWeight: "600",
            cursor: "pointer",
            boxShadow: isEditMode ? "0 0 8px rgba(239, 68, 68, 0.15)" : "none",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          {isEditMode ? "🔒 일정 편집 모드 종료" : "✏️ 일정 드래그 편집"}
        </button>
      </div>

      <div className={styles.ganttWrapper}>
        {ganttGroupBy === "facility" ? (
          <table className={styles.ganttTable}>
            <thead>
              <tr>
                <th>공장동</th>
                <th>주문번호</th>
                <th>생산제품</th>
                {monthWeeks.map((week, index) => {
                  const isCurrent = index === currentWeekIndexInMonth;
                  return (
                    <th
                      key={index}
                      className={`${styles.ganttHeaderDay} ${isCurrent ? styles.currentWeekHeader : ""}`}
                      style={{ position: "relative" }}
                    >
                      {isCurrent && <span className={styles.currentWeekBadge}>이번 주</span>}
                      {week.label}
                      <div style={{ fontSize: "10px", fontWeight: "normal", color: isCurrent ? "#2563eb" : "#64748b", marginTop: "2px" }}>
                        ({week.range})
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set(tasks.map((t) => t.facility))).map((facility) => {
                const facilityTasks = tasks.filter((t) => t.facility === facility);
                const uniqueOrderNums = Array.from(new Set(facilityTasks.map((t) => t.orderNum)));
                
                // 접힌 상태를 반영하여 공장동 rowSpan 계산
                let totalFacilityRows = 0;
                uniqueOrderNums.forEach((oNum) => {
                  const oTasks = facilityTasks.filter((t) => t.orderNum === oNum);
                  const isCol = !!collapsedOrders[`${facility}_${oNum}`];
                  totalFacilityRows += isCol ? 1 : oTasks.length;
                });
                
                let facilityRowRendered = false;

                return uniqueOrderNums.map((orderNum) => {
                  const orderTasks = facilityTasks.filter((t) => t.orderNum === orderNum);
                  const productName = orderTasks[0]?.product || "";
                  const key = `${facility}_${orderNum}`;
                  const isCollapsed = !!collapsedOrders[key];

                  return orderTasks.map((task, taskIdx) => {
                    // 접힌 상태에서는 첫 번째 작업(0번째) 외의 서브행은 렌더링하지 않음
                    if (isCollapsed && taskIdx > 0) return null;

                    const isFirstForFacility = !facilityRowRendered;
                    facilityRowRendered = true;
                    const isFirstForOrder = taskIdx === 0;

                    return (
                      <tr key={task.id} className={styles.eqRow}>
                        {isFirstForFacility && (
                          <td className={styles.ganttColFacility} rowSpan={totalFacilityRows}>
                            {facility}
                          </td>
                        )}
                        {isFirstForOrder && (
                          <td className={styles.ganttColTask} rowSpan={isCollapsed ? 1 : orderTasks.length}>
                            <button
                              onClick={() => setCollapsedOrders(prev => ({ ...prev, [key]: !prev[key] }))}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                marginRight: "6px",
                                padding: 0,
                                fontSize: "11px",
                                color: "#3b82f6",
                                fontWeight: "bold"
                              }}
                              title={isCollapsed ? "상세 공정 펼치기" : "공정 접기"}
                            >
                              {isCollapsed ? "▶" : "▼"}
                            </button>
                            {orderNum}
                          </td>
                        )}
                        {isFirstForOrder && (
                          <td className={styles.ganttColEq} rowSpan={isCollapsed ? 1 : orderTasks.length}>
                            {productName}
                          </td>
                        )}
                        {monthWeeks.map((_, weekIndex) => {
                          const isStart = task.startWeek === weekIndex;
                          const isWithin = weekIndex > task.startWeek && weekIndex <= task.endWeek;

                          if (isWithin) {
                            return null;
                          }

                          const colSpan = isStart ? (task.endWeek - task.startWeek + 1) : 1;

                          return (
                            <td
                              key={weekIndex}
                              colSpan={colSpan}
                              className={styles.ganttCellDay}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                const dragId = e.dataTransfer.getData("taskId");
                                if (dragId) handleMoveTask(dragId, weekIndex);
                              }}
                            >
                              {isStart && (
                                <div
                                  className={`${styles.ganttBlock} ${getColorClass(task.colorClass)}`}
                                  draggable={isEditMode}
                                  onDragStart={(e) => {
                                    if (!isEditMode) return;
                                    e.dataTransfer.setData("taskId", task.id);
                                  }}
                                  onMouseEnter={(e) => {
                                    setHoveredTask(task);
                                    handleMouseMove(e);
                                  }}
                                  onMouseMove={handleMouseMove}
                                  onMouseLeave={() => setHoveredTask(null)}
                                  onClick={() => {
                                    if (isEditMode) return;
                                    setSelectedDate(monthWeeks[weekIndex].monday);
                                    setCurrentTab("day");
                                    showToast(`${monthWeeks[weekIndex].label} 상세 계획으로 이동했습니다.`);
                                  }}
                                  style={{ cursor: isEditMode ? "grab" : "pointer" }}
                                >
                                  <span>{task.taskName}</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                });
              })}
            </tbody>
          </table>
        ) : (
          <table className={styles.ganttTable}>
            <thead>
              <tr>
                <th>주문번호</th>
                <th>생산제품</th>
                <th>공장동</th>
                {monthWeeks.map((week, index) => {
                  const isCurrent = index === currentWeekIndexInMonth;
                  return (
                    <th
                      key={index}
                      className={`${styles.ganttHeaderDay} ${isCurrent ? styles.currentWeekHeader : ""}`}
                      style={{ position: "relative" }}
                    >
                      {isCurrent && <span className={styles.currentWeekBadge}>이번 주</span>}
                      {week.label}
                      <div style={{ fontSize: "10px", fontWeight: "normal", color: isCurrent ? "#2563eb" : "#64748b", marginTop: "2px" }}>
                        ({week.range})
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set(tasks.map((t) => t.orderNum))).map((orderNum) => {
                const orderTasks = tasks.filter((t) => t.orderNum === orderNum);
                const uniqueFacilities = Array.from(new Set(orderTasks.map((t) => t.facility)));
                const productName = orderTasks[0]?.product || "";
                
                // 접힌 상태를 반영하여 주문별 rowSpan 계산
                let totalOrderRows = 0;
                uniqueFacilities.forEach((fac) => {
                  const fTasks = orderTasks.filter((t) => t.facility === fac);
                  const isCol = !!collapsedOrders[`${orderNum}_${fac}`];
                  totalOrderRows += isCol ? 1 : fTasks.length;
                });
                
                let orderRowRendered = false;

                return uniqueFacilities.map((facility) => {
                  const facilityTasks = orderTasks.filter((t) => t.facility === facility);
                  const key = `${orderNum}_${facility}`;
                  const isCollapsed = !!collapsedOrders[key];

                  return facilityTasks.map((task, taskIdx) => {
                    // 접힌 상태에서는 첫 번째 작업(0번째) 외의 서브행은 렌더링하지 않음
                    if (isCollapsed && taskIdx > 0) return null;

                    const isFirstForOrder = !orderRowRendered;
                    orderRowRendered = true;
                    const isFirstForFacility = taskIdx === 0;

                    return (
                      <tr key={task.id} className={styles.eqRow}>
                        {isFirstForOrder && (
                          <td className={styles.ganttColTask} rowSpan={totalOrderRows} style={{ fontWeight: "700", textAlign: "center", backgroundColor: "#f8fafc" }}>
                            {orderNum}
                          </td>
                        )}
                        {isFirstForOrder && (
                          <td className={styles.ganttColEq} rowSpan={totalOrderRows} style={{ fontWeight: "600", fontSize: "13px" }}>
                            {productName}
                          </td>
                        )}
                        {isFirstForFacility && (
                          <td className={styles.ganttColFacility} rowSpan={isCollapsed ? 1 : facilityTasks.length} style={{ color: "#1e3a8a", fontWeight: "700", textAlign: "center", backgroundColor: "#f8fafc" }}>
                            <button
                              onClick={() => setCollapsedOrders(prev => ({ ...prev, [key]: !prev[key] }))}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                marginRight: "6px",
                                padding: 0,
                                fontSize: "11px",
                                color: "#3b82f6",
                                fontWeight: "bold"
                              }}
                              title={isCollapsed ? "상세 공정 펼치기" : "공정 접기"}
                            >
                              {isCollapsed ? "▶" : "▼"}
                            </button>
                            {facility}
                          </td>
                        )}
                        {monthWeeks.map((_, weekIndex) => {
                          const isStart = task.startWeek === weekIndex;
                          const isWithin = weekIndex > task.startWeek && weekIndex <= task.endWeek;

                          if (isWithin) {
                            return null;
                          }

                          const colSpan = isStart ? (task.endWeek - task.startWeek + 1) : 1;

                          return (
                            <td
                              key={weekIndex}
                              colSpan={colSpan}
                              className={styles.ganttCellDay}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                const dragId = e.dataTransfer.getData("taskId");
                                if (dragId) handleMoveTask(dragId, weekIndex);
                              }}
                            >
                              {isStart && (
                                <div
                                  className={`${styles.ganttBlock} ${getColorClass(task.colorClass)}`}
                                  draggable={isEditMode}
                                  onDragStart={(e) => {
                                    if (!isEditMode) return;
                                    e.dataTransfer.setData("taskId", task.id);
                                  }}
                                  onMouseEnter={(e) => {
                                    setHoveredTask(task);
                                    handleMouseMove(e);
                                  }}
                                  onMouseMove={handleMouseMove}
                                  onMouseLeave={() => setHoveredTask(null)}
                                  onClick={() => {
                                    if (isEditMode) return;
                                    setSelectedDate(monthWeeks[weekIndex].monday);
                                    setCurrentTab("day");
                                    showToast(`${monthWeeks[weekIndex].label} 상세 계획으로 이동했습니다.`);
                                  }}
                                  style={{ cursor: isEditMode ? "grab" : "pointer" }}
                                >
                                  <span>{task.taskName}</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                });
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
