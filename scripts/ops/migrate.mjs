// Applies pending SQL migrations from ./drizzle (next to this file in the image, ../../drizzle in the repo).
// Uses drizzle-orm's migrator, which records progress in the same "drizzle"."__drizzle_migrations" table as
// `drizzle-kit migrate`, so databases migrated either way stay compatible. Exits non-zero on failure so the
// container stops instead of serving a half-migrated schema.
//
//   node scripts/ops/migrate.mjs            (repo, reads DATABASE_URL)
//   RUN_MIGRATIONS=off                      skips it (e.g. when a separate migrate service already ran)
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

if ((process.env.RUN_MIGRATIONS || "on").toLowerCase() === "off") {
  console.log("[migrate] RUN_MIGRATIONS=off, dilewati.");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error("[migrate] DATABASE_URL belum diisi.");
  process.exit(1);
}

const migrationsFolder = [join(here, "drizzle"), join(here, "..", "..", "drizzle")].find((dir) => existsSync(join(dir, "meta", "_journal.json")));
if (!migrationsFolder) {
  console.error("[migrate] Folder migrasi (drizzle/meta/_journal.json) tidak ditemukan.");
  process.exit(1);
}

const pg = require("pg");
const { drizzle } = await import("drizzle-orm/node-postgres");
const { migrate } = await import("drizzle-orm/node-postgres/migrator");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const started = Date.now();
try {
  const count = async () => (await pool.query(`select count(*)::int as n from "drizzle"."__drizzle_migrations"`).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
  const before = await count();
  await migrate(drizzle(pool), { migrationsFolder });
  const after = await count();
  console.log(`[migrate] Selesai dalam ${Date.now() - started} ms: ${after - before} migrasi baru diterapkan, total ${after}.`);
} catch (error) {
  // Drizzle wraps the driver error ("Failed query: ..."); the useful reason (bad password, unknown host,
  // missing database) is in the cause chain.
  const reasons = [];
  for (let current = error, depth = 0; current && depth < 4; current = current.cause, depth++) {
    const text = [current.code, current.message].filter(Boolean).join(" ");
    if (text && !reasons.includes(text)) reasons.push(text);
  }
  console.error("[migrate] GAGAL:", reasons.join(" <- ") || String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
