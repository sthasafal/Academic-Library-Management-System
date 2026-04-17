import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDbPath = path.resolve(__dirname, "../data/academic_graph.db");

let db;

export function getDbPath() {
  return process.env.GRAPH_DB_PATH || defaultDbPath;
}

export function getDb() {
  if (!db) {
    const dbPath = getDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma("foreign_keys = ON");
  }

  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}
