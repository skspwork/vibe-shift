import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { ChatRequestSchema, CHILD_TYPE_MAP } from "@cddai/shared";
import { getNodeContext } from "../services/contextService.js";
import { chat } from "../services/aiService.js";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = ChatRequestSchema.parse(body);
  const now = new Date().toISOString();

  // Get the target node (overview or specific node)
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

  // Get or create conv node
  let convId = parsed.conv_id;
  if (!convId) {
    convId = uuid();
    await db.insert(schema.nodes).values({
      id: convId,
      project_id: parsed.project_id,
      type: "conv",
      title: parsed.message.substring(0, 50),
      content: "",
      created_by: "ai",
      created_at: now,
      updated_at: now,
    });
    // Link conv to parent node
    await db.insert(schema.edges).values({
      id: uuid(),
      from_node_id: targetNodeId,
      to_node_id: convId,
      link_type: "derives",
      created_at: now,
    });
  }

  // Save user message
  await db.insert(schema.conv_messages).values({
    id: uuid(),
    conv_node_id: convId,
    role: "user",
    content: parsed.message,
    created_at: now,
  });

  // Build context and call AI
  const context = await getNodeContext(targetNodeId);
  const aiResponse = await chat({
    context,
    message: parsed.message,
    parentType,
    history: parsed.history,
  });

  // Save AI message
  await db.insert(schema.conv_messages).values({
    id: uuid(),
    conv_node_id: convId,
    role: "assistant",
    content: aiResponse.response,
    created_at: new Date().toISOString(),
  });

  // Parse JSON nodes from response
  const createdNodes: any[] = [];
  const jsonMatch = aiResponse.response.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[1]);
      if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
        for (const n of jsonData.nodes) {
          const childTypes = CHILD_TYPE_MAP[parentType] || [];
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
            created_by: "ai",
            created_at: nodeNow,
            updated_at: nodeNow,
          });

          // Link from conv to new node
          await db.insert(schema.edges).values({
            id: uuid(),
            from_node_id: convId,
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
      // JSON parse error - AI response without structured nodes
    }
  }

  return c.json({
    response: aiResponse.response,
    conv_id: convId,
    created_nodes: createdNodes,
  });
});

export default app;
