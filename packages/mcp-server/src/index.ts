#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { apiClient } from "./client.js";

const server = new McpServer({
  name: "CddAI",
  version: "0.0.1",
});

// ─── Resource: CddAI利用ガイド ───
server.registerResource(
  "cddai_guide",
  "resource://cddai/guide",
  { mimeType: "text/plain" },
  async () => ({
    contents: [
      {
        uri: "resource://cddai/guide",
        mimeType: "text/plain",
        text: `# CddAI 利用ガイド

## システム概要
CddAIは、会話駆動型の開発トレーサビリティ管理システムです。
要求→要件→仕様→設計→タスク→コード/テストのトレーサビリティをグラフ構造で管理します。

## ノード種別と階層
- overview: プロジェクト概要（プロジェクト作成時に自動生成、1つのみ）
- need: 要求（ステークホルダーのニーズ）
- req: 要件（needを具体化した要件）
- spec: 仕様（reqを満たす技術仕様）
- design: 設計（specの実現方法）
- task: タスク（designを実現する作業単位）
- code: コード（taskの実装）
- test: テスト（taskの検証）

## 重要なワークフロー原則
1. **ノードを作成する前に、必ずユーザーにヒアリングしてください**
2. 提案内容をテキストで提示し、ユーザーの合意を得てからcreate_nodeを実行してください
3. create_conversationで会話ログを残し、create_nodeのconv_idに紐付けてください
4. 一度に大量のノードを作成せず、段階的にユーザーと確認しながら進めてください

## 会話ログの記録方法
1. create_conversationで会話ノードを作成（user_message, ai_messageを保存）
2. create_nodeのconv_idに会話ノードIDを指定（生成経緯がWeb UIに表示される）
`,
      },
    ],
  })
);

// ─── Prompt 1: requirements_elicitation ───
server.registerPrompt(
  "requirements_elicitation",
  {
    description:
      "要求定義のヒアリングワークフロー。AIがユーザーに質問し、合意を得てからノードを作成する対話的フロー",
    argsSchema: {
      project_id: z.string().uuid().describe("対象プロジェクトID"),
    },
  },
  async ({ project_id }) => {
    // Fetch project info and graph for context
    const project = await apiClient.getProject(project_id);
    const graph = await apiClient.getProjectGraph(project_id, false);

    const existingNodes = graph.nodes
      ?.map((n: any) => `- [${n.type}] ${n.title}`)
      .join("\n") || "（まだノードがありません）";

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `あなたはCddAIの要求定義アシスタントです。以下のワークフローに従って対話してください。

## プロジェクト情報
- プロジェクト名: ${project.name}
- 目的: ${project.purpose}
- プロジェクトID: ${project_id}

## 既存ノード
${existingNodes}

## ワークフロー（必ずこの順序で進めてください）

### Phase 1: ヒアリング
- ユーザーに質問を投げて、要求（need）の背景・目的・スコープを聞き出してください
- 「誰が」「何を」「なぜ」必要としているかを明確にしてください
- 1つの質問に対して1つずつ回答を待ってください
- この段階では絶対にcreate_nodeやcreate_conversationを呼ばないでください

### Phase 2: 提案
- ヒアリング内容をもとに、作成するノードの内容をテキストで提案してください
- 例: 「以下の要求ノードを作成してよろしいですか？\n\nタイトル: ○○\n内容: ○○」
- ユーザーの修正要望があれば反映してください
- ユーザーが「OK」「はい」「作成して」など明確に承認するまで次に進まないでください

### Phase 3: 登録
- ユーザーの承認を得たら、以下の手順でノードを作成してください:
  1. create_conversationで会話ログを作成（ヒアリング内容を要約）
  2. create_nodeでノードを作成（conv_idを指定して経緯を紐付け）
- 作成完了後、次のステップ（要件の深掘りなど）を提案してください

## 重要な注意事項
- ユーザーの明確な承認なしにcreate_nodeを呼ばないでください
- 一度に複数のノードを提案する場合も、1つずつ確認を取ってください
- 不明な点があれば推測せず、必ず質問してください`,
          },
        },
      ],
    };
  }
);

