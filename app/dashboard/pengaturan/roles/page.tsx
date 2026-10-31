import type { Metadata } from "next";
import { requireCompanyRole } from "@/lib/current-company";
import { fetchUserLevelsAction } from "./actions";
import { RolesManager } from "./roles-manager";

export const metadata: Metadata = { title: "Daftar User Level" };

export default async function Page() {
  await requireCompanyRole(["admin"]);
  const roles = await fetchUserLevelsAction();

  return (
    <RolesManager
      key={roles.map((r) => `${r.id}:${r.name}:${r.accessActions}`).join(";")}
      initialRoles={roles}
    />
  );
}
