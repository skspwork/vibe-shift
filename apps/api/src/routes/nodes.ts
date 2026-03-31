import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db, rawDb, schema } from "../db/index.js";
import { CreateNodeSchema, UpdateNodeSchema, NODE_LABELS, getNextActiveType } from "@cddai/shared";
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

function ftsDelete(nodeId: string) {
  rawDb.prepare("DELETE FROM nodes_fts WHERE node_id = ?").run(nodeId);
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

  const activeLanes = JSON.parse(project.active_lanes) as string[];
  const expectedType = getNextActiveType(parentNode.type, activeLanes);
  if (expectedType !== parsed.type) {
    return c.json({
      error: `Cannot create '${parsed.type}' as child of '${parentNode.type}'. Expected: '${expectedType}'`,
    }, 400);
  }

  await db.insert(schema.nodes).values({
    id: nodeId,
    project_id: parsed.project_id,
    type: parsed.type,
    title: parsed.title,
    content: parsed.content,
    url: parsed.url || null,
    rationale_note: parsed.rationale_note || null,
    conversation_id: parsed.conversation_id || null,
    created_by: parsed.created_by,
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

  // Link conversation via junction table
  if (parsed.conversation_id) {
    await db.insert(schema.node_conversations).values({
      id: uuid(),
      node_id: nodeId,
      conversation_id: parsed.conversation_id,
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

app.get("/search", async (c) => {
  const projectId = c.req.query("project_id");
  const query = c.req.query("query") || "";
  const types = c.req.query("types")?.split(",").filter(Boolean);
  const parentId = c.req.query("parent_id");
  const includePath = c.req.query("include_path") !== "false";

  if (!projectId) return c.json({ error: "project_id required" }, 400);

  let results: any[];

  if (query) {
    // FTS5 search with BM25 ranking
    const ftsQuery = query.split(/\s+/).map((t) => `"${t}"`).join(" OR ");
    results = rawDb.prepare(`
      SELECT n.*, bm25(nodes_fts) as rank
      FROM nodes_fts fts
      JOIN nodes n ON n.id = fts.node_id
      WHERE nodes_fts MATCH ? AND n.project_id = ?
      ORDER BY rank
    `).all(ftsQuery, projectId) as any[];

    // Merge title LIKE matches that FTS may have missed
    const ftsIds = new Set(results.map((r) => r.id));
    const likePattern = `%${query}%`;
    const titleMatches = rawDb.prepare(
      "SELECT * FROM nodes WHERE project_id = ? AND title LIKE ?"
    ).all(projectId, likePattern) as any[];
    for (const m of titleMatches) {
      if (!ftsIds.has(m.id)) results.push(m);
    }
  } else {
    results = rawDb.prepare("SELECT * FROM nodes WHERE project_id = ?").all(projectId) as any[];
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
  const [node] = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.id, id));
  if (!node) return c.json({ error: "Not found" }, 404);
  return c.json(node);
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateNodeSchema.parse(body);
  const now = new Date().toISOString();

  // Extract conversation fields (don't write to nodes table)
  const { conversation_id, conversation_purpose, ...nodeUpdates } = parsed;

  await db
    .update(schema.nodes)
    .set({ ...nodeUpdates, updated_at: now })
    .where(eq(schema.nodes.id, id));

  // Link conversation via junction table (append, not overwrite)
  if (conversation_id) {
    await db.insert(schema.node_conversations).values({
      id: uuid(),
      node_id: id,
      conversation_id,
      purpose: conversation_purpose || "更新",
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

  // Prevent overview deletion
  const [target] = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.id, id));
  if (!target) return c.json({ error: "Not found" }, 404);
  if (target.type === "overview")
    return c.json({ error: "Cannot delete overview node" }, 400);

  // Collect all descendant node IDs (BFS via edges)
  const allEdges = await db.select().from(schema.edges);
  const childMap = new Map<string, string[]>();
  for (const e of allEdges) {
    const children = childMap.get(e.from_node_id) || [];
    children.push(e.to_node_id);
    childMap.set(e.from_node_id, children);
  }

  const toDelete = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (toDelete.has(current)) continue;
    toDelete.add(current);
    for (const child of childMap.get(current) || []) {
      queue.push(child);
    }
  }

  // Delete all in order: node_conversations -> edges -> nodes -> FTS
  for (const nodeId of toDelete) {
    await db.delete(schema.node_conversations).where(eq(schema.node_conversations.node_id, nodeId));
    await db.delete(schema.edges).where(eq(schema.edges.from_node_id, nodeId));
    await db.delete(schema.edges).where(eq(schema.edges.to_node_id, nodeId));
  }
  for (const nodeId of toDelete) {
    await db.delete(schema.nodes).where(eq(schema.nodes.id, nodeId));
    ftsDelete(nodeId);
  }

  return c.json({ ok: true, deleted_count: toDelete.size });
});

app.get("/:id/conv", async (c) => {
  const nodeId = c.req.param("id");

  // Get all linked conversations via junction table
  const links = rawDb.prepare(`
    SELECT nc.purpose, nc.linked_at, c.id, c.title, c.created_at
    FROM node_conversations nc
    JOIN conversations c ON c.id = nc.conversation_id
    WHERE nc.node_id = ?
    ORDER BY nc.linked_at ASC
  `).all(nodeId) as any[];

  if (links.length === 0) {
    // Fallback: check legacy conversation_id on node
    const [node] = await db
      .select()
      .from(schema.nodes)
      .where(eq(schema.nodes.id, nodeId));
    if (!node?.conversation_id) return c.json([]);

    const [conversation] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, node.conversation_id));
    if (!conversation) return c.json([]);

    const messages = await db
      .select()
      .from(schema.conv_messages)
      .where(eq(schema.conv_messages.conversation_id, conversation.id));

    return c.json([{
      conversation,
      purpose: "作成時",
      linked_at: conversation.created_at,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }]);
  }

  // Fetch messages for each linked conversation
  const result = links.map((link: any) => {
    const messages = rawDb.prepare(
      "SELECT role, content FROM conv_messages WHERE conversation_id = ? ORDER BY created_at ASC"
    ).all(link.id) as any[];
    return {
      conversation: { id: link.id, title: link.title, created_at: link.created_at },
      purpose: link.purpose,
      linked_at: link.linked_at,
      messages,
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
        "SELECT * FROM nodes WHERE project_id = ? AND (url LIKE ? OR content LIKE ?)"
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
        WHERE nodes_fts MATCH ? AND n.project_id = ?
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
        "SELECT * FROM nodes WHERE project_id = ? AND (title LIKE ? OR content LIKE ?)"
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
    code: 0, detail_design: 1, basic_design: 2, spec: 3, req: 4, need: 5, overview: 6,
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
  const direction = (c.req.query("direction") as "upstream" | "downstream" | "both") || "both";
  const result = await getNodeTrace(nodeId, direction);
  return c.json(result);
});

app.get("/:id/context", async (c) => {
  const nodeId = c.req.param("id");
  const context = await getNodeContext(nodeId);
  return c.json({ context });
});

export default app;
