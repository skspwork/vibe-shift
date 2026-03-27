#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { apiClient } from "./client.js";
import { getChildTypeMap, getAllowedChildTypeMap, GUIDANCE_TEXT } from "@cddai/shared";

const server = new McpServer({
  name: "CddAI",
  version: "0.0.1",
});

// Wrap tool handlers with error handling to prevent "No result received" errors
function safeHandler<T>(fn: (args: T) => Promise<{ content: { type: "text"; text: string }[] }>) {
  return async (args: T) => {
    try {
      return await fn(args);
    } catch (err: any) {
      const message = err?.message || String(err);
      return {
        content: [{ type: "text" as const, text: `エラーが発生しました: ${message}` }],
        isError: true,
      };
    }
  };
}

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

## あなたの役割: プロジェクトコンサルタント
あなたはCddAIのプロジェクトコンサルタントです。ユーザーから相談を受けたら、以下の手順で行動してください:

1. **まず consult_context でプロジェクト全体の状態を確認する**
   - ユーザーがプロジェクトについて話し始めたら、該当プロジェクトの consult_context を呼んで既存ノードを把握する
2. **既存ノードとの重複・矛盾・関連性を分析する**
   - ユーザーの要望に対して、既存のneed/req/spec等と重複していないか確認
   - 矛盾がある場合は具体的に指摘する
   - 関連するノードがあれば言及する
3. **提案し、承認を得てからノードを作成する**
   - ノード内容をテキストで提示し、ユーザーの合意を得てから create_node を実行
   - create_conversation → create_node（conversation_idを指定）の順で経緯を記録
4. **段階的に深掘りを提案する**
   - need作成後は「要件に落とし込みますか？」と提案
   - req → spec → design → task と段階的に進める

## ノード種別と階層
- overview: プロジェクト概要（プロジェクト作成時に自動生成、1つのみ）
- need: 要求（ステークホルダーのニーズ）
- req: 要件（needを具体化した要件）
- spec: 仕様（reqを満たす技術仕様）
- design: 設計（specの実現方法）
- task: タスク（designを実現する作業単位）
- code: コード（taskの実装）
- test: テスト（taskの検証）

## ワークフロー原則
1. **ノードを作成する前に、必ずユーザーにヒアリングしてください**
2. 提案内容をテキストで提示し、ユーザーの合意を得てからcreate_nodeを実行してください
3. create_conversationで会話を作成し、create_nodeのconversation_idに紐付けてください
4. 一度に大量のノードを作成せず、段階的にユーザーと確認しながら進めてください

## 会話ログの記録方法
1. create_conversationで会話を作成（user_message, ai_messageを保存）
2. create_nodeのconversation_idに会話IDを指定（生成経緯がWeb UIに表示される）

## コンテンツのフォーマット
- ノードのcontent、rationale_note、プロジェクトのpurpose/scope/constraints等、すべてのテキストはマークダウン形式で記述してください
- 見出し（##）、箇条書き（-）、番号付きリスト（1.）、コードブロック（\`\`\`）等を活用し、構造的に記述してください
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
    const graph = await apiClient.getProjectGraph(project_id);
    const existingNodes = graph.nodes
      ?.map((n: any) => `- [${n.type}] ${n.title} (id: ${n.id})`)
      .join("\n") || "（まだノードがありません）";

    const overviewNode = graph.nodes?.find((n: any) => n.type === "overview");
    const overviewId = overviewNode?.id || "（不明）";

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

## 開発手法のガイダンス
${GUIDANCE_TEXT}

## overviewノードID
${overviewId}

## 既存ノード（IDはcreate_nodeのparent_idに使用）
${existingNodes}

## ワークフロー（必ずこの順序で進めてください）

### Phase 1: ヒアリング
- ユーザーに質問を投げて、要求（need）の背景・目的・スコープを聞き出してください
- 「誰が」「何を」「なぜ」必要としているかを明確にしてください
- 1つの質問に対して1つずつ回答を待ってください
- この段階では絶対にcreate_nodeやcreate_conversationを呼ばないでください

