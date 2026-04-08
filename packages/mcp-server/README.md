# VibeShift MCP Server

VibeShiftのMCPサーバー。Claude Desktop等のAI Agentから直接ノード操作が可能。

## セットアップ

### 1. ビルド

```bash
cd packages/mcp-server
pnpm build
```

### 2. Claude Desktop設定

`claude_desktop_config.json` に以下を追加:

```json
{
  "mcpServers": {
    "VibeShift": {
      "command": "node",
      "args": ["C:/sksp/vibe-shift/packages/mcp-server/dist/index.js"],
      "env": {
        "VIBESHIFT_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### 3. APIサーバーの起動

MCPサーバーはバックエンドAPIに接続するため、事前にAPIサーバーを起動しておく必要があります���

```bash
cd apps/api
pnpm dev
```

## 提供ツール

| ツール | 説明 |
|-------|------|
| `create_changelog` | 変遷記録作成 |
| `create_node` | ノード作成 |
| `update_node` | ノード更新 |
| `link_nodes` | エッジ作成 |
| `get_trace` | 上流・下流トレース取得 |
| `get_node_context` | 親ノードコンテキスト取得 |
| `get_project_graph` | グラフ全体取得 |
| `search_nodes` | テキスト検索 |
