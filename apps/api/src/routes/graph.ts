import { Hono } from "hono";
import { getProjectGraph } from "../services/graphService.js";
import { getProjectContext } from "../services/contextService.js";

const app = new Hono();

app.get("/:id/graph", async (c) => {
  const projectId = c.req.param("id");
  const graph = await getProjectGraph(projectId);
  return c.json(graph);
});

app.get("/:id/context", async (c) => {
  const projectId = c.req.param("id");
  const context = await getProjectContext(projectId);
  return c.json({ context });
});

export default app;
