import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const command = process.argv[2];

if (command === "serve") {
  // Start API server
  const apiProcess = spawn("node", [join(__dirname, "api/index.js")], {
    stdio: "inherit",
    env: { ...process.env },
  });

  // Start Next.js standalone server
  const webDir = join(__dirname, "web/apps/web");
  const webProcess = spawn("node", [join(webDir, "server.js")], {
    stdio: "inherit",
    cwd: webDir,
    env: { ...process.env, PORT: process.env.WEB_PORT || "3000" },
  });

  const cleanup = () => {
    apiProcess.kill();
    webProcess.kill();
    process.exit();
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  apiProcess.on("exit", (code) => {
    console.error(`API server exited with code ${code}`);
    webProcess.kill();
    process.exit(code || 1);
  });
  webProcess.on("exit", (code) => {
    console.error(`Web server exited with code ${code}`);
    apiProcess.kill();
    process.exit(code || 1);
  });

} else if (command === "mcp") {
  await import(pathToFileURL(join(__dirname, "mcp/index.js")).href);

} else {
  console.log("VibeShift - AIドリブン開発のためのトレーサビリティ管理");
  console.log("");
  console.log("使い方: vibeshift <command>");
  console.log("");
  console.log("コマンド:");
  console.log("  serve   API + Web UIサーバーを起動 (API:3001, Web:3000)");
  console.log("  mcp     MCPサーバーを起動（Claude Code/Desktop用）");
  console.log("");
  console.log("環境変数:");
  console.log("  PORT           APIサーバーのポート (デフォルト: 3001)");
  console.log("  WEB_PORT       Web UIのポート (デフォルト: 3000)");
  console.log("  VIBESHIFT_DB   DBファイルパス (デフォルト: ~/.vibeshift/vibeshift.db)");
  process.exit(1);
}
