import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { eq, inArray } from "drizzle-orm";
import { db, rawDb, schema } from "../db/index.js";
import { CreateNodeSchema, UpdateNodeSchema, NODE_LABELS, ALLOWED_CHILD_MAP } from "@vibeshift/shared";
import { getNodeContext, getNodeTrace } from "../services/contextService.js";

const app = new Hono();

// ─── FTS helpers ───

function ftsInsert(nodeId: string, title: string, content: string) {
  rawDb.prepare("INSERT INTO nodes_fts(node_id, title, content) VALUES(?, ?, ?)").run(nodeId, title, content);
}

function ftsUpdate(nodeId: string, title: string, content: string) {
  rawDb.prepare("DELETE FROM nodes_fts WHERE node_id = ?").run(nodeId);
  rawDb.prepare("INSERT INTO nodes_fts(node_id, title, content) VALUES(?, ?, ?)").run(nodeId, title, content);
}


// ─── Active node guard ───

function getActiveNode(id: string): any | undefined {
  return rawDb.prepare("SELECT * FROM nodes WHERE id = ? AND disabled_at IS NULL").get(id);
}

function getAnyNode(id: string): any | undefined {
  return rawDb.prepare("SELECT * FROM nodes WHERE id = ?").get(id);
}

// ─── Hierarchy path helper ───

function buildNodePaths(projectId: string): Map<string, { titles: string[]; types: string[] }> {
  const allNodes = rawDb.prepare("SELECT id, title, type FROM nodes WHERE project_id = ?").all(projectId) as any[];
  const allEdges = rawDb.prepare(
    "SELECT from_node_id, to_node_id FROM edges WHERE link_type = 'derives' AND from_node_id IN (SELECT id FROM nodes WHERE project_id = ?) AND to_node_id IN (SELECT id FROM nodes WHERE project_id = ?)"
  ).all(projectId, projectId) as any[];

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const parentMap = new Map<string, string>();
  for (const e of allEdges) {
    parentMap.set(e.to_node_id, e.from_node_id);
  }

  const pathCache = new Map<string, { titles: string[]; types: string[] }>();

  function getPath(nodeId: string): { titles: string[]; types: string[] } {
    if (pathCache.has(nodeId)) return pathCache.get(nodeId)!;
    const node = nodeMap.get(nodeId);
    if (!node) return { titles: [], types: [] };

    const parentId = parentMap.get(nodeId);
    if (!parentId) {
      const result = { titles: [node.title], types: [node.type] };
      pathCache.set(nodeId, result);
      return result;
    }
    const parentPath = getPath(parentId);
    const result = {
      titles: [...parentPath.titles, node.title],
      types: [...parentPath.types, node.type],
    };
    pathCache.set(nodeId, result);
    return result;
  }

  for (const node of allNodes) {
    getPath(node.id);
  }
  return pathCache;
}

function getDescendantIds(nodeId: string): Set<string> {
  const allEdges = rawDb.prepare("SELECT from_node_id, to_node_id FROM edges WHERE link_type = 'derives'").all() as any[];
  const childMap = new Map<string, string[]>();
  for (const e of allEdges) {
    const children = childMap.get(e.from_node_id) || [];
    children.push(e.to_node_id);
    childMap.set(e.from_node_id, children);
  }

  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (result.has(current)) continue;
    result.add(current);
    for (const child of childMap.get(current) || []) {
      queue.push(child);
    }
  }
  return result;
}

