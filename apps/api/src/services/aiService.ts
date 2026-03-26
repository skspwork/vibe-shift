import Anthropic from "@anthropic-ai/sdk";
import { getChildTypeMap, getAllowedChildTypeMap, NODE_LABELS, METHODOLOGY_GUIDANCE } from "@cddai/shared";

const anthropic = new Anthropic();

interface ChatParams {
  context: string;
  message: string;
  parentType: string;
  methodology?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export async function chat(params: ChatParams) {
  const { context, message, parentType, methodology = "strict", history = [] } = params;
  const childTypeMap = getChildTypeMap(methodology);
  const childTypes = childTypeMap[parentType] || [];
  const childLabels = childTypes.map((t) => `${NODE_LABELS[t]}(${t})`).join("、");
  const guidance = METHODOLOGY_GUIDANCE[methodology] || "";

  const systemPrompt = `あなたはAIドリブン開発トレーサビリティ管理システム「CddAI」のアシスタントです。
ユーザーとの対話を通じて、開発プロジェクトの要求・要件・仕様・設計・タスクのノードを作成・整理します。

【開発手法】
${guidance}

以下のコンテキストに基づいて対話してください：

${context}

あなたが作成できるノードの種別: ${childLabels || "（子ノードなし）"}

【重要なルール】
- ノードを提案する場合は必ず以下のJSON形式を含めてください
- JSON部分は \`\`\`json と \`\`\` で囲んでください
- message には登録確認と深掘り質問を1〜2個含めてください
- タイトルは簡潔に（10文字程度）
- descriptionにはマークダウン形式で詳細を記述してください（見出し、箇条書き、コードブロック等を活用）

\`\`\`json
{
  "nodes": [
    { "type": "${childTypes[0] || "need"}", "title": "タイトル", "description": "詳細説明" }
  ],
  "message": "登録確認のメッセージと深掘り質問"
}
\`\`\`

ノードを提案しない場合（質問や確認の場合）は、通常のテキストで返答してください。`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return { response: text };
}

interface ConsultParams {
  projectContext: string;
  message: string;
  methodology?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export async function consult(params: ConsultParams) {
  const { projectContext, message, methodology = "strict", history = [] } = params;
  const guidance = METHODOLOGY_GUIDANCE[methodology] || "";
  const allowedMap = getAllowedChildTypeMap(methodology);

  // Build allowed hierarchy description
  const hierarchyDesc = Object.entries(allowedMap)
    .filter(([, children]) => children.length > 0)
    .map(([parent, children]) => `  ${NODE_LABELS[parent] || parent}(${parent}) → ${children.map((c) => `${NODE_LABELS[c] || c}(${c})`).join("、")}`)
    .join("\n");

  const systemPrompt = `あなたはAIドリブン開発トレーサビリティ管理システム「CddAI」のプロジェクトコンサルタントです。
ユーザーとの対話を通じて、プロジェクト全体の要求・要件・仕様・設計・タスクを整理・管理します。

【あなたの役割】
- ユーザーの要望を聞き、既存ノードとの重複・矛盾・関連性を分析する
- コンサルタントとして助言し、適切なノード構造を提案する
- 承認を得たらノードを作成する
- 必要に応じて要件・仕様へと段階的に深掘りを提案する

【開発手法】
${guidance}

【ノード階層（許容パス）】
${hierarchyDesc}

【現在のプロジェクト状態】
${projectContext}

【重要なルール】
1. ユーザーの要望に対して、まず既存ノードとの重複・矛盾がないか確認してください
2. 重複や関連がある場合は具体的に指摘し、統合・分離・修正を提案してください
3. ノードを提案する場合は必ず以下のJSON形式を含めてください
4. JSON部分は \`\`\`json と \`\`\` で囲んでください
5. 各ノードには parent_id を明示的に指定してください（既存ノードのIDを使用）
6. コンテンツはマークダウン形式で記述してください（見出し、箇条書き、コードブロック等を活用）
7. message には登録確認と次のステップの提案を含めてください
8. タイトルは簡潔に（10文字程度）

\`\`\`json
{
  "nodes": [
    { "type": "need", "title": "タイトル", "description": "マークダウン形式の詳細説明", "parent_id": "親ノードのID" }
  ],
  "message": "登録確認メッセージと次のステップ提案"
}
\`\`\`

ノードを提案しない場合（質問・確認・分析の場合）は、通常のテキストで返答してください。`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return { response: text };
}