### Phase 2: 提案
- ヒアリング内容をもとに、作成するノードの内容をマークダウン形式で提案してください
- 例: 「以下の要求ノードを作成してよろしいですか？\n\nタイトル: ○○\n内容: ○○」
- ノードのcontentは必ずマークダウン形式で記述してください（見出し、箇条書き、コードブロック等を活用）
- ユーザーの修正要望があれば反映してください
- ユーザーが「OK」「はい」「作成して」など明確に承認するまで次に進まないでください

### Phase 3: 登録
- ユーザーの承認を得たら、以下の手順でノードを作成してください:
  1. create_conversationで会話を作成（project_idを指定）
  2. create_nodeでノードを作成（conversation_idを指定して経緯を紐付け）
- 作成完了後、次のステップを提案してください

## parent_idの指定ルール（重要）
- **needノード作成時**: parent_idにはoverviewノードID（${overviewId}）を指定してください
- **reqノード作成時**: parent_idには親となるneedノードのIDを指定してください
- **spec作成時**: 親のreqのID、**design作成時**: 親のspecのID、**task作成時**: 親のdesignまたはneedのID
- **絶対にすべてのノードをoverviewに紐づけないでください。正しい親子関係を守ってください。**

## 重要な注意事項
- ユーザーの明確な承認なしにcreate_nodeを呼ばないでください
- 一度に複数のノードを提案する場合も、1つずつ確認を取ってください
- 不明な点があれば推測せず質問してください`,
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
    const childTypeMap = getChildTypeMap();
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

## 開発手法のガイダンス
${GUIDANCE_TEXT}

## 上流コンテキスト
${context.context}

## 推奨する子ノード種別
${childTypes.map((t) => `- ${t}（${childTypeLabels[t] || t}）`).join("\n")}

## ワークフロー（必ずこの順序で進めてください）

### Phase 1: ヒアリング
- 対象ノードの内容を踏まえ、子ノードとして何を定義すべきかユーザーに質問してください
- 上流コンテキストを参考に、抜け漏れがないか確認してください
- この段階ではcreate_nodeを呼ばないでください

### Phase 2: 提案
- ヒアリング結果を踏まえ、作成する子ノードをマークダウン形式で提案してください
- ノードのcontentは必ずマークダウン形式で記述してください（見出し、箇条書き、コードブロック等を活用）
- ユーザーの承認を待ってください

### Phase 3: 登録
- 承認後にcreate_conversation→create_nodeの順で作成してください
- conversation_idを必ず指定して経緯を紐付けてください

## parent_idの指定ルール（重要）
- create_nodeのparent_idには、**この対象ノードのID（${node_id}）** を指定してください
- **overviewノードのIDやプロジェクトIDを parent_id に使わないでください**

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
      "会話を作成する。ノード作成前にまずこのツールで会話を作成し、返却されたconversation IDをcreate_nodeのconversation_idに渡すことで生成経緯が記録される。user_messageとai_messageを指定すると会話ログとして保存される。【注意】ユーザーとのヒアリング・合意形成が完了してから呼び出すこと。",
    annotations: {
      title: "会話作成",
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      summary: z.string().describe("会話の要約（会話のタイトルになる）"),
      user_message: z.string().optional().describe("ユーザーの発言（会話ログとして保存）"),
      ai_message: z.string().optional().describe("AIの応答（会話ログとして保存）"),
    },
  },
  safeHandler(async ({ project_id, summary, user_message, ai_message }) => {
    const conversation = await apiClient.createConversation({
      project_id,
      title: summary,
    });

    // Save conversation messages if provided
    if (user_message) {
      await apiClient.addConvMessage(conversation.id, "user", user_message);
    }
    if (ai_message) {
      await apiClient.addConvMessage(conversation.id, "assistant", ai_message);
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(conversation, null, 2) }],
    };
  })
);

// ─── Tool 2: create_node ───
server.registerTool(
  "create_node",
  {
    description:
      "ノードを作成し、親ノードにリンクする。種別: need, req, spec, design, task, code, test。conversation_idを指定すると、Web UIの詳細パネルで生成経緯（会話ログ）が表示される。【注意】必ずユーザーにノード内容を提案し、明確な承認を得てから呼び出すこと。承認なしの自動作成は禁止。",
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
      content: z.string().describe("詳細内容（マークダウン形式で記述）"),
      parent_id: z.string().uuid().describe("親ノードID（グラフ上の親）"),
      conversation_id: z
        .string()
        .uuid()
        .optional()
        .describe("会話ID（create_conversationで作成したIDを指定すると生成経緯として紐付く）"),
      url: z.string().optional().describe("外部URL（task: チケットURL、code: PR/MR URL）"),
      rationale_note: z.string().optional().describe("経緯メモ（任意、マークダウン形式）"),
    },
  },
  safeHandler(async ({ project_id, type, title, content, parent_id, conversation_id, url, rationale_note }) => {
    const node = await apiClient.createNode({
      project_id,
      type,
      title,
      content,
      parent_id,
      conversation_id,
      url,
      rationale_note,
      created_by: "ai",
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(node, null, 2) }],
    };
  })
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
  safeHandler(async ({ node_id, title, content, rationale_note }) => {
    const updates: Record<string, string> = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (rationale_note !== undefined) updates.rationale_note = rationale_note;

    const node = await apiClient.updateNode(node_id, updates);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(node, null, 2) }],
    };
  })
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
  safeHandler(async ({ node_id }) => {
    const result = await apiClient.deleteNode(node_id);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  })
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
  safeHandler(async ({ from_id, to_id, link_type }) => {
    const edge = await apiClient.createEdge({
      from_node_id: from_id,
      to_node_id: to_id,
      link_type,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(edge, null, 2) }],
    };
  })
);

// ─── Tool 6: delete_edge ───
server.registerTool(
  "delete_edge",
  {
    description:
      "ノード間のエッジ（リンク）を削除する。誤ったparent_id指定で作られた不正なリンクの修正に使用。エッジIDはget_project_graphやlist_edgesで確認できる。【注意】削除は不可逆。ユーザーの承認を得てから実行すること。",
    annotations: {
      title: "エッジ削除",
      destructiveHint: true,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      edge_id: z.string().uuid().describe("削除対象のエッジID"),
    },
  },
  safeHandler(async ({ edge_id }) => {
    const result = await apiClient.deleteEdge(edge_id);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  })
);

// ─── Tool 7: list_edges ───
server.registerTool(
  "list_edges",
  {
    description:
      "指定ノードに接続されているエッジ一覧を取得する。不正なリンクの特定やdelete_edgeで削除するエッジIDの確認に使用。",
    annotations: {
      title: "エッジ一覧",
      readOnlyHint: true,
    },
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      node_id: z.string().uuid().describe("対象ノードID"),
    },
  },
  safeHandler(async ({ project_id, node_id }) => {
    const graph = await apiClient.getProjectGraph(project_id);
    const edges = graph.edges.filter(
      (e: any) => e.from_node_id === node_id || e.to_node_id === node_id
    );
    // Enrich with node titles for readability
    const nodeMap = new Map<string, any>(graph.nodes.map((n: any) => [n.id, n]));
    const enriched = edges.map((e: any) => ({
      edge_id: e.id,
      from: { id: e.from_node_id, type: nodeMap.get(e.from_node_id)?.type, title: nodeMap.get(e.from_node_id)?.title },
      to: { id: e.to_node_id, type: nodeMap.get(e.to_node_id)?.type, title: nodeMap.get(e.to_node_id)?.title },
      link_type: e.link_type,
    }));
    return {
      content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }],
    };
  })
);

// ─── Tool 8: get_trace ───
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
  safeHandler(async ({ node_id, direction }) => {
    const trace = await apiClient.getNodeTrace(node_id, direction);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(trace, null, 2) }],
    };
  })
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
  safeHandler(async ({ node_id }) => {
    const result = await apiClient.getNodeContext(node_id);
    return {
      content: [{ type: "text" as const, text: result.context }],
    };
  })
);

// ─── Tool 8: get_project_graph ───
server.registerTool(
  "get_project_graph",
  {
    description: "プロジェクトのグラフ全体（ノードとエッジ）を取得する",
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
    },
  },
  safeHandler(async ({ project_id }) => {
    const graph = await apiClient.getProjectGraph(project_id);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(graph, null, 2) }],
    };
  })
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
  safeHandler(async ({ project_id, query, types }) => {
    const results = await apiClient.searchNodes(project_id, query, types);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
    };
  })
);

// ─── Tool 10: list_projects ───
server.registerTool(
  "list_projects",
  {
    description: "CddAIのプロジェクト一覧を取得する",
    annotations: {
      title: "プロジェクト一覧",
      readOnlyHint: true,
    },
    inputSchema: {},
  },
  safeHandler(async () => {
    const projects = await apiClient.getProjects();
    const summary = projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      purpose: p.purpose,
    }));
    return {
      content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
    };
  })
);

// ─── Tool 11: list_tasks ───
server.registerTool(
  "list_tasks",
  {
    description:
      "指定プロジェクトのタスクノード一覧を取得する。各タスクの親designノード名も付与される。",
    annotations: {
      title: "タスク一覧",
      readOnlyHint: true,
    },
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
    },
  },
  safeHandler(async ({ project_id }) => {
    const graph = await apiClient.getProjectGraph(project_id);
    const tasks = graph.nodes.filter((n: any) => n.type === "task");

    // Build parent map from edges
    const parentMap = new Map<string, string>();
    for (const e of graph.edges) {
      parentMap.set(e.to_node_id, e.from_node_id);
    }
    const nodeMap = new Map<string, any>();
    for (const n of graph.nodes) {
      nodeMap.set(n.id, n);
    }

    const result = tasks.map((t: any) => {
      const parentId = parentMap.get(t.id);
      const parent = parentId ? nodeMap.get(parentId) : null;
      return {
        id: t.id,
        title: t.title,
        content: t.content,
        parent_design: parent ? { id: parent.id, title: parent.title } : null,
      };
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  })
);

// ─── Tool 12: get_task_brief ───
server.registerTool(
  "get_task_brief",
  {
    description:
      "タスクノードの実装指示書を生成する。上流の全コンテキスト（要求・要件・仕様・設計）を構造化テキストで返す。Claude Codeでの実装時に使用。",
    annotations: {
      title: "タスク実装指示書",
      readOnlyHint: true,
    },
    inputSchema: {
      task_id: z.string().uuid().describe("タスクノードID"),
    },
  },
  safeHandler(async ({ task_id }) => {
    const task = await apiClient.getNode(task_id);
    if (task.type !== "task") {
      return {
        content: [{ type: "text" as const, text: `エラー: 指定ノードはtaskではなく${task.type}です` }],
      };
    }

    // Get upstream trace
    const trace = await apiClient.getNodeTrace(task_id, "upstream");
    const nodesByType: Record<string, any[]> = {};
    for (const n of trace.nodes) {
      if (!nodesByType[n.type]) nodesByType[n.type] = [];
      nodesByType[n.type].push(n);
    }

    // Get downstream for related code/test nodes
    const downstream = await apiClient.getNodeTrace(task_id, "downstream");
    const codeNodes = downstream.nodes.filter((n: any) => n.type === "code");
    const testNodes = downstream.nodes.filter((n: any) => n.type === "test");

    // Build structured brief
    const sections: string[] = [];

    sections.push(`# 実装タスク: ${task.title}\n`);

    // Overview
    const overviews = nodesByType["overview"] || [];
    if (overviews.length > 0) {
      sections.push(`## プロジェクト概要`);
      for (const o of overviews) {
        sections.push(`${o.title}\n${o.content}\n`);
      }
    }

    // Need
    const needs = nodesByType["need"] || [];
    if (needs.length > 0) {
      sections.push(`## 要求（なぜ必要か）`);
      for (const n of needs) {
        sections.push(`### ${n.title}\n${n.content}\n`);
      }
    }

    // Req
    const reqs = nodesByType["req"] || [];
    if (reqs.length > 0) {
      sections.push(`## 要件（何を満たすか）`);
      for (const r of reqs) {
        sections.push(`### ${r.title}\n${r.content}\n`);
      }
    }

    // Spec
    const specs = nodesByType["spec"] || [];
    if (specs.length > 0) {
      sections.push(`## 仕様（詳細な振る舞い）`);
      for (const s of specs) {
        sections.push(`### ${s.title}\n${s.content}\n`);
      }
    }

    // Design
    const designs = nodesByType["design"] || [];
    if (designs.length > 0) {
      sections.push(`## 設計（実装方針）`);
      for (const d of designs) {
        sections.push(`### ${d.title}\n${d.content}\n`);
      }
    }

    // Task detail
    sections.push(`## タスク詳細`);
    sections.push(`${task.content}\n`);
    if (task.rationale_note) {
      sections.push(`### 補足メモ\n${task.rationale_note}\n`);
    }

    // Existing code/test
    if (codeNodes.length > 0) {
      sections.push(`## 既存のコードノード`);
      for (const c of codeNodes) {
        sections.push(`- ${c.title}: ${c.content}`);
      }
      sections.push("");
    }
    if (testNodes.length > 0) {
      sections.push(`## 既存のテストノード`);
      for (const t of testNodes) {
        sections.push(`- ${t.title}: ${t.content}`);
      }
      sections.push("");
    }

    sections.push(`## 指示`);
    sections.push(`上記のコンテキストに基づいてコードを実装してください。`);
    sections.push(`実装完了後、PRを作成し、CddAIにcodeノードとして登録してください。`);
    sections.push(`\nタスクID: ${task_id}`);
    sections.push(`プロジェクトID: ${task.project_id}`);

    return {
      content: [{ type: "text" as const, text: sections.join("\n") }],
    };
  })
);

