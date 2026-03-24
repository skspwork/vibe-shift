import { z } from "zod";

export const NodeType = z.enum([
  "overview",
  "conv",
  "need",
  "req",
  "spec",
  "design",
  "task",
  "code",
  "test",
]);

export const CreatedBy = z.enum(["user", "ai"]);

export const LinkType = z.enum(["derives", "references", "tests"]);

export const VISIBLE_NODE_TYPES = [
  "overview",
  "need",
  "req",
  "spec",
  "design",
  "task",
  "code",
  "test",
] as const;

export const LANE_TYPES = [
  "need",
  "req",
  "spec",
  "design",
  "task",
  "code",
  "test",
] as const;

export const CHILD_TYPE_MAP: Record<string, string[]> = {
  overview: ["need"],
  need: ["req"],
  req: ["spec"],
  spec: ["design"],
  design: ["task"],
  task: ["code", "test"],
  code: [],
  test: [],
};

export const NODE_LABELS: Record<string, string> = {
  overview: "システム概要",
  conv: "会話",
  need: "要求",
  req: "要件",
  spec: "仕様",
  design: "設計",
  task: "タスク",
  code: "コード",
  test: "テスト",
};

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  purpose: z.string().min(1),
  scope: z.string().optional(),
  stakeholders: z.string().optional(),
  constraints: z.string().optional(),
  active_lanes: z.array(z.enum(["need", "req", "spec", "design", "task", "code", "test"])),
});

export const CreateNodeSchema = z.object({
  project_id: z.string().uuid(),
  type: NodeType,
  title: z.string().min(1).max(100),
  content: z.string(),
  parent_id: z.string().uuid(),
  rationale_note: z.string().optional(),
  created_by: CreatedBy.default("user"),
});

export const UpdateNodeSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().optional(),
  rationale_note: z.string().optional(),
});

export const CreateEdgeSchema = z.object({
  from_node_id: z.string().uuid(),
  to_node_id: z.string().uuid(),
  link_type: LinkType.default("derives"),
});

export const ChatRequestSchema = z.object({
  project_id: z.string().uuid(),
  message: z.string().min(1),
  session_type: z.enum(["overview", "node_session"]),
  node_id: z.string().uuid().optional(),
  conv_id: z.string().uuid().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});
