#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { apiClient } from "./client.js";

const server = new McpServer({
  name: "CddAI",
  version: "0.0.1",
});

// ─── Tool 1: create_conversation ───
server.registerTool(
  "create_conversation",
  {
    description: "会話(conv)ノードを作成し、指定した親ノードにリンクする",
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      parent_id: z.string().uuid().describe("親ノードID"),
      summary: z.string().describe("会話の要約（convノードのタイトルになる）"),
    },
  },
  async ({ project_id, parent_id, summary }) => {
    const node = await apiClient.createNode({
      project_id,
      type: "conv",
      title: summary,
      content: "",
      parent_id,
      created_by: "ai",
    });
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
      "ノードを作成し、親ノードにリンクする。種別: need, req, spec, design, task, code, test",
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      type: z
        .enum(["need", "req", "spec", "design", "task", "code", "test"])
        .describe("ノード種別"),
      title: z.string().describe("タイトル（10文字程度）"),
      content: z.string().describe("詳細内容"),
      parent_id: z.string().uuid().describe("親ノードID"),
      rationale_note: z.string().optional().describe("経緯メモ（任意）"),
    },
  },
  async ({ project_id, type, title, content, parent_id, rationale_note }) => {
    const node = await apiClient.createNode({
      project_id,
      type,
      title,
      content,
      parent_id,
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
    description: "既存ノードのタイトル・内容・経緯メモを更新する",
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
      "ノードを削除する（子孫ノード・関連エッジ・会話ログも含めてカスケード削除）。overviewノードは削除不可",
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
    description: "2つのノード間にエッジ（リンク）を作成する",
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