// ─── Routes ───

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = CreateNodeSchema.parse(body);
  const now = new Date().toISOString();
  const nodeId = uuid();

  // Validate parent-child type hierarchy
  const [parentNode] = await db.select().from(schema.nodes).where(eq(schema.nodes.id, parsed.parent_id));
  if (!parentNode) return c.json({ error: "Parent node not found" }, 404);

  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, parsed.project_id));
  if (!project) return c.json({ error: "Project not found" }, 404);

  const allowedChildren = ALLOWED_CHILD_MAP[parentNode.type] || [];
  if (!allowedChildren.includes(parsed.type)) {
    return c.json({
      error: `Cannot create '${parsed.type}' as child of '${parentNode.type}'. Allowed: ${allowedChildren.join(", ")}`,
    }, 400);
  }

  // Duplicate check: same parent, same type, same title
  const existingSiblings = rawDb.prepare(
    `SELECT n.id FROM nodes n
     JOIN edges e ON e.to_node_id = n.id AND e.link_type = 'derives'
     WHERE e.from_node_id = ? AND n.type = ? AND n.title = ? AND n.disabled_at IS NULL`
  ).all(parsed.parent_id, parsed.type, parsed.title) as any[];
  if (existingSiblings.length > 0) {
    return c.json({
      error: `同じ親ノードの下に同名の${NODE_LABELS[parsed.type] || parsed.type}「${parsed.title}」が既に存在します (id: ${existingSiblings[0].id})`,
    }, 409);
  }

  await db.insert(schema.nodes).values({
    id: nodeId,
    project_id: parsed.project_id,
    type: parsed.type,
    title: parsed.title,
    content: parsed.content,
    url: parsed.url || null,
    changelog_id: parsed.changelog_id || null,
    requirement_category: parsed.requirement_category || null,
    created_by: parsed.created_by,
    user_name: parsed.user_name || null,
    created_at: now,
    updated_at: now,
  });

  // Always link from parent to new node
  await db.insert(schema.edges).values({
    id: uuid(),
    from_node_id: parsed.parent_id,
    to_node_id: nodeId,
    link_type: "derives",
    created_at: now,
  });

  // Link changelog via junction table
  if (parsed.changelog_id) {
    await db.insert(schema.node_changelogs).values({
      id: uuid(),
      node_id: nodeId,
      changelog_id: parsed.changelog_id,
      purpose: "作成時",
      linked_at: now,
    });
  }

  // Sync FTS
  ftsInsert(nodeId, parsed.title, parsed.content);

  const [node] = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.id, nodeId));

  return c.json(node, 201);
});

app.get("/disabled", async (c) => {
  const projectId = c.req.query("project_id");
  const query = c.req.query("query") || "";
  if (!projectId) return c.json({ error: "project_id required" }, 400);

  let results: any[];
  if (query) {
    const likePattern = `%${query}%`;
    results = rawDb.prepare(
      "SELECT * FROM nodes WHERE project_id = ? AND disabled_at IS NOT NULL AND (title LIKE ? OR content LIKE ?)"
    ).all(projectId, likePattern, likePattern) as any[];
  } else {
    results = rawDb.prepare(
      "SELECT * FROM nodes WHERE project_id = ? AND disabled_at IS NOT NULL"
    ).all(projectId) as any[];
  }

  return c.json(results);
});

