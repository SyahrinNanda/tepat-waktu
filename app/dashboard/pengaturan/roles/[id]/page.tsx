import type { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Detail User Level · ${decodeURIComponent(id)}` };
}

export default async function Page({ params }: Props) {
  await params;
  redirect("/dashboard/pengaturan/roles");
}