// ─── Prompt 3: implement_task ───
server.registerPrompt(
  "implement_task",
  {
    description:
      "CddAIのタスクをClaude Codeで実装し、PRを作成してcodeノードを登録するワークフロー",
    argsSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      task_id: z.string().uuid().describe("実装対象のタスクノードID"),
    },
  },
  async ({ project_id, task_id }) => {
    const task = await apiClient.getNode(task_id);

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `あなたはCddAIと連携した実装アシスタントです。以下のワークフローに従ってタスクを実装してください。

## 対象タスク
- タイトル: ${task.title}
- タスクID: ${task_id}
- プロジェクトID: ${project_id}

## ワークフロー（この順序で進めてください）

### Step 1: コンテキスト取得
get_task_brief(task_id: "${task_id}") を呼び出して、タスクの全コンテキスト（要求・要件・仕様・設計）を取得してください。

### Step 2: 実装計画の提示
コンテキストを読んだ上で、何をどう実装するか計画をユーザーに提示してください。
ユーザーの承認を待ってから実装に進んでください。

### Step 3: ブランチ作成と実装
- git checkout -b feature/cddai-${task_id.slice(0, 8)} でブランチを作成
- コンテキストに基づいてコードを実装
- 適切な粒度でコミット

### Step 4: PR作成
- gh pr create でPRを作成
- PRのタイトルにタスク名を含める
- PRの本文に要件・仕様の概要を含める

### Step 5: CddAIへの登録
- create_node(type:"code", parent_id:"${task_id}", project_id:"${project_id}", title:"PR #番号", content:PR_URL) でcodeノードを登録
- 必要に応じて update_node でタスクの経緯メモにPR URLを追記

### Step 6: 完了報告
実装内容のサマリーとPR URLをユーザーに報告してください。

## 重要な注意事項
- Step 2でユーザーの承認を得てから実装に進むこと
- 実装はget_task_briefで取得したコンテキストに忠実に行うこと
- PRを作成したら必ずcodeノードとしてCddAIに登録すること`,
          },
        },
      ],
    };
  }
);

