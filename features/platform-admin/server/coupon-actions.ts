"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { couponRedemptions, coupons } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/superadmin";
import { couponLabel, normalizeCouponCode } from "@/features/subscriptions/server/coupons";

export type CouponFormState = { status: "idle" | "success" | "error"; message: string };
const WITA = "+08:00";
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));
const optionalInt = (min: number) => z.union([z.literal(""), z.coerce.number().int().min(min)]).optional();

const couponSchema = z.object({
  code: z.string().transform(normalizeCouponCode).pipe(z.string().regex(/^[A-Z0-9_-]{3,30}$/, "Kode 3–30 karakter: huruf, angka, - atau _.")),
  description: z.string().trim().max(200).default(""),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().int().min(1, "Nilai diskon minimal 1."),
  minDurationMonths: z.coerce.number().int().refine((value) => [1, 3, 6, 8, 12].includes(value)),
  maxRedemptions: optionalInt(1),
  perCompanyLimit: z.coerce.number().int().min(1).max(100).default(1),
  startsAt: optionalDate,
  endsAt: optionalDate,
});

type CouponValues = Omit<typeof coupons.$inferInsert, "id" | "active" | "createdAt" | "createdBy">;

/** Parses the coupon form shared by create and edit. */
function parseCouponForm(formData: FormData): { error: string } | { data: z.infer<typeof couponSchema>; values: CouponValues } {
  const parsed = couponSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data kupon tidak valid." };
  const data = parsed.data;
  if (data.discountType === "percent" && data.discountValue > 100) return { error: "Diskon persen maksimal 100%." };
  const planCodes = formData.getAll("planCodes").map(String).filter(Boolean);
  const startsAt = data.startsAt ? new Date(`${data.startsAt}T00:00:00${WITA}`) : null;
  // The end date is inclusive: the coupon works until 23:59 WITA that day.
  const endsAt = data.endsAt ? new Date(`${data.endsAt}T23:59:59${WITA}`) : null;
  if (startsAt && endsAt && endsAt < startsAt) return { error: "Tanggal berakhir harus setelah tanggal mulai." };
  const values: CouponValues = {
    code: data.code, description: data.description, discountType: data.discountType, discountValue: data.discountValue,
    minDurationMonths: data.minDurationMonths, planCodes: planCodes.length ? planCodes : null,
    maxRedemptions: data.maxRedemptions === "" || data.maxRedemptions === undefined ? null : data.maxRedemptions,
    perCompanyLimit: data.perCompanyLimit, startsAt, endsAt,
  };
  return { data, values };
}

/** Every recorded redemption, including cancelled invoices (rejecting an invoice removes its redemption). */
async function redemptionCount(couponId: string) {
  const [row] = await db.select({ value: count() }).from(couponRedemptions).where(eq(couponRedemptions.couponId, couponId));
  return Number(row?.value ?? 0);
}

export async function createCoupon(_previous: CouponFormState, formData: FormData): Promise<CouponFormState> {
  const session = await requireSuperAdmin();
  const form = parseCouponForm(formData);
  if ("error" in form) return { status: "error", message: form.error };
  const { data, values } = form;

  const [existing] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.code, data.code)).limit(1);
  if (existing) return { status: "error", message: `Kode ${data.code} sudah dipakai kupon lain.` };

  await db.transaction(async (tx) => {
    await tx.insert(coupons).values({ ...values, createdBy: session.user.id });
    await recordAudit(session, { action: "coupon.create", summary: `Membuat kupon ${data.code} (${couponLabel(data)}${data.minDurationMonths > 1 ? `, min. ${data.minDurationMonths} bulan` : ""})`, metadata: { ...values } }, tx);
  });
  revalidatePath("/superadmin/kupon");
  return { status: "success", message: `Kupon ${data.code} dibuat.` };
}

export async function updateCoupon(_previous: CouponFormState, formData: FormData): Promise<CouponFormState> {
  const session = await requireSuperAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "Kupon tidak ditemukan." };
  const form = parseCouponForm(formData);
  if ("error" in form) return { status: "error", message: form.error };
  const { data, values } = form;

  const [current] = await db.select().from(coupons).where(eq(coupons.id, id.data)).limit(1);
  if (!current) return { status: "error", message: "Kupon tidak ditemukan." };
  if (values.code !== current.code) {
    // Invoices store the code as text, so a used coupon keeps its code.
    if (await redemptionCount(current.id)) return { status: "error", message: `Kode ${current.code} sudah dipakai di invoice dan tidak bisa diganti. Buat kupon baru untuk kode lain.` };
    const [taken] = await db.select({ id: coupons.id }).from(coupons).where(and(eq(coupons.code, values.code), ne(coupons.id, current.id))).limit(1);
    if (taken) return { status: "error", message: `Kode ${values.code} sudah dipakai kupon lain.` };
  }

  await db.transaction(async (tx) => {
    await tx.update(coupons).set(values).where(eq(coupons.id, current.id));
    await recordAudit(session, { action: "coupon.update", summary: `Mengubah kupon ${current.code}${values.code !== current.code ? ` menjadi ${values.code}` : ""} (${couponLabel(data)})`, metadata: { couponId: current.id, before: { ...current, createdAt: undefined }, after: values } }, tx);
  });
  revalidatePath("/superadmin/kupon");
  return { status: "success", message: `Kupon ${values.code} diperbarui. Perubahan berlaku untuk invoice baru.` };
}

export async function deleteCoupon(id: string): Promise<CouponFormState> {
  const session = await requireSuperAdmin();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { status: "error", message: "Kupon tidak ditemukan." };
  const [coupon] = await db.select({ id: coupons.id, code: coupons.code }).from(coupons).where(eq(coupons.id, parsed.data)).limit(1);
  if (!coupon) return { status: "error", message: "Kupon sudah dihapus." };
  // Deleting would erase its redemption history from the coupon and revenue reports.
  const used = await redemptionCount(coupon.id);
  if (used) return { status: "error", message: `Kupon ${coupon.code} sudah dipakai di ${used} invoice sehingga tidak bisa dihapus. Nonaktifkan kupon agar tidak bisa dipakai lagi.` };

  await db.transaction(async (tx) => {
    await tx.delete(coupons).where(eq(coupons.id, coupon.id));
    await recordAudit(session, { action: "coupon.delete", summary: `Menghapus kupon ${coupon.code}`, metadata: { couponId: coupon.id, code: coupon.code } }, tx);
  });
  revalidatePath("/superadmin/kupon");
  return { status: "success", message: `Kupon ${coupon.code} dihapus.` };
}

export async function setCouponActive(formData: FormData) {
  const session = await requireSuperAdmin();
  const { id, active } = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  const [coupon] = await db.update(coupons).set({ active: active === "true" }).where(eq(coupons.id, id)).returning({ code: coupons.code });
  if (coupon) await recordAudit(session, { action: "coupon.update", summary: `${active === "true" ? "Mengaktifkan" : "Menonaktifkan"} kupon ${coupon.code}`, metadata: { couponId: id, active } });
  revalidatePath("/superadmin/kupon");
}
