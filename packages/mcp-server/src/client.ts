const API_URL = process.env.VIBESHIFT_API_URL || "http://localhost:3001";
const API_TOKEN = process.env.VIBESHIFT_API_TOKEN;
export const USER_NAME = process.env.VIBESHIFT_USER_NAME;

if (!USER_NAME) {
  console.error(
    "[VibeShift] VIBESHIFT_USER_NAME が未設定です。チーム利用では Claude Desktop の MCP 設定に env として追加してください。"
  );
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (API_TOKEN) {
    headers.Authorization = `Bearer ${API_TOKEN}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

function withUserName<T extends Record<string, any>>(data: T): T {
  if (USER_NAME && data.user_name === undefined) {
    return { ...data, user_name: USER_NAME };
  }
  return data;
}

export const apiClient = {
  // Projects
  getProject: (id: string) => request<any>(`/projects/${id}`),
  getProjects: () => request<any[]>("/projects"),
  createProject: (data: any) =>
    request<any>("/projects", { method: "POST", body: JSON.stringify(withUserName(data)) }),
  updateProject: (id: string, data: any) =>
    request<any>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(withUserName(data)) }),

  // Graph
  getProjectGraph: (projectId: string) =>
    request<any>(`/projects/${projectId}/graph`),

  // Nodes
  createNode: (data: any) =>
    request<any>("/nodes", { method: "POST", body: JSON.stringify(withUserName(data)) }),
  getNode: (id: string) => request<any>(`/nodes/${id}`),
  updateNode: (id: string, data: any) =>
    request<any>(`/nodes/${id}`, { method: "PATCH", body: JSON.stringify(withUserName(data)) }),
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
      body: JSON.stringify(withUserName({ role, content })),
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