app.get("/search", async (c) => {
  const projectId = c.req.query("project_id");
  const query = c.req.query("query") || "";
  const types = c.req.query("types")?.split(",").filter(Boolean);
  const parentId = c.req.query("parent_id");
  const includePath = c.req.query("include_path") !== "false";
  const includeDisabled = c.req.query("include_disabled") === "true";

  if (!projectId) return c.json({ error: "project_id required" }, 400);

  const disabledFilter = includeDisabled ? "" : " AND n.disabled_at IS NULL";
  const disabledFilterSimple = includeDisabled ? "" : " AND disabled_at IS NULL";

  let results: any[];

  if (query) {
    // FTS5 search with BM25 ranking
    const ftsQuery = query.split(/\s+/).map((t) => `"${t}"`).join(" OR ");
    results = rawDb.prepare(`
      SELECT n.*, bm25(nodes_fts) as rank
      FROM nodes_fts fts
      JOIN nodes n ON n.id = fts.node_id
      WHERE nodes_fts MATCH ? AND n.project_id = ?${disabledFilter}
      ORDER BY rank
    `).all(ftsQuery, projectId) as any[];

    // Merge title LIKE matches that FTS may have missed
    const ftsIds = new Set(results.map((r) => r.id));
    const likePattern = `%${query}%`;
    const titleMatches = rawDb.prepare(
      `SELECT * FROM nodes WHERE project_id = ? AND title LIKE ?${disabledFilterSimple}`
    ).all(projectId, likePattern) as any[];
    for (const m of titleMatches) {
      if (!ftsIds.has(m.id)) results.push(m);
    }
  } else {
    results = rawDb.prepare(`SELECT * FROM nodes WHERE project_id = ?${disabledFilterSimple}`).all(projectId) as any[];
  }

  // Type filter
  if (types && types.length > 0) {
    results = results.filter((n) => types.includes(n.type));
  }

  // Parent filter (descendants only)
  if (parentId) {
    const descendantIds = getDescendantIds(parentId);
    results = results.filter((n) => descendantIds.has(n.id));
  }

  // Add hierarchy path
  if (includePath && results.length > 0) {
    const paths = buildNodePaths(projectId);
    results = results.map((n) => {
      const path = paths.get(n.id);
      return {
        ...n,
        path: path ? path.titles.join(" > ") : n.title,
        path_types: path ? path.types.map((t: string) => NODE_LABELS[t] || t).join(" > ") : NODE_LABELS[n.type] || n.type,
      };
    });
  }

  return c.json(results);
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const node = getAnyNode(id);
  if (!node) return c.json({ error: "Not found" }, 404);
  return c.json(node);
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!getActiveNode(id)) return c.json({ error: "Not found" }, 404);
  const body = await c.req.json();
  const parsed = UpdateNodeSchema.parse(body);
  const now = new Date().toISOString();

  // Extract changelog fields and user_name (not columns on nodes table for updates)
  const { changelog_id, changelog_purpose, user_name: _ignoredUserName, ...nodeUpdates } = parsed;

  await db
    .update(schema.nodes)
    .set({ ...nodeUpdates, updated_at: now })
    .where(eq(schema.nodes.id, id));

  // Link changelog via junction table (append, not overwrite)
  if (changelog_id) {
    await db.insert(schema.node_changelogs).values({
      id: uuid(),
      node_id: id,
      changelog_id,
      purpose: changelog_purpose || "更新",
      linked_at: now,
    });
  }

  const [node] = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.id, id));

  // Sync FTS
  if (node) {
    ftsUpdate(id, node.title, node.content);
  }

  return c.json(node);
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");

  // Prevent overview deletion; already disabled nodes return 400
  const target = getActiveNode(id);
  if (!target) return c.json({ error: "Not found or already disabled" }, 400);
  if (target.type === "overview")
    return c.json({ error: "Cannot disable overview node" }, 400);

  // Collect all descendant node IDs (BFS via derives edges)
  const allEdges = await db.select().from(schema.edges);
  const childMap = new Map<string, string[]>();
  for (const e of allEdges) {
    if (e.link_type !== "derives") continue;
    const children = childMap.get(e.from_node_id) || [];
    children.push(e.to_node_id);
    childMap.set(e.from_node_id, children);
  }

  const toDisable = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (toDisable.has(current)) continue;
    toDisable.add(current);
    for (const child of childMap.get(current) || []) {
      queue.push(child);
    }
  }

  // Soft-delete: set disabled_at on all target nodes
  const now = new Date().toISOString();
  for (const nodeId of toDisable) {
    await db.update(schema.nodes).set({ disabled_at: now }).where(eq(schema.nodes.id, nodeId));
  }

  return c.json({ ok: true, disabled_count: toDisable.size });
});

app.patch("/:id/enable", async (c) => {
  const id = c.req.param("id");
  const [target] = await db.select().from(schema.nodes).where(eq(schema.nodes.id, id));
  if (!target) return c.json({ error: "Not found" }, 404);

  // BFS to collect all descendant node IDs
  const allEdges = await db.select().from(schema.edges);
  const childMap = new Map<string, string[]>();
  for (const e of allEdges) {
    if (e.link_type !== "derives") continue;
    const children = childMap.get(e.from_node_id) || [];
    children.push(e.to_node_id);
    childMap.set(e.from_node_id, children);
  }

  const toEnable = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (toEnable.has(current)) continue;
    toEnable.add(current);
    for (const child of childMap.get(current) || []) {
      queue.push(child);
    }
  }

  for (const nodeId of toEnable) {
    await db.update(schema.nodes).set({ disabled_at: null }).where(eq(schema.nodes.id, nodeId));
  }

  return c.json({ ok: true, enabled_count: toEnable.size });
});

