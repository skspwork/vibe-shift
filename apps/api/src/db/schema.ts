import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active_lanes: text("active_lanes").notNull(), // JSON array
  node_instructions: text("node_instructions"), // JSON Record<string, string>
  created_at: text("created_at").notNull(),
});

export const changelogs = sqliteTable("changelogs", {
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
  changelog_id: text("changelog_id").references(() => changelogs.id),
  requirement_category: text("requirement_category"),
  created_by: text("created_by").notNull().default("user"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  disabled_at: text("disabled_at"),
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

export const node_changelogs = sqliteTable("node_changelogs", {
  id: text("id").primaryKey(),
  node_id: text("node_id")
    .notNull()
    .references(() => nodes.id),
  changelog_id: text("changelog_id")
    .notNull()
    .references(() => changelogs.id),
  purpose: text("purpose").notNull().default("作成時"),
  linked_at: text("linked_at").notNull(),
});

export const changelog_reasons = sqliteTable("changelog_reasons", {
  id: text("id").primaryKey(),
  changelog_id: text("changelog_id")
    .notNull()
    .references(() => changelogs.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  created_at: text("created_at").notNull(),
});
