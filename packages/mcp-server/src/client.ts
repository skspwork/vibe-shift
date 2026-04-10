const API_URL = process.env.VIBESHIFT_API_URL || "http://localhost:3001";

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
  getProject: (id: string) => request<any>(`/projects/${id}`),
  getProjects: () => request<any[]>("/projects"),
  createProject: (data: any) =>
    request<any>("/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: string, data: any) =>
    request<any>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

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
  enableNode: (id: string) =>
    request<any>(`/nodes/${id}/enable`, { method: "PATCH" }),
  searchDisabledNodes: (projectId: string, query?: string) => {
    const params = new URLSearchParams({ project_id: projectId });
    if (query) params.set("query", query);
    return request<any[]>(`/nodes/disabled?${params}`);
  },
  searchNodes: (projectId: string, query: string, types?: string[], parentId?: string, includePath?: boolean) => {
    const params = new URLSearchParams({ project_id: projectId, query });
    if (types?.length) params.set("types", types.join(","));
    if (parentId) params.set("parent_id", parentId);
    if (includePath !== undefined) params.set("include_path", String(includePath));
    return request<any[]>(`/nodes/search?${params}`);
  },

  // Node trace
  getNodeTrace: (id: string, direction = "both") =>
    request<any>(`/nodes/${id}/trace?direction=${direction}`),

  // Changelogs
  createChangelog: (data: { project_id: string; title: string }) =>
    request<any>("/changelogs", { method: "POST", body: JSON.stringify(data) }),
  addChangelogReason: (changelogId: string, role: string, content: string) =>
    request<any>(`/changelogs/${changelogId}/reasons`, {
      method: "POST",
      body: JSON.stringify({ role, content }),
    }),

  // Project context
  getProjectContext: (projectId: string) =>
    request<{ context: string }>(`/projects/${projectId}/context`),

  // Impact analysis
  checkImpact: (data: {
    project_id: string;
    changed_files?: string[];
    keywords?: string[];
    description?: string;
    include_upstream?: boolean;
  }) => request<any>("/nodes/impact", { method: "POST", body: JSON.stringify(data) }),

  // Edges
  createEdge: (data: any) =>
    request<any>("/edges", { method: "POST", body: JSON.stringify(data) }),
  deleteEdge: (id: string) =>
    request<any>(`/edges/${id}`, { method: "DELETE" }),
};
