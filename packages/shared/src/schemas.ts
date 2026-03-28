import { z } from "zod";

export const NodeType = z.enum([
  "overview",
  "need",
  "req",
  "spec",
  "basic_design",
  "detail_design",
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
  "basic_design",
  "detail_design",
  "task",
  "code",
  "test",
] as const;

export const LANE_TYPES = [
  "need",
  "req",
  "spec",
  "basic_design",
  "detail_design",
  "task",
  "code",
  "test",
] as const;

export const CHILD_TYPE_MAP: Record<string, string[]> = {
  overview: ["need"],
  need: ["req"],
  req: ["spec"],
  spec: ["basic_design"],
  basic_design: ["detail_design"],
  detail_design: ["task"],
  task: ["code", "test"],
  code: [],
  test: [],
};

// 許容子ノードマップ（下位工程すべて許可）
export const ALLOWED_CHILD_MAP: Record<string, string[]> = {
  overview: ["need", "req", "spec", "basic_design", "detail_design", "task", "code", "test"],
  need: ["req", "spec", "basic_design", "detail_design", "task", "code", "test"],
  req: ["spec", "basic_design", "detail_design", "task", "code", "test"],
  spec: ["basic_design", "detail_design", "task", "code", "test"],
  basic_design: ["detail_design", "task", "code", "test"],
  detail_design: ["task", "code", "test"],
  task: ["code", "test"],
  code: [], test: [],
};

export function getChildTypeMap(): Record<string, string[]> {
  return CHILD_TYPE_MAP;
}

export function getAllowedChildTypeMap(): Record<string, string[]> {
  return ALLOWED_CHILD_MAP;
}

export const GUIDANCE_TEXT = "全レイヤー（要求→要件→仕様→基本設計→詳細設計→タスク）を順番に定義してください。各段階を丁寧に掘り下げてからノードを作成してください。";

export const NODE_LABELS: Record<string, string> = {
  overview: "システム概要",
  need: "要求",
  req: "要件",
  spec: "仕様",
  design: "設計（旧）",
  basic_design: "基本設計",
  detail_design: "詳細設計",
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
  active_lanes: z.array(z.enum(["need", "req", "spec", "basic_design", "detail_design", "task", "code", "test"])),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  purpose: z.string().optional(),
  scope: z.string().optional(),
  stakeholders: z.string().optional(),
  constraints: z.string().optional(),
  active_lanes: z.array(z.enum(["need", "req", "spec", "basic_design", "detail_design", "task", "code", "test"])).optional(),
});

export const CreateNodeSchema = z.object({
  project_id: z.string().uuid(),
  type: NodeType,
  title: z.string().min(1).max(100),
  content: z.string(),
  parent_id: z.string().uuid(),
  conversation_id: z.string().uuid().optional(),
  url: z.string().url().optional(),
  rationale_note: z.string().optional(),
  created_by: CreatedBy.default("user"),
});

export const UpdateNodeSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().optional(),
  url: z.string().url().nullable().optional(),
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
  session_type: z.enum(["overview", "node_session", "consult"]),
  node_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});
