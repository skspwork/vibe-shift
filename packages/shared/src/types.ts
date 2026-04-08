import type { z } from "zod";
import type {
  NodeType as NodeTypeSchema,
  CreatedBy as CreatedBySchema,
  LinkType as LinkTypeSchema,
  CreateProjectSchema,
  CreateNodeSchema,
  UpdateNodeSchema,
  CreateEdgeSchema,
} from "./schemas.js";

export type NodeTypeValue = z.infer<typeof NodeTypeSchema>;
export type CreatedByValue = z.infer<typeof CreatedBySchema>;
export type LinkTypeValue = z.infer<typeof LinkTypeSchema>;
export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type CreateNode = z.infer<typeof CreateNodeSchema>;
export type UpdateNode = z.infer<typeof UpdateNodeSchema>;
export type CreateEdge = z.infer<typeof CreateEdgeSchema>;

export interface Project {
  id: string;
  name: string;
  active_lanes: string[];
  node_instructions?: Record<string, string>;
  created_at: string;
}

export interface AppNode {
  id: string;
  project_id: string;
  type: NodeTypeValue;
  title: string;
  content: string;
  changelog_id: string | null;
  requirement_category: "functional" | "non_functional" | null;
  created_by: CreatedByValue;
  created_at: string;
  updated_at: string;
}

export interface AppEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  link_type: LinkTypeValue;
  created_at: string;
}

export interface GraphData {
  nodes: AppNode[];
  edges: AppEdge[];
}

export interface Changelog {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
}

export interface ChangelogEntry {
  changelog: Changelog;
  purpose: string;
  linked_at: string;
  reason: string;
}
