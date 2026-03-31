import { z } from "zod";

export const NodeType = z.enum([
  "overview",
  "need",
  "req",
  "spec",
  "basic_design",
  "detail_design",
  "code",
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
  "code",
] as const;

export const LANE_TYPES = [
  "need",
  "req",
  "spec",
  "basic_design",
  "detail_design",
  "code",
] as const;

export const CHILD_TYPE_MAP: Record<string, string[]> = {
  overview: ["need"],
  need: ["req"],
  req: ["spec"],
  spec: ["basic_design"],
  basic_design: ["detail_design"],
  detail_design: ["code"],
  code: [],
};

// 許容子ノードマップ（下位工程すべて許可）
export const ALLOWED_CHILD_MAP: Record<string, string[]> = {
  overview: ["need", "req", "spec", "basic_design", "detail_design", "code"],
  need: ["req", "spec", "basic_design", "detail_design", "code"],
  req: ["spec", "basic_design", "detail_design", "code"],
  spec: ["basic_design", "detail_design", "code"],
  basic_design: ["detail_design", "code"],
  detail_design: ["code"],
  code: [],
};

export const HIERARCHY_ORDER = [
  "overview", "need", "req", "spec", "basic_design", "detail_design", "code",
] as const;

export function getChildTypeMap(): Record<string, string[]> {
  return CHILD_TYPE_MAP;
}

export function getAllowedChildTypeMap(): Record<string, string[]> {
  return ALLOWED_CHILD_MAP;
}

/**
 * 親タイプの直下に来るべきactiveなレーンタイプを返す。
 * active_lanesに含まれないレーンはスキップされる。
 */
export function getNextActiveType(parentType: string, activeLanes: string[]): string | null {
  const parentIdx = HIERARCHY_ORDER.indexOf(parentType as typeof HIERARCHY_ORDER[number]);
  if (parentIdx < 0) return null;
  for (let i = parentIdx + 1; i < HIERARCHY_ORDER.length; i++) {
    const t = HIERARCHY_ORDER[i];
    if (activeLanes.includes(t)) return t;
  }
  return null;
}

export const GUIDANCE_TEXT = "全レイヤー（要求→要件→仕様→基本設計→詳細設計）を順番に定義してください。各段階を丁寧に掘り下げてからノードを作成してください。";

export const NODE_LABELS: Record<string, string> = {
  overview: "システム概要",
  need: "要求",
  req: "要件",
  spec: "仕様",
  basic_design: "基本設計",
  detail_design: "詳細設計",
  code: "コード",
};

export const DEFAULT_NODE_INSTRUCTIONS: Record<string, string> = {
  need: "ステークホルダーの視点で「誰が・何を・なぜ」必要としているかを記述",
  req: "要求を満たすために必要な機能要件・非機能要件を具体的に記述",
  spec: "要件を実現するための技術仕様・入出力・制約条件を記述",
  basic_design: "API定義、DBテーブル設計、画面遷移図をMermaid記法で記述",
  detail_design: "クラス図、シーケンス図、アルゴリズムをMermaid記法で記述",
  code: "PR URL、実装の概要、対応するブランチ名を記述",
};

export const NodeInstructionsSchema = z.record(
  z.enum(["need", "req", "spec", "basic_design", "detail_design", "code"]),
  z.string()
).optional();

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  purpose: z.string().min(1),
  scope: z.string().optional(),
  stakeholders: z.string().optional(),
  constraints: z.string().optional(),
  active_lanes: z.array(z.enum(["need", "req", "spec", "basic_design", "detail_design", "code"])),
  node_instructions: NodeInstructionsSchema,
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  purpose: z.string().optional(),
  scope: z.string().optional(),
  stakeholders: z.string().optional(),
  constraints: z.string().optional(),
  active_lanes: z.array(z.enum(["need", "req", "spec", "basic_design", "detail_design", "code"])).optional(),
  node_instructions: NodeInstructionsSchema,
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
  rationale_note: z.string().nullable().optional(),
  conversation_id: z.string().uuid().nullable().optional(),
  conversation_purpose: z.string().optional(),
});

export const CreateEdgeSchema = z.object({
  from_node_id: z.string().uuid(),
  to_node_id: z.string().uuid(),
  link_type: LinkType.default("derives"),
});

