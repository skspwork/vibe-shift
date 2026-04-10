import { z } from "zod";

export const NodeType = z.enum([
  "overview",
  "need",
  "feature",
  "spec",
]);

export const CreatedBy = z.enum(["user", "ai"]);

export const LinkType = z.enum(["derives", "references", "tests"]);

export const VISIBLE_NODE_TYPES = [
  "overview", "need", "feature", "spec",
] as const;

export const FEATURE_SUB_TYPES = ["spec"] as const;

export const CHILD_TYPE_MAP: Record<string, string[]> = {
  overview: ["need"],
  need: ["feature"],
  feature: ["spec"],
  spec: [],
};

export const ALLOWED_CHILD_MAP: Record<string, string[]> = {
  overview: ["need"],
  need: ["feature"],
  feature: ["spec"],
  spec: [],
};

export const HIERARCHY_ORDER = [
  "overview", "need", "feature", "spec",
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

export const GUIDANCE_TEXT = "要求 → 機能 → 仕様 の順に定義してください。1つの要求から複数の機能、1つの機能から複数の仕様を作成できます。";

export const NODE_LABELS: Record<string, string> = {
  overview: "システム概要",
  need: "要求",
  feature: "機能",
  spec: "仕様",
};

export const DEFAULT_NODE_INSTRUCTIONS: Record<string, string> = {
  need: `ステークホルダーの視点で「誰が・何を・なぜ」必要としているかを記述。
マークダウンで構造化すること:
- **背景**: なぜこの要求が必要か
- **目的**: 何を実現したいか
- **期待効果**: 実現するとどうなるか
箇条書き(-)と太字(**)を活用し、一文の平文にしない。`,
  feature: `要求を満たすための機能を具体的に記述。
マークダウンで構造化すること:
### 主要機能
- 機能の箇条書き
### ユースケース
- ユーザーが〜する場合、〜できる
見出し(###)・箇条書き(-)・テーブルを活用し、一文の平文にしない。`,
  spec: `機能を実現するための仕様・入出力・制約条件を記述。
マークダウンで構造化すること:
- APIは見出し(###)+エンドポイント(\`コードブロック\`)+パラメータテーブル(|)で記述
- UIはコンポーネント構成・操作フローをリストで記述
- SQLはコードブロック(\`\`\`sql)で記述
含めるべき項目:
1. 機能概要
2. 事前条件・事後条件
3. 正常フロー（番号付きステップ）
4. 代替フロー・例外フロー
5. 入出力項目定義（テーブル: 項目名／型／必須・任意／バリデーション）
6. 業務ルール一覧
7. エラーメッセージ一覧
実装の話は含めず、"何をするか"に徹してください。`,
};

export const NodeInstructionsSchema = z.record(
  z.enum(["need", "feature", "spec"]),
  z.string()
).nullable().optional();

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  purpose: z.string().min(1),
  constraints: z.string().optional(),
  node_instructions: NodeInstructionsSchema,
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  purpose: z.string().optional(),
  constraints: z.string().optional(),
  node_instructions: NodeInstructionsSchema,
});

export const RequirementCategory = z.enum(["functional", "non_functional"]);

export const CreateNodeSchema = z.object({
  project_id: z.string().uuid(),
  type: NodeType,
  title: z.string().min(1).max(100),
  content: z.string(),
  parent_id: z.string().uuid(),
  changelog_id: z.string().uuid(),
  url: z.string().url().optional(),
  created_by: CreatedBy.default("user"),
  requirement_category: RequirementCategory.optional(),
});

export const UpdateNodeSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().optional(),
  url: z.string().url().nullable().optional(),
  changelog_id: z.string().uuid().nullable().optional(),
  changelog_purpose: z.string().optional(),
  requirement_category: RequirementCategory.optional(),
});

export const CreateEdgeSchema = z.object({
  from_node_id: z.string().uuid(),
  to_node_id: z.string().uuid(),
  link_type: LinkType.default("derives"),
});

