import { z } from "zod";

export const NodeType = z.enum([
  "overview",
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

export const Methodology = z.enum(["strict", "mvp"]);

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

// methodology別の推奨子ノードマップ（AIが提案する種別）
export const METHODOLOGY_CHILD_TYPE_MAP: Record<string, Record<string, string[]>> = {
  strict: {
    overview: ["need"], need: ["req"], req: ["spec"],
    spec: ["design"], design: ["task"], task: ["code", "test"],
    code: [], test: [],
  },
  mvp: {
    overview: ["need"], need: ["task"],
    task: ["code", "test"],
    code: [], test: [],
  },
};

// methodology別の許容子ノードマップ（手動作成・バリデーションで許容する種別）
export const ALLOWED_CHILD_TYPE_MAP: Record<string, Record<string, string[]>> = {
  strict: {
    overview: ["need"], need: ["req"], req: ["spec"],
    spec: ["design"], design: ["task"], task: ["code", "test"],
    code: [], test: [],
  },
  mvp: {
    overview: ["need"], need: ["req", "task"],
    req: ["spec", "task"], spec: ["design"], design: ["task"],
    task: ["code", "test"], code: [], test: [],
  },
};

export function getChildTypeMap(methodology: string): Record<string, string[]> {
  return METHODOLOGY_CHILD_TYPE_MAP[methodology] || METHODOLOGY_CHILD_TYPE_MAP.strict;
}

export function getAllowedChildTypeMap(methodology: string): Record<string, string[]> {
  return ALLOWED_CHILD_TYPE_MAP[methodology] || ALLOWED_CHILD_TYPE_MAP.strict;
}

export const METHODOLOGY_LABELS: Record<string, string> = {
  strict: "厳密（ウォーターフォール型）",
  mvp: "MVP（実装優先）",
};

export const METHODOLOGY_GUIDANCE: Record<string, string> = {
  strict: "全レイヤー（要求→要件→仕様→設計→タスク）を順番に定義してください。各段階を丁寧に掘り下げてからノードを作成してください。",
  mvp: "最小限のタスクを素早く作成し、実装を優先してください。要求からすぐにタスクを起こしてOKです。要件・仕様・設計はあとから必要に応じて追加できます。完璧を目指さず、まず動くものを作ることを重視してください。",
};

export const NODE_LABELS: Record<string, string> = {
  overview: "システム概要",
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
  methodology: Methodology.default("strict"),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  purpose: z.string().optional(),
  scope: z.string().optional(),
  stakeholders: z.string().optional(),
  constraints: z.string().optional(),
  active_lanes: z.array(z.enum(["need", "req", "spec", "design", "task", "code", "test"])).optional(),
  methodology: Methodology.optional(),
});

export const CreateNodeSchema = z.object({
  project_id: z.string().uuid(),
  type: NodeType,
  title: z.string().min(1).max(100),
  content: z.string(),
  parent_id: z.string().uuid(),
  conversation_id: z.string().uuid().optional(),
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
