import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "path";

const dbPath = resolve(process.cwd(), "vibeshift.db");
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: resolve(import.meta.dirname, "../../drizzle") });

console.log("Migration completed");
sqlite.close();
