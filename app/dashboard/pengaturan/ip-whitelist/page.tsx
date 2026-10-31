import type { Metadata } from "next";
import { requireCompanyRole } from "@/lib/current-company";
import { fetchIpWhitelistsAction } from "./actions";
import { IpWhitelistManager } from "./ip-whitelist-manager";

export const metadata: Metadata = { title: "Daftar IP Whitelist" };

export default async function Page() {
  await requireCompanyRole(["admin"]);
  const items = await fetchIpWhitelistsAction();

  return (
    <IpWhitelistManager
      key={items.map((i) => `${i.id}:${i.ip}`).join(";")}
      initialItems={items}
    />
  );
}
