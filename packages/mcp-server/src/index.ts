#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { apiClient } from "./client.js";

const server = new McpServer({
  name: "VibeShift",
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

// ─── Tool 1: create_changelog ───
server.registerTool(
  "create_changelog",
  {
    description:
      "変更履歴を作成する。ノード作成前にまずこのツールで変更履歴を作成し、返却されたchangelog IDをcreate_nodeのchangelog_idに渡すことで変更履歴が記録される。reasonを指定すると理由として保存される。【注意】ユーザーとのヒアリング・合意形成が完了してから呼び出すこと。",
    annotations: {
      title: "変更履歴作成",
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      summary: z.string().describe("何を変更したかの要約（タイトルになる）"),
      reason: z.string().describe("変更理由（なぜこの変更が必要か）"),
    },
  },
  safeHandler(async ({ project_id, summary, reason }) => {
    const changelog = await apiClient.createChangelog({
      project_id,
      title: summary,
    });

    await apiClient.addChangelogReason(changelog.id, "assistant", reason);

    return {
      content: [{ type: "text" as const, text: JSON.stringify(changelog, null, 2) }],
    };
  })
);

// ─── Tool 2: create_node ───
server.registerTool(
  "create_node",
  {
    description:
      "ノードを作成し、親ノードにリンクする。種別: need, feature, spec。changelog_idは必須。必ず先にcreate_changelogで変更履歴を作成し、そのIDを指定すること。Web UIの詳細パネルで変更履歴が表示される。【注意】必ずユーザーにノード内容を提案し、明確な承認を得てから呼び出すこと。承認なしの自動作成は禁止。",
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
        .enum(["need", "feature", "spec"])
        .describe("ノード種別"),
      title: z.string().describe("タイトル（10文字程度）"),
      content: z.string().describe("詳細内容（マークダウン形式で記述。書き方はプロジェクト設定の指示に従うこと）"),
      parent_id: z.string().uuid().describe("親ノードID（グラフ上の親）"),
      changelog_id: z
        .string()
        .uuid()
        .describe("変更履歴ID（必須。先にcreate_changelogで作成したIDを指定）"),
      url: z.string().optional().describe("外部URL（任意）"),
      requirement_category: z
        .enum(["functional", "non_functional"])
        .optional()
        .describe("要求分類（needノードのみ。functional=機能要求、non_functional=非機能要求。省略時はfunctional）"),
    },
  },
  safeHandler(async ({ project_id, type, title, content, parent_id, changelog_id, url, requirement_category }) => {
    const node = await apiClient.createNode({
      project_id,
      type,
      title,
      content,
      parent_id,
      changelog_id,
      url,
      created_by: "ai",
      requirement_category: type === "need" ? (requirement_category || "functional") : undefined,
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
    description: "既存ノードのタイトル・内容を更新する。reason(変更理由)は必須で、自動的に変更履歴として記録される。【注意】更新内容をユーザーに提示し、承認を得てから呼び出すこと。大幅な変更の場合はcheck_impactで下流ノードへの影響も確認すること。",
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
      content: z.string().optional().describe("新しい内容（マークダウン形式）"),
      reason: z.string().describe("変更理由（何を変更したか＋なぜこの変更が必要か）"),
    },
  },
  safeHandler(async ({ node_id, title, content, reason }) => {
    const node = await apiClient.getNode(node_id);

    // 変更履歴を自動作成し、reasonを記録
    const cl = await apiClient.createChangelog({
      project_id: node.project_id,
      title: `更新: ${node.title}`,
    });
    await apiClient.addChangelogReason(cl.id, "assistant", reason);

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    updates.changelog_id = cl.id;
    updates.changelog_purpose = "更新";

    const updated = await apiClient.updateNode(node_id, updates);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }],
    };
  })
);

// ─── Tool 4: delete_node (disable) ───
server.registerTool(
  "delete_node",
  {
    description:
      "ノードを非活性化（disable）する。対象ノードとその子孫ノードがすべて非活性化され、グラフ表示から非表示になる。データは保持される。overviewノードは非活性化不可。reason（理由）は必須で、変更履歴として自動記録される。",
    annotations: {
      title: "ノード非活性化",
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      node_id: z.string().uuid().describe("非活性化対象のノードID"),
      reason: z.string().describe("非活性化の理由（何を非活性化するか＋なぜ不要になったか）"),
    },
  },
  safeHandler(async ({ node_id, reason }) => {
    const node = await apiClient.getNode(node_id);
    const cl = await apiClient.createChangelog({
      project_id: node.project_id,
      title: `非活性化: ${node.title}`,
    });
    await apiClient.addChangelogReason(cl.id, "assistant", reason);
    await apiClient.updateNode(node_id, { changelog_id: cl.id, changelog_purpose: "非活性化" });

    const result = await apiClient.deleteNode(node_id);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  })
);

