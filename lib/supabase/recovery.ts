import { createHmac, timingSafeEqual } from "node:crypto";

export const RECOVERY_COOKIE = "tepatwaktu_recovery";

function signature(payload: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET belum dikonfigurasi.");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createRecoveryProof(userId: string) {
  const payload = `${userId}.${Date.now() + 10 * 60 * 1000}`;
  return `${payload}.${signature(payload)}`;
}

export function validRecoveryProof(value: string | undefined, userId: string) {
  if (!value) return false;
  const [id, expires, mac, extra] = value.split(".");
  if (extra || id !== userId || !expires || !mac || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(signature(`${id}.${expires}`), "hex");
  const supplied = Buffer.from(mac, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
