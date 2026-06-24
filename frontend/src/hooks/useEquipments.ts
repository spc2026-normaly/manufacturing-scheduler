import { useState, useEffect } from "react";
import { Equipment, UpcomingEquipment } from "../types/equipment";
import { fetchEquipments, fetchUpcomingEquipments } from "../services/equipmentService";

export function useEquipments() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [upcomingEquipments, setUpcomingEquipments] = useState<UpcomingEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Fetch entire equipments
      const eqRes = await fetchEquipments();

      if (eqRes.status === 403) {
        setIsForbidden(true);
        setLoading(false);
        return;
      }

      let eqData: Equipment[] = [];
      if (eqRes.ok) {
        eqData = await eqRes.json();
        setEquipments(eqData);
      }

      // 2. Fetch upcoming check equipments (7 days limit)
      const upRes = await fetchUpcomingEquipments(7);
      if (upRes.ok) {
        const upData: Equipment[] = await upRes.json();
        const mappedUpcoming = upData.map((item) => {
          const today = new Date();
          const target = new Date(item.check_date);
          const diffTime = target.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return {
            eq_name: item.eq_name,
            check_date: item.check_date,
            dday: diffDays >= 0 ? `D-${diffDays}` : "만료"
          };
        });
        setUpcomingEquipments(mappedUpcoming);
      }
    } catch (err) {
      console.error("Failed to fetch equipment dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const normalEquipmentsCount = equipments.filter(e => e.eq_status === "정상").length;

  const metrics = [
    { title: "전체 장비", value: String(equipments.length), unit: "대" },
    { title: "사용 가능 장비 수", value: String(normalEquipmentsCount), unit: "대" },
    { title: "점검 예정 장비", value: String(upcomingEquipments.length), unit: "건" }
  ];

  return {
    equipments,
    upcomingEquipments,
    loading,
    isForbidden,
    metrics,
    refetch: fetchData
  };
}
