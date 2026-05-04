import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, getDb, getDbPath } from "./connection.js";
import { seedDatabase } from "./seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadSchema() {
  return fs.readFileSync(path.resolve(__dirname, "./schema.sql"), "utf8");
}

function migrateSchema(db) {
  const nodeColumns = db.prepare("PRAGMA table_info(Nodes)").all();
  const hasAttributesJson = nodeColumns.some((column) => column.name === "AttributesJson");

  if (!hasAttributesJson) {
    db.exec(`
      ALTER TABLE Nodes
      ADD COLUMN AttributesJson TEXT NOT NULL DEFAULT '{}'
    `);
  }
}

export function ensureDatabase(options = {}) {
  const { force = false } = options;

  if (force) {
    closeDb();
  }

  const db = getDb();
  db.exec(loadSchema());
  migrateSchema(db);

  const row = db.prepare("SELECT COUNT(*) AS count FROM Nodes").get();

  if (force || row.count === 0) {
    seedDatabase(db);
  }

  return db;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes("--force");
  ensureDatabase({ force });
  console.log(`Database ready at ${getDbPath()}`);
}
