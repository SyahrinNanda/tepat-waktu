import { revalidatePath } from "next/cache";
import { z } from "zod";
import { featureContext } from "@/features/generic-modules/server/feature-records";
import { completeVisit, visitScope } from "@/features/visits/server/visit-service";

export const runtime = "nodejs";

/** Marks a visit as done. Staff: their own; Manager: their Divisi; Admin, GM, HRD: the company. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await featureContext(request, "kunjungan", "write");
  if ("error" in context) return context.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Kunjungan tidak ditemukan." }, { status: 404 });
  const scope = await visitScope(context);
  if (!scope) return Response.json({ error: "Akun belum terhubung ke data karyawan aktif." }, { status: 403 });
  const row = await completeVisit(context.companyId, id, scope);
  if (!row) return Response.json({ error: "Kunjungan tidak ditemukan." }, { status: 404 });
  revalidatePath("/dashboard/kunjungan");
  revalidatePath("/dashboard/kunjungan/laporan");
  return Response.json({ ok: true, status: row.status });
}
