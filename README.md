# VibeShift

AIとの協業における要件定義・仕様管理をグラフ構造で可視化し、トレーサビリティを担保するシステムです。
バイブコーディングにおいて、システムの規模が大きくなっても持続可能な開発を補助します。

## 主要機能

- **要件のグラフ管理** — 要求 → 機能 → 仕様 の階層構造でノードを管理
- **グラフ可視化** — ノード間の関係性を階層グラフとしてWeb UIで表示
- **トレーサビリティ** — 任意のノードから上流・下流をトレースし一貫性を確認
- **全文検索** — FTS5によるBM25ランキング付き全文検索
- **変更履歴** — ノードの変更理由を自動記録しタイムラインで表示
- **AI連携（MCP）** — MCPサーバー経由でAIエージェントからノードを直接操作
- **影響分析** — コード変更から影響を受けるノードを自動検出
- **HTMLエクスポート** — 要件を階層構造のHTML文書として出力

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15 (React 19), Tailwind CSS 4, XYFlow |
| バックエンド | Hono, Better-SQLite3, Drizzle ORM |
| AI連携 | Model Context Protocol (MCP) |
| ビルド | Turborepo, pnpm |

## セットアップ

### 前提条件

- Node.js 20+
- pnpm 9+

### インストール

```bash
git clone https://github.com/skspwork/vibe-shift.git
cd vibe-shift
pnpm install
```

### 環境変数の設定

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

`apps/api/.env` の `ANTHROPIC_API_KEY` に Anthropic APIキーを設定してください。

### データベースのマイグレーション

```bash
pnpm db:migrate
```

### 開発サーバーの起動

```bash
pnpm dev
```

- Web UI: http://localhost:3000
- API: http://localhost:3001

## MCPサーバーの接続

AIエージェント（Claude Code、Claude Desktop等）のMCP設定に以下を追加してください。

```json
{
  "mcpServers": {
    "vibeshift": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-server/src/index.ts"]
    }
  }
}
```

`.mcp.json.example` も参考にしてください。

## プロジェクトの作成

プロジェクトの作成・設定変更はMCPサーバー経由でAIエージェントから行います。

```
「VibeShiftに新しいプロジェクトを作成してください。システム名は○○で、目的は○○です。」
```

Web UIはグラフの閲覧・検索に使用します。

## ライセンス

[MIT](LICENSE)
