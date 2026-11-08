// Creates (or promotes) a platform superadmin without any demo data.
//
// Manual:   npm run superadmin:create -- --email admin@domain.com --password "RahasiaPanjang!" [--name "Nama"] [--reset-password]
//           (or SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD / SUPERADMIN_NAME in the environment)
// On deploy: the migrate service runs it with --if-none after the migrations. Nothing happens unless
//           SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are set, and only while no superadmin exists yet.
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);
const pg = require("pg");

// .env.local when run locally. The production image has no @next/env (and no .env files), so it is optional.
try { require("@next/env").loadEnvConfig(process.cwd()); } catch { /* container: environment comes from Coolify */ }

/**
 * Same format and parameters as Better Auth's hashPassword (@better-auth/utils/password, node build):
 * scrypt(NFKC password, 16-byte hex salt string, N=16384 r=16 p=1, 64 bytes) -> "<salt>:<hex key>".
 * Kept here so the script runs in the slim production image without Better Auth installed.
 * Verified against Better Auth's verifyPassword (8 Nov 2026); re-check if Better Auth changes its hashing.
 * SUPERADMIN_HASH_ONLY=1 node scripts/create-superadmin.mjs "<password>" prints a hash for such a check.
 */
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
    (error, key) => (error ? reject(error) : resolve(`${salt}:${key.toString("hex")}`))));
}

if (process.env.SUPERADMIN_HASH_ONLY === "1") { console.log(await hashPassword(process.argv[2] ?? "")); process.exit(0); }

const { values: args } = parseArgs({
  options: {
    email: { type: "string" }, password: { type: "string" }, name: { type: "string" },
    "if-none": { type: "boolean", default: false }, "reset-password": { type: "boolean", default: false },
  },
});
const email = (args.email ?? process.env.SUPERADMIN_EMAIL ?? "").trim().toLowerCase();
const password = args.password ?? process.env.SUPERADMIN_PASSWORD ?? "";
const name = (args.name ?? process.env.SUPERADMIN_NAME ?? "Super Admin TepatWaktu").trim() || "Super Admin TepatWaktu";
const ifNone = args["if-none"];

// --if-none runs on every container start: it must never stop the app. Problems are logged and skipped.
const fail = (message) => {
  if (ifNone) { console.warn(`[superadmin] ${message} Dilewati; aplikasi tetap dijalankan.`); process.exit(0); }
  console.error(`[superadmin] ${message}`); process.exit(1);
};
if (!process.env.DATABASE_URL) fail("DATABASE_URL belum diisi.");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

if (ifNone) {
  // Checked first: once a superadmin exists (e.g. SUPERADMIN_PASSWORD was removed after the first
  // login, as the deploy guide says), the SUPERADMIN_* variables are irrelevant.
  const { rows } = await db.query(`select email from "user" where platform_role = 'superadmin' limit 1`);
  if (rows.length) {
    console.log(`[superadmin] Sudah ada superadmin (${rows[0].email}), dilewati.`);
    await db.end();
    process.exit(0);
  }
  if (!email && !password) {
    console.log("[superadmin] SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD tidak diisi, dilewati.");
    await db.end();
    process.exit(0);
  }
}
const invalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Email tidak valid. Pakai --email atau SUPERADMIN_EMAIL."
  // Same bounds as Better Auth's defaults, so the account can log in and change its password normally.
  : password.length < 8 || password.length > 128 ? "Password harus 8–128 karakter. Pakai --password atau SUPERADMIN_PASSWORD." : null;
if (invalid) { await db.end(); fail(invalid); }

try {
  await db.query("BEGIN");
  if (ifNone) {
    // Re-check inside the transaction in case another container created one meanwhile.
    const { rows } = await db.query(`select email from "user" where platform_role = 'superadmin' limit 1`);
    if (rows.length) {
      console.log(`[superadmin] Sudah ada superadmin (${rows[0].email}), dilewati.`);
      await db.query("ROLLBACK");
      process.exit(0);
    }
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const { rows: [existing] } = await db.query(`select id from "user" where email = $1 for update`, [email]);
  let userId = existing?.id;
  if (userId) {
    await db.query(`update "user" set platform_role = 'superadmin', email_verified = true, updated_at = $2 where id = $1`, [userId, now]);
  } else {
    userId = randomUUID();
    await db.query(
      `insert into "user" (id, name, email, email_verified, platform_role, created_at, updated_at) values ($1, $2, $3, true, 'superadmin', $4, $4)`,
      [userId, name, email, now],
    );
  }

  const { rows: [credential] } = await db.query(`select id from account where user_id = $1 and provider_id = 'credential'`, [userId]);
  let passwordNote;
  if (!credential) {
    await db.query(
      `insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at) values ($1, $2, 'credential', $2, $3, $4, $4)`,
      [randomUUID(), userId, passwordHash, now],
    );
    passwordNote = "password diatur";
  } else if (args["reset-password"]) {
    await db.query(`update account set password = $2, updated_at = $3 where id = $1`, [credential.id, passwordHash, now]);
    await db.query(`delete from session where user_id = $1`, [userId]);
    passwordNote = "password diganti, sesi lama dikeluarkan";
  } else {
    passwordNote = "password lama dipertahankan (tambahkan --reset-password untuk menggantinya)";
  }
  await db.query("COMMIT");
  console.log(`[superadmin] ${existing ? "Akun dijadikan superadmin" : "Superadmin dibuat"}: ${email} — ${passwordNote}.`);
} catch (error) {
  await db.query("ROLLBACK").catch(() => undefined);
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await db.end();
}