// ─── Tool 14: create_project ───
server.registerTool(
  "create_project",
  {
    description:
      "CddAIに新しいプロジェクトを作成する。overviewノードも自動生成される。返却されるproject_idとoverview_idを後続のノード作成に使用すること。",
    annotations: {
      title: "プロジェクト作成",
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      name: z.string().describe("システム名・プロジェクト名"),
      purpose: z.string().describe("目的・背景"),
      scope: z.string().optional().describe("スコープ（任意）"),
      stakeholders: z.string().optional().describe("ステークホルダー（任意）"),
      constraints: z.string().optional().describe("技術的制約（任意）"),
      active_lanes: z
        .array(z.enum(["need", "req", "spec", "design", "task", "code", "test"]))
        .optional()
        .describe("使用するレーン（省略時は全レーン）"),
    },
  },
  safeHandler(async ({ name, purpose, scope, stakeholders, constraints, active_lanes }) => {
    const defaultLanes = ["need", "req", "spec", "design", "task", "code", "test"];
    const project = await apiClient.createProject({
      name,
      purpose,
      scope: scope || "",
      stakeholders: stakeholders || "",
      constraints: constraints || "",
      active_lanes: active_lanes || defaultLanes,
    });
    return {
      content: [{
        type: "text" as const,
        text: `プロジェクトを作成しました。\n\n${JSON.stringify(project, null, 2)}\n\n` +
          `project_id: ${project.id}\noverview_id: ${project.overview_id}\n` +
          `needノード作成時のparent_idには overview_id を使用してください。`,
      }],
    };
  })
);