app.delete("/:id/purge", async (c) => {
  const id = c.req.param("id");
  const target = getAnyNode(id);
  if (!target) return c.json({ error: "Not found" }, 404);
  if (!target.disabled_at) return c.json({ error: "Only disabled nodes can be purged" }, 400);

  // BFS to collect all descendant node IDs
  const allEdges = await db.select().from(schema.edges);
  const childMap = new Map<string, string[]>();
  for (const e of allEdges) {
    if (e.link_type !== "derives") continue;
    const children = childMap.get(e.from_node_id) || [];
    children.push(e.to_node_id);
    childMap.set(e.from_node_id, children);
  }

  const toPurge = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (toPurge.has(current)) continue;
    toPurge.add(current);
    for (const child of childMap.get(current) || []) {
      toPurge.add(child);
      queue.push(child);
    }
  }

  const nodeIds = Array.from(toPurge);

  // Delete node_changelogs
  await db.delete(schema.node_changelogs).where(inArray(schema.node_changelogs.node_id, nodeIds));

  // Delete edges
  await db.delete(schema.edges).where(inArray(schema.edges.from_node_id, nodeIds));
  await db.delete(schema.edges).where(inArray(schema.edges.to_node_id, nodeIds));

  // Delete FTS entries
  for (const nid of nodeIds) {
    rawDb.prepare("DELETE FROM nodes_fts WHERE node_id = ?").run(nid);
  }

  // Delete nodes
  await db.delete(schema.nodes).where(inArray(schema.nodes.id, nodeIds));

  return c.json({ ok: true, purged_count: nodeIds.length });
});

app.get("/:id/changelogs", async (c) => {
  const nodeId = c.req.param("id");
  if (!getAnyNode(nodeId)) return c.json({ error: "Not found" }, 404);

  // Get all linked changelogs via junction table
  const links = rawDb.prepare(`
    SELECT nc.purpose, nc.linked_at, cl.id, cl.title, cl.created_at
    FROM node_changelogs nc
    JOIN changelogs cl ON cl.id = nc.changelog_id
    WHERE nc.node_id = ?
    ORDER BY nc.linked_at ASC
  `).all(nodeId) as any[];

  if (links.length === 0) {
    // Fallback: check legacy changelog_id on node
    const [node] = await db
      .select()
      .from(schema.nodes)
      .where(eq(schema.nodes.id, nodeId));
    if (!node?.changelog_id) return c.json([]);

    const [changelog] = await db
      .select()
      .from(schema.changelogs)
      .where(eq(schema.changelogs.id, node.changelog_id));
    if (!changelog) return c.json([]);

    const reasons = await db
      .select()
      .from(schema.changelog_reasons)
      .where(eq(schema.changelog_reasons.changelog_id, changelog.id));

    return c.json([{
      changelog,
      purpose: "作成時",
      linked_at: changelog.created_at,
      reason: reasons[0]?.content || changelog.title,
    }]);
  }

  // Fetch reason for each linked changelog
  const result = links.map((link: any) => {
    const reasons = rawDb.prepare(
      "SELECT role, user_name, content FROM changelog_reasons WHERE changelog_id = ? ORDER BY created_at ASC"
    ).all(link.id) as any[];
    return {
      changelog: { id: link.id, title: link.title, created_at: link.created_at },
      purpose: link.purpose,
      linked_at: link.linked_at,
      reason: reasons[0]?.content || link.title,
      user_name: reasons[0]?.user_name || null,
    };
  });

  return c.json(result);
});

