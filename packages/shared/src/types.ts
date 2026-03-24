import type { z } from "zod";
import type {
  NodeType as NodeTypeSchema,
  CreatedBy as CreatedBySchema,
  LinkType as LinkTypeSchema,
  CreateProjectSchema,
  CreateNodeSchema,
  UpdateNodeSchema,
  CreateEdgeSchema,
  ChatRequestSchema,
} from "./schemas";

export type NodeTypeValue = z.infer<typeof NodeTypeSchema>;
export type CreatedByValue = z.infer<typeof CreatedBySchema>;
export type LinkTypeValue = z.infer<typeof LinkTypeSchema>;

export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type CreateNode = z.infer<typeof CreateNodeSchema>;
export type UpdateNode = z.infer<typeof UpdateNodeSchema>;
export type CreateEdge = z.infer<typeof CreateEdgeSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface Project {
  id: string;
  name: string;
  active_lanes: string[];
  created_at: string;
}

export interface AppNode {
  id: string;
  project_id: string;
  type: NodeTypeValue;
  title: string;
  content: string;
  rationale_note: string | null;
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

export interface ConvMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConvData {
  conv_node: AppNode;
  messages: ConvMessage[];
}