// ─── Tool 4b: enable_node ───
server.registerTool(
  "enable_node",
  {
    description:
      "非活性化されたノードを再活性化する。対象ノードとその子孫ノードがすべて活性化され、グラフ表示に復帰する。reason（理由）は必須で、変更履歴として自動記録される。",
    annotations: {
      title: "ノード活性化",
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      node_id: z.string().uuid().describe("活性化対象のノードID"),
      reason: z.string().describe("活性化の理由（何を活性化するか＋なぜ再度必要になったか）"),
    },
  },
  safeHandler(async ({ node_id, reason }) => {
    // Enable first (node is disabled, so getNode would 404)
    const result = await apiClient.enableNode(node_id);

    // Now node is active, so we can get its info and record the changelog
    const node = await apiClient.getNode(node_id);
    const cl = await apiClient.createChangelog({
      project_id: node.project_id,
      title: `活性化: ${node.title}`,
    });
    await apiClient.addChangelogReason(cl.id, "assistant", reason);
    await apiClient.updateNode(node_id, { changelog_id: cl.id, changelog_purpose: "活性化" });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  })
);

// ─── Tool 4c: search_disabled_nodes ───
server.registerTool(
  "search_disabled_nodes",
  {
    description:
      "非活性化されたノードを検索する。ユーザーからノードの再活性化を依頼された際に使用。キーワードで絞り込み可能。通常のsearch_nodesでは非活性ノードは見えない。",
    annotations: {
      title: "非活性ノード検索",
      readOnlyHint: true,
    },
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      query: z.string().optional().describe("検索キーワード（タイトル・内容の部分一致。省略時は全非活性ノードを返す）"),
    },
  },
  safeHandler(async ({ project_id, query }) => {
    const results = await apiClient.searchDisabledNodes(project_id, query);
    if (results.length === 0) {
      return { content: [{ type: "text" as const, text: "非活性ノードは見つかりませんでした。" }] };
    }
    const summary = results.map((n: any) =>
      `- [${n.type}] ${n.title} (id: ${n.id}, 非活性化日時: ${n.disabled_at})`
    ).join("\n");
    return {
      content: [{ type: "text" as const, text: `## 非活性ノード一覧（${results.length}件）\n\n${summary}` }],
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
      "ノード間のエッジ（リンク）を削除する。誤ったparent_id指定で作られた不正なリンクの修正に使用。エッジIDはlist_edgesで確認できる。【注意】削除は不可逆。ユーザーの承認を得てから実行すること。",
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

// ─── Tool 7: search_nodes ───
server.registerTool(
  "search_nodes",
  {
    description:
      "プロジェクト内のノードをFTS5全文検索する。BM25ランキングで関連度順にソートされる。" +
      "各結果には階層パス（例: 要求>要件>仕様）が付与され、ノードの位置を即座に把握できる。" +
      "parent_idを指定すると、そのノードの子孫のみに絞り込める。",
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      query: z.string().optional().describe("検索クエリ（空の場合はフィルター条件のみで検索）"),
      types: z
        .array(
          z.enum(["overview", "need", "feature", "spec"])
        )
        .optional()
        .describe("フィルタするノード種別の配列（任意）"),
      parent_id: z
        .string()
        .uuid()
        .optional()
        .describe("指定ノードの子孫のみに絞り込む（任意）"),
      include_path: z
        .boolean()
        .optional()
        .default(true)
        .describe("階層パスを結果に含めるか（デフォルト: true）"),
    },
  },
  safeHandler(async ({ project_id, query, types, parent_id, include_path }) => {
    const results = await apiClient.searchNodes(project_id, query || "", types, parent_id, include_path);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
    };
  })
);

// ─── Tool 10: list_projects ───
server.registerTool(
  "list_projects",
  {
    description: "VibeShiftのプロジェクト一覧を取得する",
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

// ─── Tool 11: get_implementation_brief ───
server.registerTool(
  "get_implementation_brief",
  {
    description:
      "ノードの実装指示書を生成する。上流の全コンテキスト（要求・機能・仕様）を構造化テキストで返す。AI Agentでの実装時に使用。",
    annotations: {
      title: "実装指示書",
      readOnlyHint: true,
    },
    inputSchema: {
      node_id: z.string().uuid().describe("対象ノードID"),
    },
  },
  safeHandler(async ({ node_id }) => {
    const node = await apiClient.getNode(node_id);

    // Get upstream trace
    const trace = await apiClient.getNodeTrace(node_id, "upstream");
    const nodesByType: Record<string, any[]> = {};
    for (const n of trace.nodes) {
      if (!nodesByType[n.type]) nodesByType[n.type] = [];
      nodesByType[n.type].push(n);
    }

    // Build structured brief
    const sections: string[] = [];

    sections.push(`# 実装対象: ${node.title}\n`);

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

    // Feature
    const features = nodesByType["feature"] || [];
    if (features.length > 0) {
      sections.push(`## 機能（何を実現するか）`);
      for (const f of features) {
        sections.push(`### ${f.title}\n${f.content}\n`);
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

    // Node detail
    sections.push(`## 対象ノード詳細`);
    sections.push(`- 種別: ${node.type}`);
    sections.push(`${node.content}\n`);
    sections.push(`## 指示`);
    sections.push(`上記のコンテキストに基づいて実装してください。`);
    sections.push(`\nノードID: ${node_id}`);
    sections.push(`プロジェクトID: ${node.project_id}`);

    return {
      content: [{ type: "text" as const, text: sections.join("\n") }],
    };
  })
);

// ─── Tool 14: create_project ───
server.registerTool(
  "create_project",
  {
    description:
      "VibeShiftに新しいプロジェクトを作成する。overviewノードも自動生成される。返却されるproject_idとoverview_idを後続のノード作成に使用すること。",
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
      constraints: z.string().optional().describe("技術的制約（任意）"),
    },
  },
  safeHandler(async ({ name, purpose, constraints }) => {
    const project = await apiClient.createProject({
      name,
      purpose,
      constraints: constraints || "",
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

// ─── Tool 15: update_project ───
server.registerTool(
  "update_project",
  {
    description:
      "プロジェクト設定を更新する。目的・技術的制約・ノード種別ごとのAI記述ルールを変更できる。overviewノードのcontentも自動更新される。",
    annotations: {
      title: "プロジェクト設定更新",
      destructiveHint: false,
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      name: z.string().optional().describe("新しいプロジェクト名"),
      purpose: z.string().optional().describe("新しい目的・背景"),
      constraints: z.string().optional().describe("新しい技術的制約"),
      node_instructions: z.record(
        z.enum(["need", "feature", "spec"]),
        z.string()
      ).optional().describe("ノード種別ごとのAI記述ルール（例: { need: '...', feature: '...', spec: '...' }）"),
    },
  },
  safeHandler(async ({ project_id, name, purpose, constraints, node_instructions }) => {
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (purpose !== undefined) updates.purpose = purpose;
    if (constraints !== undefined) updates.constraints = constraints;
    if (node_instructions !== undefined) updates.node_instructions = node_instructions;

    const updated = await apiClient.updateProject(project_id, updates);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }],
    };
  })
);

// ─── Tool 16: consult_context ───
server.registerTool(
  "consult_context",
  {
    description:
      "プロジェクト全体のコンテキスト（全ノードのツリー構造）を取得する。AI Agent側でコンサルタントとして振る舞う際に使用。取得した情報を元にcreate_node等で直接ノードを作成できる。",
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

// ─── Tool 17: check_impact ───
server.registerTool(
  "check_impact",
  {
    description:
      "コード変更の影響範囲を分析する。ファイルパス・キーワード・変更内容の説明を入力すると、影響を受ける可能性のあるノード（仕様・機能・要求等）を上流トレースと共に返す。返却されたノードの内容を確認し、必要に応じてupdate_nodeで更新すること。",
    annotations: {
      title: "影響範囲分析",
      readOnlyHint: true,
    },
    inputSchema: {
      project_id: z.string().uuid().describe("プロジェクトID"),
      changed_files: z
        .array(z.string())
        .optional()
        .describe("変更されたファイルパスやPR URLの配列（部分一致で検索）"),
      keywords: z
        .array(z.string())
        .optional()
        .describe("変更に関連するキーワードの配列（FTS検索に使用）"),
      description: z
        .string()
        .optional()
        .describe("変更内容の自然言語での説明（FTS検索に使用）"),
      include_upstream: z
        .boolean()
        .optional()
        .default(true)
        .describe("マッチしたノードの上流ノードも含めるか（デフォルト: true）"),
    },
  },
  safeHandler(async ({ project_id, changed_files, keywords, description, include_upstream }) => {
    if (!changed_files?.length && !keywords?.length && !description) {
      throw new Error("changed_files, keywords, description のいずれかを指定してください");
    }
    const result = await apiClient.checkImpact({
      project_id,
      changed_files,
      keywords,
      description,
      include_upstream,
    });

    const nodes = result.matched_nodes || [];
    const direct = nodes.filter((n: any) => n.match_reason !== "upstream_trace");
    const upstream = nodes.filter((n: any) => n.match_reason === "upstream_trace");

    let output = `## 影響分析結果\n\n`;
    output += `直接マッチ: ${direct.length}件、上流トレース: ${upstream.length}件\n\n`;

    for (const node of nodes) {
      output += `### [${node.type}] ${node.title}\n`;
      output += `- ID: ${node.id}\n`;
      output += `- マッチ理由: ${node.match_reason}\n`;
      output += `- パス: ${node.path}\n`;
      output += `- 更新日時: ${node.updated_at}\n`;
      output += `- 抜粋: ${node.content_excerpt}\n\n`;
    }

    if (nodes.length === 0) {
      output += "該当するノードは見つかりませんでした。\n";
    }

    return { content: [{ type: "text" as const, text: output }] };
  })
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
