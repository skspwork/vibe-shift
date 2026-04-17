import { spawn, type ChildProcess } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const command = process.argv[2];
const flags = new Set(process.argv.slice(3));

function startApi(): ChildProcess {
  return spawn("node", [join(__dirname, "api/index.js")], {
    stdio: "inherit",
    env: { ...process.env },
  });
}

function startWeb(): ChildProcess {
  const webDir = join(__dirname, "web/apps/web");
  return spawn("node", [join(webDir, "server.js")], {
    stdio: "inherit",
    cwd: webDir,
    env: { ...process.env, PORT: process.env.WEB_PORT || "3000", HOSTNAME: process.env.HOSTNAME || "0.0.0.0" },
  });
}

if (command === "serve") {
  const apiOnly = flags.has("--api-only");
  const webOnly = flags.has("--web-only");

  const procs: ChildProcess[] = [];
  if (!webOnly) procs.push(startApi());
  if (!apiOnly) procs.push(startWeb());

  const cleanup = () => {
    for (const p of procs) p.kill();
    process.exit();
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  for (const p of procs) {
    p.on("exit", (code) => {
      console.error(`process exited with code ${code}`);
      for (const other of procs) if (other !== p) other.kill();
      process.exit(code || 1);
    });
  }

} else if (command === "mcp") {
  await import(pathToFileURL(join(__dirname, "mcp/index.js")).href);

} else {
  console.log("VibeShift - チーム開発の知識共有ツール");
  console.log("");
  console.log("使い方: vibeshift <command> [options]");
  console.log("");
  console.log("コマンド:");
  console.log("  serve              API + Web UIサーバーを起動 (API:3001, Web:3000)");
  console.log("    --api-only       APIサーバーのみ起動");
  console.log("    --web-only       Web UIのみ起動");
  console.log("  mcp                MCPサーバーを起動（Claude Code/Desktop用）");
  console.log("");
  console.log("環境変数 (サーバー側):");
  console.log("  PORT                APIサーバーのポート (デフォルト: 3001)");
  console.log("  WEB_PORT            Web UIのポート (デフォルト: 3000)");
  console.log("  VIBESHIFT_DB        DBファイルパス (デフォルト: ~/.vibeshift/vibeshift.db)");
  console.log("  VIBESHIFT_API_TOKEN チーム共有トークン（未設定なら認証無効・開発モード）");
  console.log("");
  console.log("環境変数 (MCPクライアント側):");
  console.log("  VIBESHIFT_API_URL   接続先APIのURL (デフォルト: http://localhost:3001)");
  console.log("  VIBESHIFT_API_TOKEN サーバーと同じトークン");
  console.log("  VIBESHIFT_USER_NAME このメンバーの名前 (チーム利用では必須)");
  process.exit(1);
}
