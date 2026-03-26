import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { ChatRequestSchema, getAllowedChildTypeMap } from "@cddai/shared";
import { getNodeContext, getProjectContext } from "../services/contextService.js";
import { chat, consult } from "../services/aiService.js";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = ChatRequestSchema.parse(body);
  const now = new Date().toISOString();

  // Get project methodology
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, parsed.project_id));
  const methodology = project?.methodology || "strict";

  // Get or create conversation
  let convId = parsed.conversation_id;
  if (!convId) {
    convId = uuid();
    await db.insert(schema.conversations).values({
      id: convId,
      project_id: parsed.project_id,
      title: parsed.message.substring(0, 50),
      created_at: now,
    });
  }

  // Save user message
  await db.insert(schema.conv_messages).values({
    id: uuid(),
    conversation_id: convId,
    role: "user",
    content: parsed.message,
    created_at: now,
  });

  let aiResponse: { response: string };
  let createdNodes: any[] = [];

  if (parsed.session_type === "consult") {
    // ── Consult mode: project-wide conversation ──
    const projectContext = await getProjectContext(parsed.project_id);
    aiResponse = await consult({
      projectContext,
      message: parsed.message,
      methodology,
      history: parsed.history,
    });

    // Parse JSON nodes — each node specifies its own parent_id
    const jsonMatch = aiResponse.response.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
          const allowedMap = getAllowedChildTypeMap(methodology);

          // Build a map to look up parent node types
          const allNodes = await db
            .select()
            .from(schema.nodes)
            .where(eq(schema.nodes.project_id, parsed.project_id));
          const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

          for (const n of jsonData.nodes) {
            const parentNode = nodeMap.get(n.parent_id);
            if (!parentNode) continue; // invalid parent_id
            const childTypes = allowedMap[parentNode.type] || [];
            if (!childTypes.includes(n.type)) continue;

            const nodeId = uuid();
            const nodeNow = new Date().toISOString();
            await db.insert(schema.nodes).values({
              id: nodeId,
              project_id: parsed.project_id,
              type: n.type,
              title: n.title,
              content: n.description || "",
              rationale_note: null,
              conversation_id: convId,
              created_by: "ai",
              created_at: nodeNow,
              updated_at: nodeNow,
            });

            await db.insert(schema.edges).values({
              id: uuid(),
              from_node_id: n.parent_id,
              to_node_id: nodeId,
              link_type: "derives",
              created_at: nodeNow,
            });

            // Add to nodeMap so subsequent nodes can reference this one as parent
            nodeMap.set(nodeId, {
              id: nodeId,
              project_id: parsed.project_id,
              type: n.type,
              title: n.title,
              content: n.description || "",
              rationale_note: null,
              conversation_id: convId,
              created_by: "ai",
              created_at: nodeNow,
              updated_at: nodeNow,
            });

            createdNodes.push({
              id: nodeId,
              type: n.type,
              title: n.title,
              content: n.description || "",
            });
          }
        }
      } catch {
        // JSON parse error
      }
    }
  } else {
    // ── Legacy mode: overview or node_session ──
    let targetNodeId: string;
    let parentType: string;

    if (parsed.session_type === "overview") {
      const projectNodes = await db
        .select()
        .from(schema.nodes)
        .where(eq(schema.nodes.project_id, parsed.project_id));
      const overviewNode = projectNodes.find((n) => n.type === "overview");
      if (!overviewNode) return c.json({ error: "Overview not found" }, 404);
      targetNodeId = overviewNode.id;
      parentType = "overview";
    } else {
      if (!parsed.node_id) return c.json({ error: "node_id required" }, 400);
      targetNodeId = parsed.node_id;
      const [node] = await db
        .select()
        .from(schema.nodes)
        .where(eq(schema.nodes.id, targetNodeId));
      if (!node) return c.json({ error: "Node not found" }, 404);
      parentType = node.type;
    }

    const context = await getNodeContext(targetNodeId);
    aiResponse = await chat({
      context,
      message: parsed.message,
      parentType,
      methodology,
      history: parsed.history,
    });

    // Parse JSON nodes from response
    const jsonMatch = aiResponse.response.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
          for (const n of jsonData.nodes) {
            const allowedMap = getAllowedChildTypeMap(methodology);
            const childTypes = allowedMap[parentType] || [];
            if (!childTypes.includes(n.type)) continue;

            const nodeId = uuid();
            const nodeNow = new Date().toISOString();
            await db.insert(schema.nodes).values({
              id: nodeId,
              project_id: parsed.project_id,
              type: n.type,
              title: n.title,
              content: n.description || "",
              rationale_note: null,
              conversation_id: convId,
              created_by: "ai",
              created_at: nodeNow,
              updated_at: nodeNow,
            });

            await db.insert(schema.edges).values({
              id: uuid(),
              from_node_id: targetNodeId,
              to_node_id: nodeId,
              link_type: "derives",
              created_at: nodeNow,
            });

            createdNodes.push({
              id: nodeId,
              type: n.type,
              title: n.title,
              content: n.description || "",
            });
          }
        }
      } catch {
        // JSON parse error
      }
    }
  }

  // Save AI message
  await db.insert(schema.conv_messages).values({
    id: uuid(),
    conversation_id: convId,
    role: "assistant",
    content: aiResponse.response,
    created_at: new Date().toISOString(),
  });

  return c.json({
    response: aiResponse.response,
    conversation_id: convId,
    created_nodes: createdNodes,
  });
});

export default app;
