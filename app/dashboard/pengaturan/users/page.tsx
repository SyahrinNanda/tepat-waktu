import type { Metadata } from "next";
import { requireCompanyRole } from "@/lib/current-company";
import { fetchCompanyUsers } from "./actions";
import { UsersManager } from "./users-manager";

export const metadata: Metadata = { title: "Daftar User" };

export default async function Page() {
  const context = await requireCompanyRole(["admin"]);
  const users = await fetchCompanyUsers();

  return (
    <UsersManager
      key={users
        .map(
          (u) =>
            `${u.id}:${u.name}:${u.phone}:${u.role}:${u.isActive}:${u.isOtpLogin}`,
        )
        .join(";")}
      initialUsers={users}
      currentUserId={context.session.user.id}
    />
  );
}
