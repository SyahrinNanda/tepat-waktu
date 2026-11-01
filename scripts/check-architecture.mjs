import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const failures = [];
const forbiddenImports = [
  "@/components/announcement-manager",
  "@/components/attendance-checkin",
  "@/components/admin-attendance-form",
  "@/components/admin-attendance-modal",
  "@/components/division-manager",
  "@/components/leave-request-module",
  "@/components/product-module-page",
  "@/components/request-form",
  "@/components/shift-manager",
  "@/components/work-hours-manager",
  "@/lib/attendance-service",
  "@/lib/feature-modules",
  "@/lib/feature-records",
  "@/lib/image-upload",
];

async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(directory)) {
    if (["node_modules", ".next", ".git"].includes(entry)) continue;
    const path = join(directory, entry);
    if ((await stat(path)).isDirectory()) result.push(...await filesIn(path));
    else if (/\.(ts|tsx|mjs)$/.test(entry)) result.push(path);
  }
  return result;
}

for (const path of await filesIn(root)) {
  if (path === join(root, "scripts", "check-architecture.mjs")) continue;
  const source = await readFile(path, "utf8");
  for (const legacyImport of forbiddenImports) {
    if (source.includes(legacyImport)) failures.push(`${relative(root, path)} masih mengimpor ${legacyImport}`);
  }
  if (path.includes(`${join(root, "features")}`) && /from ["']@\/app\//.test(source)) {
    failures.push(`${relative(root, path)} bergantung kembali pada layer app/`);
  }
}

const requiredAdapters = [
  "app/dashboard/pengumuman/page.tsx",
  "app/dashboard/master/shift/page.tsx",
  "app/dashboard/master/jam-kerja/page.tsx",
  "app/dashboard/master/divisi/page.tsx",
];
for (const adapter of requiredAdapters) {
  const source = await readFile(join(root, adapter), "utf8");
  if (!source.includes("@/features/")) failures.push(`${adapter} belum menjadi adapter feature`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Boundary app/features valid.");
}
