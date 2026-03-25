const API_URL = process.env.CDDAI_API_URL || "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const apiClient = {
  // Projects
  getProjects: () => request<any[]>("/projects"),
  getProject: (id: string) => request<any>(`/projects/${id}`),
  createProject: (data: any) =>
    request<any>("/projects", { method: "POST", body: JSON.stringify(data) }),

  // Graph
  getProjectGraph: (projectId: string) =>
    request<any>(`/projects/${projectId}/graph`),

  // Nodes
  createNode: (data: any) =>
    request<any>("/nodes", { method: "POST", body: JSON.stringify(data) }),
  getNode: (id: string) => request<any>(`/nodes/${id}`),
  updateNode: (id: string, data: any) =>
    request<any>(`/nodes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteNode: (id: string) =>
    request<any>(`/nodes/${id}`, { method: "DELETE" }),
  searchNodes: (projectId: string, query: string, types?: string[]) => {
    const params = new URLSearchParams({ project_id: projectId, query });
    if (types?.length) params.set("types", types.join(","));
    return request<any[]>(`/nodes/search?${params}`);
  },

  // Node context & trace
  getNodeContext: (id: string) => request<any>(`/nodes/${id}/context`),
  getNodeTrace: (id: string, direction = "both") =>
    request<any>(`/nodes/${id}/trace?direction=${direction}`),
  getNodeConv: (id: string) => request<any>(`/nodes/${id}/conv`),

  // Conversations
  createConversation: (data: { project_id: string; title: string }) =>
    request<any>("/conversations", { method: "POST", body: JSON.stringify(data) }),
  addConvMessage: (conversationId: string, role: string, content: string) =>
    request<any>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ role, content }),
    }),

  // Edges
  createEdge: (data: any) =>
    request<any>("/edges", { method: "POST", body: JSON.stringify(data) }),
  deleteEdge: (id: string) =>
    request<any>(`/edges/${id}`, { method: "DELETE" }),
};
