const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Projects
  getProjects: () => request<any[]>("/projects"),
  getProject: (id: string) => request<any>(`/projects/${id}`),
  deleteProject: (id: string) =>
    request<any>(`/projects/${id}`, { method: "DELETE" }),

  // Graph
  getGraph: (projectId: string, includeDisabled = false) =>
    request<any>(`/projects/${projectId}/graph${includeDisabled ? "?include_disabled=true" : ""}`),

  // Nodes
  getNode: (id: string) => request<any>(`/nodes/${id}`),
  purgeNode: (id: string) =>
    request<any>(`/nodes/${id}/purge`, { method: "DELETE" }),
  getNodeChangelogs: (id: string) => request<any>(`/nodes/${id}/changelogs`),

  // Search
  searchNodes: (projectId: string, query: string, types?: string[], includeDisabled = false) => {
    const params = new URLSearchParams({ project_id: projectId, query });
    if (types?.length) params.set("types", types.join(","));
    if (includeDisabled) params.set("include_disabled", "true");
    params.set("include_path", "true");
    return request<any[]>(`/nodes/search?${params}`);
  },

  // Export
  exportProject: async (projectId: string) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/export`);
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename\*=UTF-8''(.+)/);
    const filename = match ? decodeURIComponent(match[1]) : "export.html";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