// ─── Prompt 2: node_session ───
server.registerPrompt(
  "node_session",
  {
    description:
      "特定ノードの深掘りワークフロー。選択したノードの子ノードをヒアリングを通じて作成する",
    argsSchema: {
      project_id: z.string().uuid().describe("対象プロジェクトID"),
      node_id: z.string().uuid().describe("深掘り対象のノードID"),
    },
  },
  async ({ project_id, node_id }) => {
    const node = await apiClient.getNode(node_id);
    const context = await apiClient.getNodeContext(node_id);

    const childTypeMap: Record<string, string[]> = {
      overview: ["need"],
      need: ["req"],
      req: ["spec"],
      spec: ["design"],
      design: ["task"],
      task: ["code", "test"],
    };
    const childTypes = childTypeMap[node.type] || [];
    const childTypeLabels: Record<string, string> = {
      need: "要求", req: "要件", spec: "仕様",
      design: "設計", task: "タスク", code: "コード", test: "テスト",
    };

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `あなたはCddAIのノード深掘りアシスタントです。以下のワークフローに従って対話してください。

## 対象ノード
- 種別: ${node.type}
- タイトル: ${node.title}
- 内容: ${node.content}
- ノードID: ${node_id}
- プロジェクトID: ${project_id}

## 上流コンテキスト
${context.context}

## 作成可能な子ノード種別
${childTypes.map((t) => `- ${t}（${childTypeLabels[t] || t}）`).join("\n")}

## ワークフロー（必ずこの順序で進めてください）

### Phase 1: ヒアリング
- 対象ノードの内容を踏まえ、子ノードとして何を定義すべきかユーザーに質問してください
- 上流コンテキストを参考に、抜け漏れがないか確認してください
- この段階ではcreate_nodeを呼ばないでください

### Phase 2: 提案
- ヒアリング結果を踏まえ、作成する子ノードをテキストで提案してください
- ユーザーの承認を待ってください

### Phase 3: 登録
- 承認後にcreate_conversation→create_nodeの順で作成してください
- conv_idを必ず指定して経緯を紐付けてください

## 重要な注意事項
- ユーザーの明確な承認なしにcreate_nodeを呼ばないでください
- 不明な点は推測せず質問してください`,
          },
        },
      ],
    };
  }
);

// ─── Tool 1: create_conversation ───
server.registerTool(
  "create_conversation",
  {
    description:
      "会話(conv)ノードを作成し、指定した親ノードにリンクする。ノード作成前にまずこのツールでconvを作成し、返却されたconv IDをcreate_nodeのconv_idに渡すことで生成経緯が記録される。user_messageとai_messageを指定すると会話ログとして保存される。【注意】ユーザーとのヒアリング・合意形成が完了してから呼び出すこと。",
    annotations: {
      title: "会話ノード作成",
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      parent_id: z.string().uuid().describe("親ノードID"),
      summary: z.string().describe("会話の要約（convノードのタイトルになる）"),
      user_message: z.string().optional().describe("ユーザーの発言（会話ログとして保存）"),
      ai_message: z.string().optional().describe("AIの応答（会話ログとして保存）"),
    },
  },
  async ({ project_id, parent_id, summary, user_message, ai_message }) => {
    const node = await apiClient.createNode({
      project_id,
      type: "conv",
      title: summary,
      content: "",
      parent_id,
      created_by: "ai",
    });

    // Save conversation messages if provided
    if (user_message) {
      await apiClient.addConvMessage(node.id, "user", user_message);
    }
    if (ai_message) {
      await apiClient.addConvMessage(node.id, "assistant", ai_message);
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(node, null, 2) }],
    };
  }
);

// ─── Tool 2: create_node ───
server.registerTool(
  "create_node",
  {
    description:
      "ノードを作成し、親ノードにリンクする。種別: need, req, spec, design, task, code, test。conv_idを指定すると、そのconvの子としてリンクされ、Web UIの詳細パネルで生成経緯（会話ログ）が表示される。【注意】必ずユーザーにノード内容を提案し、明確な承認を得てから呼び出すこと。承認なしの自動作成は禁止。",
    annotations: {
      title: "ノード作成",
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      type: z
        .enum(["need", "req", "spec", "design", "task", "code", "test"])
        .describe("ノード種別"),
      title: z.string().describe("タイトル（10文字程度）"),
      content: z.string().describe("詳細内容"),
      parent_id: z.string().uuid().describe("親ノードID（グラフ上の親）"),
      conv_id: z
        .string()
        .uuid()
        .optional()
        .describe("会話ノードID（create_conversationで作成したconv IDを指定すると生成経緯として紐付く）"),
      rationale_note: z.string().optional().describe("経緯メモ（任意）"),
    },
  },
  async ({ project_id, type, title, content, parent_id, conv_id, rationale_note }) => {
    const node = await apiClient.createNode({
      project_id,
      type,
      title,
      content,
      parent_id,
      conv_id,
      rationale_note,
      created_by: "ai",
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(node, null, 2) }],
    };
  }
);

