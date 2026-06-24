const getAuthHeaders = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    "Authorization": token ? `Bearer ${token}` : ""
  };
};

export async function fetchCurrentUser(): Promise<Response> {
  return fetch("/api/auth/me", { headers: getAuthHeaders() });
}

export async function fetchEmployees(limit: number = 500): Promise<Response> {
  return fetch(`/api/employees?limit=${limit}`, { headers: getAuthHeaders() });
}

export async function fetchSafetyTrainings(empId?: string): Promise<Response> {
  const url = empId ? `/api/safety-trainings?emp_id=${empId}` : "/api/safety-trainings";
  return fetch(url, { headers: getAuthHeaders() });
}
