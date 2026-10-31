import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";

// On some Windows Node 24 installations, tsx aborts while reading os.userInfo().
// Bundle only the local TypeScript files; dependencies still resolve normally.
const entry = fileURLToPath(new URL("./seed.ts", import.meta.url));
const output = fileURLToPath(new URL(`./.seed-${randomUUID()}.cjs`, import.meta.url));
try {
  await build({ entryPoints: [entry], outfile: output, bundle: true, packages: "external", platform: "node", format: "cjs", logLevel: "silent" });
  const result = spawnSync(process.execPath, [output], { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  try { unlinkSync(output); } catch { /* Build may have failed before output existed. */ }
}
