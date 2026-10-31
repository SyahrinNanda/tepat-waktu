import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum dikonfigurasi.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const emails = ["superadmin@tepatwaktu.id", "admin@tepatwaktu.id", "andi@tepatwaktu.id", "salsa@tepatwaktu.id", "raka@tepatwaktu.id", "maya@tepatwaktu.id", "bima@tepatwaktu.id"];
  const { rows } = await pool.query(`select u.email, u.platform_role, cm.role, c.name as company
    from "user" u left join company_members cm on cm.user_id = u.id
    left join companies c on c.id = cm.company_id where u.email = any($1) order by u.email`, [emails]);
  for (const account of rows) console.log(`${account.email} | ${account.platform_role === "superadmin" ? "superadmin" : account.role ?? "tanpa role"} | ${account.company ?? "platform"}`);
} finally { await pool.end(); }
