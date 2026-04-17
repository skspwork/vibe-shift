# VibeShift

**チーム開発の知識共有ツール**。AIが作り、人が承認する — コードに紐付いた構造化知識をチームで共有します。

## なぜVibeShift？

チームで開発していると、こんな課題に直面します：

- 「なぜこの仕様になったんだっけ？」— 過去の意思決定の理由が分からない
- 新人が参加するたびに同じ説明を繰り返す
- Confluence は散文で読みづらい、git log は変更しか分からない

VibeShiftは **Confluence / git log / Slack の隙間** を埋める、コード隣接の構造化知識グラフです。AIエージェント (Claude Code / Desktop 等) が対話からノードを生成し、人が承認するだけ。チーム全員が同じAPIに接続して、知識を共有します。

| ツール | 役割 |
|---|---|
| Confluence / Notion | 散文ドキュメント・議事録 |
| git log / PR | コード変更の履歴 |
| **VibeShift** | **コードに紐付いた構造化決定ログ + 要求・機能・仕様の階層** |

## 主な価値

- **過去の意思決定の追跡** — すべてのノードに変更理由 (`reason`) と作成者が記録され、3ヶ月後でも「なぜこうなったか」が分かる
- **新人のオンボーディング** — プロジェクトの要求 → 機能 → 仕様の階層を読めば、全体像が掴める
- **AIが書く、人が承認** — ルーティンのドキュメント作業はAIに任せ、チームメンバーはレビューと意思決定に集中

## クイックスタート（個人利用）

### 前提

- Node.js 20+

### 共有デプロイからインストール

```bash
npm install -g vibeshift
vibeshift serve
```

- Web UI: http://localhost:3000
- API: http://localhost:3001

データは `~/.vibeshift/vibeshift.db` に保存されます。

## チーム利用（共有デプロイ）

1チームで1つのAPIサーバーを立て、全メンバーが自分のClaude Code/Desktop経由でそこに接続します。

### 1. チーム共有サーバーの起動

社内ネットワーク上のサーバーで:

```bash
# 認証トークンを設定して起動（API + Web UI）
VIBESHIFT_API_TOKEN=your-team-secret vibeshift serve

# Web UIだけ別サーバーに分けたい場合
VIBESHIFT_API_TOKEN=your-team-secret vibeshift serve --api-only
vibeshift serve --web-only
```

環境変数:

| 変数 | 説明 |
|---|---|
| `VIBESHIFT_API_TOKEN` | 共有シークレット。未設定なら認証無効（開発モード） |
| `VIBESHIFT_DB` | DBファイルパス。デフォルト `~/.vibeshift/vibeshift.db` |
| `PORT` | APIのポート (デフォルト 3001) |
| `WEB_PORT` | Web UIのポート (デフォルト 3000) |

本格的なOAuth/OIDCは未対応。信頼された社内ネットワークでの利用を想定しています。

### 2. 各メンバーのMCP設定

各メンバーの `claude_desktop_config.json` (または Claude Code の `.mcp.json`):

```json
{
  "mcpServers": {
    "vibeshift": {
      "command": "vibeshift",
      "args": ["mcp"],
      "env": {
        "VIBESHIFT_API_URL": "https://vibeshift.team.internal",
        "VIBESHIFT_API_TOKEN": "your-team-secret",
        "VIBESHIFT_USER_NAME": "alice"
      }
    }
  }
}
```

| 変数 | 説明 |
|---|---|
| `VIBESHIFT_API_URL` | チーム共有APIのURL |
| `VIBESHIFT_API_TOKEN` | サーバー側と同じトークン |
| `VIBESHIFT_USER_NAME` | このメンバーの名前（ノード・変更履歴の作成者として記録） |

これでノードの作成者や変更履歴がメンバーごとに区別され、Web UIの詳細パネルに「作成者: alice」「by bob」のように表示されます。

## 開発者向け（ソースからのビルド）

```bash
git clone https://github.com/skspwork/vibe-shift.git
cd vibe-shift
npm install
npm run build
npm run dev
```

### npm パッケージのビルド

```bash
npm run build:package   # dist/ にビルド成果物を生成
npm pack                # .tgz を生成（動作確認用）
npm publish             # npm レジストリに公開
```

## 使い方

### プロジェクトの作成

AIエージェントにこう話しかけるだけ:

```
「VibeShiftに新しいプロジェクトを作成してください。
 システム名は○○で、目的は○○です。」
```

AIが `create_project` ツールでプロジェクトを作成し、overviewノードを自動生成します。

### 要件定義の進め方

```
「このプロジェクトの要求を洗い出してください」
「要求ごとの機能を定義してください」
「この機能の仕様を詳細化してください」
```

作成されたノードはWeb UIのグラフビューで確認できます。

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

```
overview（システム概要）
  └─ need（要求）— なぜ必要か
       └─ feature（機能）— 何を実現するか
            └─ spec（仕様）— どう動くか
```

各ノードの内容はマークダウン形式で記述でき、Web UIの詳細パネルでレンダリングされます。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15 (React 19), Tailwind CSS 4, XYFlow |
| バックエンド | Hono, Better-SQLite3, Drizzle ORM |
| AI連携 | Model Context Protocol (MCP) |
| ビルド | Turborepo |

## プロジェクト構成

```
vibe-shift/
├── apps/
│   ├── api/          # Hono APIサーバー
│   └── web/          # Next.js フロントエンド
├── packages/
│   ├── mcp-server/   # MCPサーバー（AIエージェント用）
│   └── shared/       # 共有スキーマ・型定義
├── cli/              # vibeshift コマンド (npmパッケージ用)
└── scripts/          # ビルドスクリプト
```

## ロードマップ

- [x] 多人数アイデンティティ（`VIBESHIFT_USER_NAME`）
- [x] 共有トークン認証
- [ ] プロジェクト横断の決定タイムラインビュー
- [ ] オンボーディング・ナラティブ（サブツリー → 読み物マークダウン）
- [ ] ノードとコードファイルの構造的リンク (`file_paths`)
- [ ] GitHub/GitLab PR webhook 連携
- [ ] OAuth/OIDC 本格認証

## ライセンス

[MIT](LICENSE)
