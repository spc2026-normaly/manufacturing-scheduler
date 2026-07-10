import { useState, useEffect, useMemo } from "react";
import { TrainingStatus, WorkerSafetyData, ApiEmployee, ApiSafetyTraining } from "../types/safetyTraining";
import { fetchCurrentUser, fetchEmployees, fetchSafetyTrainings } from "../services/safetyTrainingService";

export function useSafetyTraining() {
  const [workersData, setWorkersData] = useState<WorkerSafetyData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ emp_id: string; emp_name: string; emp_role: string; login_id: string } | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  // Helper to calculate D-Day relative to base date
  const calculateTrainingStatus = (expiredDateStr: string): { state: TrainingStatus["state"]; dday: string } => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const baseDate = new Date(todayStr);
    const targetDate = new Date(expiredDateStr);
    const diffTime = targetDate.getTime() - baseDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { state: "expired", dday: "만료" };
    } else if (diffDays <= 7) {
      return { state: "warning_high", dday: `D-${diffDays}` };
    } else if (diffDays <= 30) {
      return { state: "warning_mid", dday: `D-${diffDays}` };
    } else {
      return { state: "completed", dday: `D-${diffDays}` };
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch current user details
      const meRes = await fetchCurrentUser();
      if (meRes.status === 403) {
        setIsForbidden(true);
        setLoading(false);
        return;
      }
      if (!meRes.ok) throw new Error("Failed to fetch current user");
      const meData = await meRes.json();
      setCurrentUser(meData);

      // Fetch employees based on role
      let employees: ApiEmployee[] = [];
      let trainingRes: Response;

      if (meData.emp_role === "leader") {
        const empRes = await fetchEmployees(500);
        if (empRes.status === 403) {
          setIsForbidden(true);
          setLoading(false);
          return;
        }
        if (!empRes.ok) throw new Error("Failed to fetch employees");
        const empResult = await empRes.json();
        employees = empResult.items;
        
        trainingRes = await fetchSafetyTrainings();
      } else {
        employees = [{
          emp_id: meData.emp_id,
          login_id: meData.login_id,
          emp_name: meData.emp_name,
          emp_role: meData.emp_role,
          emp_date: ""
        }];
        
        trainingRes = await fetchSafetyTrainings(meData.emp_id);
      }

      if (trainingRes.status === 403) {
        setIsForbidden(true);
        setLoading(false);
        return;
      }
      if (!trainingRes.ok) throw new Error("Failed to fetch safety trainings");
      const trainings: ApiSafetyTraining[] = await trainingRes.json();

      // Process and map trainings for each employee
      const mappedWorkers: WorkerSafetyData[] = employees.map((emp) => {
        const empTrainings = trainings.filter((t) => t.emp_id === emp.emp_id);
        const trainingsList: TrainingStatus[] = Array(5).fill(null).map(() => ({ state: "none" }));
        let normalIndex = 1;

        empTrainings.forEach((record) => {
          const name = record.training_name;
          const statusCalc = calculateTrainingStatus(record.expired_date);
          const trainingObj: TrainingStatus = {
            state: statusCalc.state,
            date: record.expired_date.replace(/-/g, "."),
            dday: statusCalc.dday
          };

          if (name === "정기 안전 교육" || name === "안전교육1") {
            trainingsList[0] = trainingObj;
          } else {
            if (normalIndex < 5) {
              trainingsList[normalIndex] = trainingObj;
              normalIndex++;
            }
          }
        });

        return {
          emp_name: emp.emp_name,
          login_id: emp.login_id,
          trainings: trainingsList as WorkerSafetyData["trainings"]
        };
      });

      setWorkersData(mappedWorkers);
    } catch (err) {
      console.error("Failed to map safety trainings data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleDataUpdated = () => {
      console.log("[useSafetyTraining] received 'data-updated' event, reloading safety training data...");
      loadData();
    };
    window.addEventListener("data-updated", handleDataUpdated);
    return () => {
      window.removeEventListener("data-updated", handleDataUpdated);
    };
  }, []);

  const filteredWorkers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return workersData;
    return workersData.filter((w) =>
      w.emp_name.toLowerCase().includes(q)
    );
  }, [workersData, searchQuery]);

  const stats = useMemo(() => {
    let totalCount = 0;
    let completed = 0;
    let warningMid = 0;
    let warningHigh = 0;
    let expired = 0;

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

  return {
    workersData,
    searchQuery,
    setSearchQuery,
    loading,
    currentUser,
    isForbidden,
    filteredWorkers,
    stats,
    completedRate,
    expiredRate,
    warningRate,
    refetch: loadData
  };
}
