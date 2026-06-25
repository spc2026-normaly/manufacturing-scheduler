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
}: GanttMonthViewProps) {

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

  return (
    <div>
      <div className={styles.ganttTitleRow}>
        <div className={styles.ganttFilters}>
          <select
            className={styles.ganttSelect}
            value={ganttGroupBy}
            onChange={(e) => setGanttGroupBy(e.target.value as "facility" | "order")}
            style={{ fontWeight: "bold", borderColor: "#3b82f6", color: "#2563eb" }}
          >
            <option value="facility">정렬 기준: 공장동별</option>
            <option value="order">정렬 기준: 주문번호별</option>
          </select>
          <select
            className={styles.ganttSelect}
            value={factoryFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFactoryFilter(e.target.value)}
          >
            <option value="전체">공장 선택 - 전체 공장</option>
            <option value="A공장동">A공장동</option>
            <option value="B공장동">B공장동</option>
            <option value="C공장동">C공장동</option>
            <option value="D공장동">D공장동</option>
            <option value="E공장동">E공장동</option>
            <option value="F공장동">F공장동</option>
            <option value="G공장동">G공장동</option>
          </select>
          <select
            className={styles.ganttSelect}
            style={{ minWidth: "180px" }}
            value={orderNumFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setOrderNumFilter(e.target.value)}
          >
            <option value="">주문번호 선택 - 전체</option>
            {ordersList.map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>
        <span className={styles.ganttTitle}>생산 일정 캘린더 ({selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월)</span>
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

                return uniqueOrderNums.map((orderNum, idx) => {
                  const orderTasks = facilityTasks.filter((t) => t.orderNum === orderNum);
                  const productName = orderTasks[0]?.product || "";
                  const isFirstForFacility = idx === 0;

                  return (
                    <tr key={`${facility}_${orderNum}`} className={styles.eqRow}>
                      {isFirstForFacility && (
                        <td className={styles.ganttColFacility} rowSpan={uniqueOrderNums.length}>
                          {facility}
                        </td>
                      )}
                      <td className={styles.ganttColTask}>{orderNum}</td>
                      <td className={styles.ganttColEq}>{productName}</td>
                      {monthWeeks.map((_, weekIndex) => {
                        const task = orderTasks.find((t) => t.startWeek === weekIndex);
                        const isWithin = orderTasks.some((t) => weekIndex > t.startWeek && weekIndex <= t.endWeek);

                        if (isWithin) {
                          return null;
                        }

                        const colSpan = task ? (task.endWeek - task.startWeek + 1) : 1;

                        return (
                          <td
                            key={weekIndex}
                            colSpan={colSpan}
                            className={styles.ganttCellDay}
                          >
                            {task && (
                              <div
                                className={`${styles.ganttBlock} ${getColorClass(task.colorClass)}`}
                                onMouseEnter={(e) => {
                                  setHoveredTask(task);
                                  handleMouseMove(e);
                                }}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={() => setHoveredTask(null)}
                                onClick={() => {
                                  setSelectedDate(monthWeeks[weekIndex].monday);
                                  setCurrentTab("day");
                                  showToast(`${monthWeeks[weekIndex].label} 상세 계획으로 이동했습니다.`);
                                }}
                              >
                                {task.taskName}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
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

                return uniqueFacilities.map((facility, idx) => {
                  const facilityOrderTasks = orderTasks.filter((t) => t.facility === facility);
                  const isFirstForOrder = idx === 0;

                  return (
                    <tr key={`${orderNum}_${facility}`} className={styles.eqRow}>
                      {isFirstForOrder && (
                        <>
                          <td className={styles.ganttColTask} rowSpan={uniqueFacilities.length} style={{ fontWeight: "700", textAlign: "center", backgroundColor: "#f8fafc" }}>
                            {orderNum}
                          </td>
                          <td className={styles.ganttColEq} rowSpan={uniqueFacilities.length} style={{ fontWeight: "600", fontSize: "13px" }}>
                            {productName}
                          </td>
                        </>
                      )}
                      <td className={styles.ganttColFacility} style={{ color: "#1e3a8a", fontWeight: "700", textAlign: "center", backgroundColor: "#f8fafc" }}>
                        {facility}
                      </td>
                      {monthWeeks.map((_, weekIndex) => {
                        const task = facilityOrderTasks.find((t) => t.startWeek === weekIndex);
                        const isWithin = facilityOrderTasks.some((t) => weekIndex > t.startWeek && weekIndex <= t.endWeek);

                        if (isWithin) {
                          return null;
                        }

                        const colSpan = task ? (task.endWeek - task.startWeek + 1) : 1;

                        return (
                          <td
                            key={weekIndex}
                            colSpan={colSpan}
                            className={styles.ganttCellDay}
                          >
                            {task && (
                              <div
                                className={`${styles.ganttBlock} ${getColorClass(task.colorClass)}`}
                                onMouseEnter={(e) => {
                                  setHoveredTask(task);
                                  handleMouseMove(e);
                                }}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={() => setHoveredTask(null)}
                                onClick={() => {
                                  setSelectedDate(monthWeeks[weekIndex].monday);
                                  setCurrentTab("day");
                                  showToast(`${monthWeeks[weekIndex].label} 상세 계획으로 이동했습니다.`);
                                }}
                              >
                                {task.taskName}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
