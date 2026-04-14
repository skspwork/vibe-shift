import Database, { type Database as DatabaseType } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { resolve, dirname } from "path";
import { homedir } from "os";
import { mkdirSync } from "fs";

const defaultDir = resolve(homedir(), ".vibeshift");
const dbPath = process.env.VIBESHIFT_DB || resolve(defaultDir, "vibeshift.db");
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export const rawDb: DatabaseType = sqlite;
export { schema };