app.post("/impact", async (c) => {
  const body = await c.req.json();
  const { project_id, changed_files, keywords, description, include_upstream = true } = body;

  if (!project_id) return c.json({ error: "project_id required" }, 400);
  if (!changed_files?.length && !keywords?.length && !description) {
    return c.json({ error: "changed_files, keywords, description のいずれかを指定してください" }, 400);
  }

  const matchedMap = new Map<string, { node: any; match_reason: string }>();

  // 1. URL/content LIKE search for changed_files
  if (changed_files?.length) {
    for (const file of changed_files) {
      const pattern = `%${file}%`;
      const urlMatches = rawDb.prepare(
        "SELECT * FROM nodes WHERE project_id = ? AND disabled_at IS NULL AND (url LIKE ? OR content LIKE ?)"
      ).all(project_id, pattern, pattern) as any[];
      for (const n of urlMatches) {
        if (!matchedMap.has(n.id)) matchedMap.set(n.id, { node: n, match_reason: "url_match" });
      }
    }
  }

  // 2. FTS search for keywords + description
  const searchTerms: string[] = [...(keywords || [])];
  if (description) {
    searchTerms.push(...description.split(/\s+/).filter((t: string) => t.length > 1));
  }
  if (searchTerms.length > 0) {
    const ftsQuery = searchTerms.map((t) => `"${t}"`).join(" OR ");
    try {
      const ftsResults = rawDb.prepare(`
        SELECT n.*, bm25(nodes_fts) as rank
        FROM nodes_fts fts
        JOIN nodes n ON n.id = fts.node_id
        WHERE nodes_fts MATCH ? AND n.project_id = ? AND n.disabled_at IS NULL
        ORDER BY rank
      `).all(ftsQuery, project_id) as any[];
      for (const n of ftsResults) {
        if (!matchedMap.has(n.id)) matchedMap.set(n.id, { node: n, match_reason: "fts_match" });
      }
    } catch {
      // FTS query may fail on special chars; fall through to LIKE
    }

    // LIKE fallback for each keyword
    for (const term of keywords || []) {
      const pattern = `%${term}%`;
      const likeMatches = rawDb.prepare(
        "SELECT * FROM nodes WHERE project_id = ? AND disabled_at IS NULL AND (title LIKE ? OR content LIKE ?)"
      ).all(project_id, pattern, pattern) as any[];
      for (const n of likeMatches) {
        if (!matchedMap.has(n.id)) matchedMap.set(n.id, { node: n, match_reason: "fts_match" });
      }
    }
  }

  // 3. Upstream trace expansion
  if (include_upstream && matchedMap.size > 0) {
    const allEdges = rawDb.prepare(
      "SELECT from_node_id, to_node_id FROM edges WHERE link_type = 'derives' AND from_node_id IN (SELECT id FROM nodes WHERE project_id = ?)"
    ).all(project_id) as any[];

    const parentMap = new Map<string, string>();
    for (const e of allEdges) {
      parentMap.set(e.to_node_id, e.from_node_id);
    }

    const directIds = new Set(matchedMap.keys());
    for (const nodeId of directIds) {
      let current = parentMap.get(nodeId);
      while (current) {
        if (!matchedMap.has(current)) {
          const upNode = rawDb.prepare("SELECT * FROM nodes WHERE id = ?").all(current)[0] as any;
          if (upNode && upNode.type !== "overview") {
            matchedMap.set(current, { node: upNode, match_reason: "upstream_trace" });
          }
        }
        current = parentMap.get(current);
      }
    }
  }

  // 4. Build paths and format results
  const paths = buildNodePaths(project_id);
  const REASON_ORDER: Record<string, number> = { url_match: 0, fts_match: 1, upstream_trace: 2 };
  const TYPE_ORDER: Record<string, number> = {
    spec: 0, feature: 1, need: 2, overview: 3,
  };

  const matched_nodes = Array.from(matchedMap.values())
    .map(({ node, match_reason }) => {
      const path = paths.get(node.id);
      return {
        id: node.id,
        type: node.type,
        title: node.title,
        content_excerpt: (node.content || "").slice(0, 200),
        url: node.url || null,
        match_reason,
        path: path ? path.titles.join(" > ") : node.title,
        updated_at: node.updated_at,
      };
    })
    .sort((a, b) => (REASON_ORDER[a.match_reason] ?? 9) - (REASON_ORDER[b.match_reason] ?? 9)
      || (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9));

  return c.json({ matched_nodes });
});

app.get("/:id/trace", async (c) => {
  const nodeId = c.req.param("id");
  if (!getActiveNode(nodeId)) return c.json({ error: "Not found" }, 404);
  const direction = (c.req.query("direction") as "upstream" | "downstream" | "both") || "both";
  const result = await getNodeTrace(nodeId, direction);
  return c.json(result);
});

app.get("/:id/context", async (c) => {
  const nodeId = c.req.param("id");
  if (!getActiveNode(nodeId)) return c.json({ error: "Not found" }, 404);
  const context = await getNodeContext(nodeId);
  return c.json({ context });
});

export default app;