// ─── Prompt 4: bootstrap_from_conversation ───
server.registerPrompt(
  "bootstrap_from_conversation",
  {
    description:
      "現在の会話内容からCddAIプロジェクトを新規作成し、要求・要件ノードを自動抽出するワークフロー。普段の会話の途中で「これをプロジェクト化したい」と思ったときに使用。",
    argsSchema: {
      conversation_summary: z.string().describe("これまでの会話の要約や、プロジェクト化したい内容の説明"),
    },
  },
  async ({ conversation_summary }) => {
    const childTypeMap = getChildTypeMap();
    const allowedMap = getAllowedChildTypeMap();

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `あなたはCddAIのプロジェクトブートストラップアシスタントです。
ユーザーがこれまでの会話の中で議論した内容を、CddAIプロジェクトとして構造化してください。

## 会話の要約
${conversation_summary}

## 開発手法のガイダンス
${GUIDANCE_TEXT}

## ノード階層（推奨パス）
${Object.entries(childTypeMap).filter(([, v]) => (v as string[]).length > 0).map(([k, v]) => `- ${k} → ${(v as string[]).join(", ")}`).join("\n")}

## ノード階層（許容パス・手動補完用）
${Object.entries(allowedMap).filter(([, v]) => (v as string[]).length > 0).map(([k, v]) => `- ${k} → ${(v as string[]).join(", ")}`).join("\n")}

## ワークフロー（この順序で進めてください）

### Step 1: プロジェクト情報の確認
会話の要約から以下を抽出し、ユーザーに確認してください:
- **システム名**: 簡潔なプロジェクト名
- **目的・背景**: なぜこのプロジェクトが必要か
- **スコープ**: 何を含み、何を含まないか
- **ステークホルダー**: 誰が関わるか
- **技術的制約**: 使用技術やリソースの制約

ユーザーが「OK」「作成して」と承認するまで次に進まないでください。

### Step 2: プロジェクト作成
承認後、create_project ツールでプロジェクトを作成してください。
返却される project_id と overview_id を控えてください。

### Step 3: 要求（need）ノードの抽出
会話の中で議論された要求・ニーズを need ノードとして抽出してください。
- 各needを1つずつテキストで提案し、ユーザーの承認を得てから作成
- create_conversation → create_node（conversation_idを指定）の順で作成
- create_node の parent_id には **overview_id** を指定
- 会話から明確に読み取れるものだけ抽出し、推測で追加しない

### Step 4: 下位ノードの作成（要件→仕様→設計→タスクの順）
各needから順番にreq→spec→design→taskを作成してください。
- 各ノードのparent_idには直接の親ノードIDを指定（needのIDをreqのparent_idに、reqのIDをspecのparent_idに、等）
- すべてのノードをoverviewに紐づけないでください
- 各ノードは1つずつユーザーに提案し、承認を得てから作成

### Step 5: 完了サマリー
作成したプロジェクトとノード構成のサマリーを表示してください。
Web UIでの確認URL: http://localhost:3000/projects/{project_id}

## parent_idの指定ルール（重要）
- **needノード**: parent_id = overview_id
- **reqノード**: parent_id = 親needのID
- **specノード**: parent_id = 親reqのID
- **designノード**: parent_id = 親specのID
- **taskノード**: parent_id = 親designのID
- **絶対にすべてのノードをoverviewに紐づけないでください**

## 重要な注意事項
- ユーザーの承認なしにcreate_projectやcreate_nodeを呼ばないでください
- 会話から読み取れる情報のみ使い、推測でノードを追加しないでください
- 不明な点は質問してください`,
          },
        },
      ],
    };
  }
);

