const getAuthHeaders = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    "Authorization": token ? `Bearer ${token}` : ""
  };
};

export async function checkBackendHealth(): Promise<Response> {
  return fetch("/api/health");
}

export async function fetchEmployeesCount(): Promise<Response> {
  return fetch("/api/employees?limit=1", { headers: getAuthHeaders() });
}

export async function fetchSafetyTrainings(): Promise<Response> {
  return fetch("/api/safety-trainings", { headers: getAuthHeaders() });
}

export async function fetchAllEquipments(): Promise<Response> {
  return fetch("/api/equipments", { headers: getAuthHeaders() });
}

export async function fetchCalendarSummary(
  view: string,
  dateStr: string,
  factoryFilter: string
): Promise<Response> {
  const params = new URLSearchParams({
    view,
    date: dateStr,
  });

  if (factoryFilter !== "전체 공장") {
    params.append("factory", factoryFilter);
  }

  return fetch(`/api/schedules/calendar?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
}

export async function fetchDocuments(): Promise<Response> {
  return fetch("/api/documents", { headers: getAuthHeaders() });
}
