import Anthropic from "@anthropic-ai/sdk";
import { getChildTypeMap, NODE_LABELS, METHODOLOGY_GUIDANCE } from "@cddai/shared";

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
- descriptionに詳細を記述してください

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
