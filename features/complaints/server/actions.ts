"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employeeComplaints } from "@/db/schema";
import { categoryKeys, statusKeys } from "../config";
import { complaintContext } from "./complaint-service";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

const submitSchema = z.object({
  category: z.enum(categoryKeys),
  title: z.string().trim().min(5, "Judul minimal 5 karakter.").max(150),
  description: z.string().trim().min(20, "Ceritakan kejadian minimal 20 karakter.").max(5000),
  incidentDate: z.union([z.iso.date(), z.literal("")]).transform((value) => value || null),
  incidentLocation: optionalText(200),
  involvedParties: optionalText(500),
  anonymous: z.boolean(),
});

export async function submitComplaint(input: z.input<typeof submitSchema>) {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Data laporan belum lengkap." };
  const context = await complaintContext();
  if (context.isSuperAdmin) return { ok: false as const, error: "Super Admin tidak dapat membuat laporan keluhan." };
  const { anonymous, ...data } = parsed.data;
  const now = new Date();
  for (let attempt = 0; attempt < 3; attempt++) {
    const ticketCode = `KLH-${now.toISOString().slice(2, 7).replace("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
    try {
      const [row] = await db.insert(employeeComplaints).values({
        companyId: context.companyId, ticketCode, ...data, anonymous, reporterKey: context.reporterKey,
        // Anonymous reports keep no link to the reporter's account or name.
        reporterUserId: anonymous ? null : context.session.user.id,
        reporterName: anonymous ? null : context.session.user.name,
      }).returning({ id: employeeComplaints.id, ticketCode: employeeComplaints.ticketCode });
      revalidatePath("/dashboard/karyawan/keluhan");
      return { ok: true as const, id: row.id, ticketCode: row.ticketCode };
    } catch (error) {
      const code = typeof error === "object" && error && "cause" in error && typeof error.cause === "object" && error.cause && "code" in error.cause ? error.cause.code : undefined;
      if (code !== "23505") throw error;
    }
  }
  return { ok: false as const, error: "Laporan belum dapat disimpan. Silakan coba lagi." };
}

const updateSchema = z.object({
  id: z.uuid(),
  status: z.enum(statusKeys),
  responseNote: optionalText(3000),
  internalNote: optionalText(3000),
});

export async function updateComplaint(input: z.input<typeof updateSchema>) {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Data tindak lanjut tidak valid." };
  const context = await complaintContext();
  if (!context.canHandle) return { ok: false as const, error: "Hanya Admin dan HRD yang dapat menangani laporan." };
  const { id, ...data } = parsed.data;
  const [row] = await db.update(employeeComplaints).set({ ...data, handledBy: context.session.user.id, handledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(employeeComplaints.id, id), eq(employeeComplaints.companyId, context.companyId))).returning({ id: employeeComplaints.id });
  if (!row) return { ok: false as const, error: "Laporan tidak ditemukan." };
  revalidatePath("/dashboard/karyawan/keluhan");
  revalidatePath(`/dashboard/karyawan/keluhan/${id}`);
  return { ok: true as const };
}
