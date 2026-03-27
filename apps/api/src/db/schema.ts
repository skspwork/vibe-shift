import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active_lanes: text("active_lanes").notNull(), // JSON array
  methodology: text("methodology").notNull().default("strict"),
  created_at: text("created_at").notNull(),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id),
  title: text("title").notNull(),
  created_at: text("created_at").notNull(),
});

export const nodes = sqliteTable("nodes", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  url: text("url"),
  rationale_note: text("rationale_note"),
  conversation_id: text("conversation_id").references(() => conversations.id),
  created_by: text("created_by").notNull().default("user"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const edges = sqliteTable("edges", {
  id: text("id").primaryKey(),
  from_node_id: text("from_node_id")
    .notNull()
    .references(() => nodes.id),
  to_node_id: text("to_node_id")
    .notNull()
    .references(() => nodes.id),
  link_type: text("link_type").notNull().default("derives"),
  created_at: text("created_at").notNull(),
});

export const conv_messages = sqliteTable("conv_messages", {
  id: text("id").primaryKey(),
  conversation_id: text("conversation_id")
    .notNull()
    .references(() => conversations.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  created_at: text("created_at").notNull(),
});
