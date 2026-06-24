const getAuthHeaders = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    "Authorization": token ? `Bearer ${token}` : ""
  };
};

export async function fetchEquipments(): Promise<Response> {
  return fetch("/api/equipments", { headers: getAuthHeaders() });
}

export async function fetchUpcomingEquipments(days: number = 7): Promise<Response> {
  return fetch(`/api/equipments?upcoming_days=${days}`, { headers: getAuthHeaders() });
}
