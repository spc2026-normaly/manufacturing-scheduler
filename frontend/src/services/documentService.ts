const API_BASE = "/api/documents";

const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

export async function fetchDocuments(): Promise<Response> {
  return fetch(API_BASE, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
}

export async function uploadDocument(file: File): Promise<Response> {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
    headers: { Authorization: `Bearer ${getToken()}` },
  });
}

export async function deleteDocument(fileId: string): Promise<Response> {
  return fetch(`${API_BASE}/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
}

export async function downloadDocumentUrl(fileId: string): Promise<string> {
  return `${API_BASE}/${fileId}/download?token=${getToken()}`;
}

export async function generateScheduleFromR2(): Promise<Response> {
  return fetch("/api/schedule/generate-from-r2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });
}

export async function syncR2Data(): Promise<Response> {
  return fetch("/api/documents/sync-r2", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getToken()}`,
      "Content-Type": "application/json"
    }
  });
}
