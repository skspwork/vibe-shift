import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import projects from "./routes/projects.js";
import nodes from "./routes/nodes.js";
import edges from "./routes/edges.js";
import graph from "./routes/graph.js";
import chat from "./routes/chat.js";
import conversations from "./routes/conversations.js";
import { db, schema } from "./db/index.js";
import { sql } from "drizzle-orm";
import Database from "better-sqlite3";
import { resolve } from "path";

// Run migrations inline for dev
function initDb() {
  const dbPath = resolve(process.cwd(), "cddai.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      active_lanes TEXT NOT NULL,
      methodology TEXT NOT NULL DEFAULT 'strict',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      rationale_note TEXT,
      conversation_id TEXT REFERENCES conversations(id),
      created_by TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      from_node_id TEXT NOT NULL REFERENCES nodes(id),
      to_node_id TEXT NOT NULL REFERENCES nodes(id),
      link_type TEXT NOT NULL DEFAULT 'derives',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conv_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  sqlite.close();
}

initDb();

const app = new Hono();

app.use("/*", cors());

app.route("/projects", projects);
app.route("/nodes", nodes);
app.route("/edges", edges);
app.route("/projects", graph);
app.route("/chat", chat);
app.route("/conversations", conversations);

app.get("/", (c) => c.json({ status: "ok", service: "CddAI API" }));

const port = Number(process.env.PORT) || 3001;
console.log(`CddAI API running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
