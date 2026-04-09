# VibeShift

AIとの協業における要件定義・仕様管理をグラフ構造で可視化し、トレーサビリティを担保するシステムです。

バイブコーディングにおいて、システムの規模が大きくなると「何を作ろうとしていたか」「なぜこの仕様にしたか」が失われがちです。VibeShiftは**要求 → 機能 → 仕様**の階層構造でこれらを管理し、AIエージェントとの対話を通じて持続可能な開発を支援します。

## 特徴

- **AIエージェントが直接操作** — MCPサーバー経由で、AIが要件の作成・更新・検索を行う
- **グラフで可視化** — ノード間の関係性を階層グラフとしてWeb UIで表示
- **トレーサビリティ** — 任意のノードから上流・下流を辿り、要求から仕様までの一貫性を確認
- **変更理由の自動記録** — 「何を・なぜ変更したか」を変更履歴として自動保存
- **影響分析** — コード変更から影響を受ける要件・仕様を自動検出
- **ローカル完結** — SQLiteベースで外部サービス不要、3コマンドで起動

## 画面イメージ

Web UIではノードの階層構造をグラフとして表示し、クリックで詳細（マークダウン形式の内容・変更履歴）を確認できます。

## クイックスタート

### 前提条件

- Node.js 20+
- pnpm 9+

### 1. クローン & インストール

```bash
git clone https://github.com/skspwork/vibe-shift.git
cd vibe-shift
pnpm install
```

### 2. ビルド

```bash
pnpm build
```

共有パッケージ（`@vibeshift/shared`）のビルドに必要です。初回のみ実行してください。

### 3. 開発サーバーの起動

```bash
pnpm dev
```

- **Web UI**: http://localhost:3000
- **API**: http://localhost:3001

環境変数の設定は不要です。デフォルトでローカル動作します。

## MCPサーバーの接続

VibeShiftのMCPサーバーをAIエージェントに接続すると、対話を通じてプロジェクトの作成や要件定義ができるようになります。

### Claude Code の場合

プロジェクトルートの `.mcp.json` に以下を設定します（`.mcp.json.example` を参考にしてください）：

```json
{
  "mcpServers": {
    "vibeshift": {
      "command": "npx",
      "args": ["tsx", "/path/to/vibe-shift/packages/mcp-server/src/index.ts"]
    }
  }
}
```

`/path/to/vibe-shift/` はVibeShiftをクローンした場所の絶対パスに置き換えてください。

### Claude Desktop の場合

`claude_desktop_config.json` に同様の設定を追加してください。

### その他のMCP対応AIエージェント

stdio方式でMCPサーバーに接続できるエージェントであれば利用可能です。起動コマンドは `npx tsx /path/to/vibe-shift/packages/mcp-server/src/index.ts` です。

## 使い方

### プロジェクトの作成

プロジェクトの作成・設定変更はAIエージェント経由で行います。Web UIは閲覧専用です。

```
「VibeShiftに新しいプロジェクトを作成してください。
 システム名は○○で、目的は○○です。」
```

AIが `create_project` ツールでプロジェクトを作成し、overviewノードを自動生成します。

### 要件定義の進め方

AIエージェントに以下のように依頼すると、対話を通じて要件を洗い出せます：

```
「このプロジェクトの要求を洗い出してください」
「要求ごとの機能を定義してください」
「この機能の仕様を詳細化してください」
```

作成されたノードはWeb UI（http://localhost:3000）のグラフビューで確認できます。

### MCPツール一覧

| ツール名 | 説明 |
|---------|------|
| `create_project` | プロジェクトを作成 |
| `update_project` | プロジェクト設定を更新 |
| `list_projects` | プロジェクト一覧を取得 |
| `consult_context` | プロジェクト全体のツリー構造を取得 |
| `create_changelog` | 変更履歴を作成 |
| `create_node` | ノードを作成（need/feature/spec） |
| `update_node` | ノードを更新 |
| `delete_node` | ノードを非活性化 |
| `enable_node` | ノードを再活性化 |
| `search_nodes` | ノードを全文検索 |
| `search_disabled_nodes` | 非活性ノードを検索 |
| `link_nodes` | ノード間にリンクを作成 |
| `delete_edge` | リンクを削除 |
| `list_edges` | リンク一覧を取得 |
| `get_trace` | 上流・下流トレースを取得 |
| `get_implementation_brief` | 実装指示書を生成 |
| `check_impact` | コード変更の影響範囲を分析 |

## ノードの階層構造

VibeShiftでは要件を4段階の階層で管理します：

```
overview（システム概要）
  └─ need（要求）— なぜ必要か
       └─ feature（機能）— 何を実現するか
            └─ spec（仕様）— どう動くか
```

各ノードの内容はマークダウン形式で記述でき、Web UIの詳細パネルでレンダリング表示されます。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15 (React 19), Tailwind CSS 4, XYFlow |
| バックエンド | Hono, Better-SQLite3, Drizzle ORM |
| AI連携 | Model Context Protocol (MCP) |
| ビルド | Turborepo, pnpm |

## プロジェクト構成

```
vibe-shift/
├── apps/
│   ├── api/          # Hono APIサーバー（port 3001）
│   └── web/          # Next.js フロントエンド（port 3000）
├── packages/
│   ├── mcp-server/   # MCPサーバー（AIエージェント用）
│   └── shared/       # 共有スキーマ・型定義
└── package.json      # Turborepoモノレポルート
```

## ライセンス

[MIT](LICENSE)