// ─── Tool 15: register_code ───
server.registerTool(
  "register_code",
  {
    description:
      "タスクノードにコードリンク（PR URLやコミットURL）を登録する。codeノードを作成しタスクにリンクする。",
    annotations: {
      title: "コードリンク登録",
    },
    inputSchema: {
      task_id: z.string().uuid().describe("タスクノードID"),
      title: z.string().describe("リンクタイトル（例: PR #123 ログイン機能）"),
      url: z.string().describe("PR URLやコミットURL"),
    },
  },
  safeHandler(async ({ task_id, title, url }) => {
    const task = await apiClient.getNode(task_id);
    if (task.type !== "task") {
      return {
        content: [{ type: "text" as const, text: "エラー: 指定されたノードはtaskではありません" }],
        isError: true,
      };
    }
    const node = await apiClient.createNode({
      project_id: task.project_id,
      type: "code",
      title,
      content: "",
      url,
      parent_id: task_id,
    });
    return {
      content: [{ type: "text" as const, text: `コードリンクを登録しました。\n\n${JSON.stringify(node, null, 2)}` }],
    };
  })
);

// ─── Tool 16: consult_context ───
server.registerTool(
  "consult_context",
  {
    description:
      "プロジェクト全体のコンテキスト（全ノードのツリー構造）を取得する。Claude Desktop側でコンサルタントとして振る舞う際に使用。取得した情報を元にcreate_node等で直接ノードを作成できる。",
    annotations: {
      title: "プロジェクトコンテキスト取得",
      readOnlyHint: true,
    },
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
    },
  },
  safeHandler(async ({ project_id }) => {
    const { context } = await apiClient.getProjectContext(project_id);
    return {
      content: [{ type: "text" as const, text: context }],
    };
  })
);

