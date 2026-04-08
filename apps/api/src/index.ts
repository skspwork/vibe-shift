import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import projects from "./routes/projects.js";
import nodes from "./routes/nodes.js";
import edges from "./routes/edges.js";
import graph from "./routes/graph.js";
import changelogs from "./routes/changelogs.js";
import { db, schema } from "./db/index.js";
import { sql } from "drizzle-orm";
import Database from "better-sqlite3";
import { resolve } from "path";
import { v4 as uuidv4 } from "uuid";

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

    CREATE TABLE IF NOT EXISTS changelogs (
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
      changelog_id TEXT REFERENCES changelogs(id),
      created_by TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      disabled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      from_node_id TEXT NOT NULL REFERENCES nodes(id),
      to_node_id TEXT NOT NULL REFERENCES nodes(id),
      link_type TEXT NOT NULL DEFAULT 'derives',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS changelog_reasons (
      id TEXT PRIMARY KEY,
      changelog_id TEXT NOT NULL REFERENCES changelogs(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS node_changelogs (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL REFERENCES nodes(id),
      changelog_id TEXT NOT NULL REFERENCES changelogs(id),
      purpose TEXT NOT NULL DEFAULT '作成時',
      linked_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
      node_id UNINDEXED,
      title,
      content,
      tokenize='unicode61'
    );
  `);

  // Add disabled_at column if not exists (for existing DBs)
  try {
    sqlite.exec("ALTER TABLE nodes ADD COLUMN disabled_at TEXT");
  } catch {
    // Column already exists
  }

  // ─── Migrate old table names to new names ───
  try {
    const oldExists = sqlite.prepare("SELECT COUNT(*) as c FROM conversations").get() as any;
    const newExists = sqlite.prepare("SELECT COUNT(*) as c FROM changelogs").get() as any;
    if (oldExists.c > 0 && newExists.c === 0) {
      sqlite.exec("INSERT OR IGNORE INTO changelogs SELECT * FROM conversations");
      sqlite.exec("INSERT OR IGNORE INTO changelog_reasons SELECT * FROM conv_messages");
      sqlite.exec("INSERT OR IGNORE INTO node_changelogs SELECT * FROM node_conversations");
    }
  } catch {
    // Old tables don't exist, skip migration
  }

  // Rename conversation_id → changelog_id in nodes table
  try {
    sqlite.exec("ALTER TABLE nodes RENAME COLUMN conversation_id TO changelog_id");
  } catch {
    // Column already renamed
  }

  // Add requirement_category column if not exists
  try {
    sqlite.exec("ALTER TABLE nodes ADD COLUMN requirement_category TEXT");
  } catch {
    // Column already exists
  }

  // Migrate existing nodes.changelog_id → node_changelogs
  const existing = sqlite.prepare(
    "SELECT id, changelog_id, created_at FROM nodes WHERE changelog_id IS NOT NULL"
  ).all() as any[];
  for (const row of existing) {
    const alreadyMigrated = sqlite.prepare(
      "SELECT 1 FROM node_changelogs WHERE node_id = ? AND changelog_id = ?"
    ).get(row.id, row.changelog_id);
    if (!alreadyMigrated) {
      const ncId = uuidv4();
      sqlite.prepare(
        "INSERT INTO node_changelogs (id, node_id, changelog_id, purpose, linked_at) VALUES (?, ?, ?, ?, ?)"
      ).run(ncId, row.id, row.changelog_id, "作成時", row.created_at);
    }
  }

  // Rebuild FTS index from existing nodes (idempotent)
  const count = sqlite.prepare("SELECT COUNT(*) as c FROM nodes_fts").get() as any;
  const nodeCount = sqlite.prepare("SELECT COUNT(*) as c FROM nodes").get() as any;
  if (count.c !== nodeCount.c) {
    sqlite.exec("DELETE FROM nodes_fts");
    sqlite.exec("INSERT INTO nodes_fts(node_id, title, content) SELECT id, title, content FROM nodes");
  }

  sqlite.close();
}

initDb();

const app = new Hono();

app.use("/*", cors());

app.route("/projects", projects);
app.route("/nodes", nodes);
app.route("/edges", edges);
app.route("/projects", graph);
app.route("/changelogs", changelogs);

app.get("/", (c) => c.json({ status: "ok", service: "CddAI API" }));

const port = Number(process.env.PORT) || 3001;
console.log(`CddAI API running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
