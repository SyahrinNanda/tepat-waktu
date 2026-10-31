import type { Metadata } from "next";
import { FeatureDetailPage } from "@/features/generic-modules/components/product-module-page";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Detail Laporan Kunjungan · ${decodeURIComponent(id)}` };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <FeatureDetailPage module="kunjungan/laporan" id={decodeURIComponent(id)} />;
}