// ─── Prompt 5: consult_project ───
server.registerPrompt(
  "consult_project",
  {
    description:
      "プロジェクトコンサルタントとして振る舞うプロンプト。ユーザーの要望を聞き、既存ノードとの重複・矛盾を分析し、適切なノード構造を提案する。",
    argsSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      topic: z.string().optional().describe("相談したいトピックや要望"),
    },
  },
  async ({ project_id, topic }) => {
    const { context } = await apiClient.getProjectContext(project_id);
    const project = await apiClient.getProject(project_id);

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `あなたはCddAIのプロジェクトコンサルタントです。
プロジェクト「${project.name}」について、ユーザーの要望を聞き、既存のノード構造との整合性を確認しながら助言してください。

## あなたの役割
1. ユーザーの要望を正確に理解する
2. 既存ノードとの重複・矛盾・関連性を分析する
3. 重複がある場合は具体的に指摘し、統合・分離・修正を提案する
4. 承認を得たらcreate_conversationとcreate_nodeツールでノードを作成する
5. 必要に応じて要件・仕様へと段階的に深掘りを提案する

## 現在のプロジェクト状態
${context}

## ノード作成ルール
- コンテンツはマークダウン形式で記述してください
- parent_idには適切な親ノードのIDを指定してください
- needノードの親はoverviewノード
- req/taskの親はneedノード（mvpの場合taskはneedの直下も可）
- spec, design, task は上位ノードの直下に
- ユーザーの承認なしにcreate_nodeを呼ばないでください

## 会話の記録
- create_conversationで会話を作成し、create_nodeのconversation_idに指定してください
- これにより生成経緯がWeb UIに表示されます

${topic ? `## ユーザーの相談内容\n${topic}` : "## 開始\nユーザーの要望を聞いてください。"}`,
          },
        },
      ],
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
