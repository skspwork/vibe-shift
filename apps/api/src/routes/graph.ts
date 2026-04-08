import { Hono } from "hono";
import { getProjectGraph } from "../services/graphService.js";
import { getProjectContext } from "../services/contextService.js";

const app = new Hono();

app.get("/:id/graph", async (c) => {
  const projectId = c.req.param("id");
  const includeDisabled = c.req.query("include_disabled") === "true";
  const graph = await getProjectGraph(projectId, includeDisabled);
  return c.json(graph);
});

app.get("/:id/context", async (c) => {
  const projectId = c.req.param("id");
  const context = await getProjectContext(projectId);
  return c.json({ context });
});

export default app;
