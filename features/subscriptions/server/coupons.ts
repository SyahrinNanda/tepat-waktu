import { and, count, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { couponRedemptions, coupons, subscriptionOrders } from "@/db/schema";

type Executor = Pick<typeof db, "select">;
export type CouponCheck =
  | { ok: true; couponId: string; code: string; discount: number; label: string }
  | { ok: false; message: string };

export const normalizeCouponCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");

export function couponLabel(coupon: { discountType: "percent" | "fixed"; discountValue: number }) {
  return coupon.discountType === "percent" ? `${coupon.discountValue}%` : `Rp ${coupon.discountValue.toLocaleString("id-ID")}`;
}

/**
 * Validates a coupon for one invoice and computes its discount. Rejected and cancelled
 * invoices do not count as uses. Pass `lock` inside a transaction to serialise concurrent uses.
 * `companyId: null` (a company that does not exist yet, at registration) skips the per-company limit.
 */
export async function evaluateCoupon(
  input: { code: string; companyId: string | null; planCode: string; durationMonths: number; subtotal: number },
  options: { executor?: Executor; lock?: boolean; now?: Date } = {},
): Promise<CouponCheck> {
  const executor = options.executor ?? db;
  const now = options.now ?? new Date();
  const code = normalizeCouponCode(input.code);
  if (!code) return { ok: false, message: "Masukkan kode kupon." };
  if (input.subtotal <= 0) return { ok: false, message: "Kupon tidak berlaku untuk paket gratis." };

  const query = executor.select().from(coupons).where(eq(coupons.code, code)).limit(1);
  const [coupon] = options.lock ? await query.for("update") : await query;
  if (!coupon || !coupon.active) return { ok: false, message: "Kode kupon tidak ditemukan atau sudah tidak aktif." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, message: "Kupon belum bisa dipakai." };
  if (coupon.endsAt && coupon.endsAt <= now) return { ok: false, message: "Masa berlaku kupon sudah habis." };
  if (coupon.planCodes?.length && !coupon.planCodes.includes(input.planCode)) return { ok: false, message: "Kupon tidak berlaku untuk paket ini." };
  if (input.durationMonths < coupon.minDurationMonths) return { ok: false, message: `Kupon hanya berlaku untuk durasi minimal ${coupon.minDurationMonths} bulan.` };

  const counted = and(eq(couponRedemptions.couponId, coupon.id), notInArray(subscriptionOrders.status, ["rejected", "cancelled"]));
  const base = () => executor.select({ value: count() }).from(couponRedemptions).innerJoin(subscriptionOrders, eq(couponRedemptions.orderId, subscriptionOrders.id));
  const [[used], [usedByCompany]] = await Promise.all([
    base().where(counted),
    input.companyId ? base().where(and(counted, eq(couponRedemptions.companyId, input.companyId))) : Promise.resolve([{ value: 0 }]),
  ]);
  if (coupon.maxRedemptions !== null && Number(used.value) >= coupon.maxRedemptions) return { ok: false, message: "Kuota kupon sudah habis." };
  if (Number(usedByCompany.value) >= coupon.perCompanyLimit) return { ok: false, message: "Perusahaan Anda sudah memakai kupon ini." };

  const raw = coupon.discountType === "percent" ? Math.round(input.subtotal * coupon.discountValue / 100) : coupon.discountValue;
  const discount = Math.min(input.subtotal, Math.max(0, raw));
  return { ok: true, couponId: coupon.id, code: coupon.code, discount, label: couponLabel(coupon) };
}

/** Usage per coupon (excluding rejected/cancelled invoices). */
export async function couponUsage() {
  return db.select({ couponId: couponRedemptions.couponId, uses: count(), discount: sql<number>`coalesce(sum(${couponRedemptions.discountAmount}), 0)::int` })
    .from(couponRedemptions).innerJoin(subscriptionOrders, eq(couponRedemptions.orderId, subscriptionOrders.id))
    .where(notInArray(subscriptionOrders.status, ["rejected", "cancelled"])).groupBy(couponRedemptions.couponId);
}