// ─── Tool 3: update_node ───
server.registerTool(
  "update_node",
  {
    description: "既存ノードのタイトル・内容・経緯メモを更新する。【注意】更新内容をユーザーに提示し、承認を得てから呼び出すこと。",
    annotations: {
      title: "ノード更新",
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      node_id: z.string().uuid().describe("更新対象のノードID"),
      title: z.string().optional().describe("新しいタイトル"),
      content: z.string().optional().describe("新しい内容"),
      rationale_note: z.string().optional().describe("新しい経緯メモ"),
    },
  },
  async ({ node_id, title, content, rationale_note }) => {
    const updates: Record<string, string> = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (rationale_note !== undefined) updates.rationale_note = rationale_note;

    const node = await apiClient.updateNode(node_id, updates);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(node, null, 2) }],
    };
  }
);

// ─── Tool 4: delete_node ───
server.registerTool(
  "delete_node",
  {
    description:
      "ノードを削除する（子孫ノード・関連エッジ・会話ログも含めてカスケード削除）。overviewノードは削除不可。【注意】削除は不可逆操作。必ずユーザーの明確な承認を得てから実行すること。",
    annotations: {
      title: "ノード削除（カスケード）",
      destructiveHint: true,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      node_id: z.string().uuid().describe("削除対象のノードID"),
    },
  },
  async ({ node_id }) => {
    const result = await apiClient.deleteNode(node_id);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ─── Tool 5: link_nodes ───
server.registerTool(
  "link_nodes",
  {
    description: "2つのノード間にエッジ（リンク）を作成する。【注意】リンク作成前にユーザーに確認すること。",
    annotations: {
      title: "ノード間リンク作成",
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      from_id: z.string().uuid().describe("リンク元ノードID"),
      to_id: z.string().uuid().describe("リンク先ノードID"),
      link_type: z
        .enum(["derives", "references", "tests"])
        .default("derives")
        .describe("リンク種別: derives(派生), references(参照), tests(テスト)"),
    },
  },
  async ({ from_id, to_id, link_type }) => {
    const edge = await apiClient.createEdge({
      from_node_id: from_id,
      to_node_id: to_id,
      link_type,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(edge, null, 2) }],
    };
  }
);

// ─── Tool 6: get_trace ───
server.registerTool(
  "get_trace",
  {
    description: "指定ノードの上流・下流トレースを取得する",
    inputSchema: {
      node_id: z.string().uuid().describe("対象ノードID"),
      direction: z
        .enum(["upstream", "downstream", "both"])
        .default("both")
        .describe("トレース方向"),
    },
  },
  async ({ node_id, direction }) => {
    const trace = await apiClient.getNodeTrace(node_id, direction);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(trace, null, 2) }],
    };
  }
);

// ─── Tool 7: get_node_context ───
server.registerTool(
  "get_node_context",
  {
    description:
      "指定ノードの全親ノードをコンテキスト形式のテキストで取得する。AIセッションのプロンプト構築に使用",
    inputSchema: {
      node_id: z.string().uuid().describe("対象ノードID"),
    },
  },
  async ({ node_id }) => {
    const result = await apiClient.getNodeContext(node_id);
    return {
      content: [{ type: "text" as const, text: result.context }],
    };
  }
);

// ─── Tool 8: get_project_graph ───
server.registerTool(
  "get_project_graph",
  {
    description: "プロジェクトのグラフ全体（ノードとエッジ）を取得する",
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      include_conv: z
        .boolean()
        .default(false)
        .describe("convノードを含めるか（デフォルト: false）"),
    },
  },
  async ({ project_id, include_conv }) => {
    const graph = await apiClient.getProjectGraph(project_id, include_conv);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(graph, null, 2) }],
    };
  }
);

// ─── Tool 9: search_nodes ───
server.registerTool(
  "search_nodes",
  {
    description: "プロジェクト内のノードをテキスト検索する",
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      query: z.string().describe("検索クエリ"),
      types: z
        .array(
          z.enum(["overview", "need", "req", "spec", "design", "task", "code", "test"])
        )
        .optional()
        .describe("フィルタするノード種別の配列（任意）"),
    },
  },
  async ({ project_id, query, types }) => {
    const results = await apiClient.searchNodes(project_id, query, types);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
    };
  }
);

// ─── Start server ───
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP Server error:", err);
  process.exit(1);
});
