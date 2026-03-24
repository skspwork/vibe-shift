import { Hono } from "hono";
import { getProjectGraph } from "../services/graphService.js";

const app = new Hono();

app.get("/:id/graph", async (c) => {
  const projectId = c.req.param("id");
  const includeConv = c.req.query("include_conv") === "true";
  const graph = await getProjectGraph(projectId, includeConv);
  return c.json(graph);
});

export default app;
