import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Midtrans Snap client (server side only).
 * Env: MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION ("true" for live).
 * MIDTRANS_SNAP_URL / MIDTRANS_API_URL override the endpoints (used by automated tests only).
 */
export function midtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim() ?? "";
  const clientKey = process.env.MIDTRANS_CLIENT_KEY?.trim() ?? "";
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  return {
    serverKey,
    clientKey,
    isProduction,
    configured: Boolean(serverKey && clientKey),
    snapUrl: (process.env.MIDTRANS_SNAP_URL || (isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com")).replace(/\/+$/, ""),
    apiUrl: (process.env.MIDTRANS_API_URL || (isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com")).replace(/\/+$/, ""),
  };
}

/** Public settings for the browser (client key is meant to be public). */
export function midtransPublicConfig() {
  const config = midtransConfig();
  return config.configured ? { clientKey: config.clientKey, snapJsUrl: `${config.snapUrl}/snap/snap.js` } : null;
}

export class MidtransError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

/** Failures that happen before the request leaves this server, so sending it again cannot duplicate anything. */
const NOT_SENT_CODES = new Set(["EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED"]);

/**
 * fetch() that reports network failures (DNS, timeout, connection reset) as MidtransError, so callers
 * show a "try again" message instead of crashing. Short DNS hiccups (EAI_AGAIN) get one quick retry.
 */
async function midtransFetch(url: string, init: RequestInit & { timeoutMs: number }) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs) });
    } catch (error) {
      const cause = error instanceof Error && error.cause && typeof error.cause === "object" ? error.cause as { code?: string; message?: string } : null;
      if (attempt < 2 && cause?.code && NOT_SENT_CODES.has(cause.code)) { await new Promise((resolve) => setTimeout(resolve, 800)); continue; }
      throw new MidtransError(`Tidak dapat terhubung ke Midtrans: ${cause?.message ?? (error instanceof Error ? error.message : String(error))}`);
    }
  }
}

function authHeader(serverKey: string) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

export type SnapItem = { id: string; name: string; price: number; quantity: number };

/** Payment methods offered in the app and the Snap channels each one opens. */
export const MIDTRANS_CHANNELS = {
  credit_card: ["credit_card"],
  bank_transfer: ["bca_va", "bni_va", "bri_va", "permata_va", "cimb_va", "echannel", "other_va"],
  shopeepay: ["shopeepay"],
  gopay: ["gopay"],
  qris: ["other_qris"],
  indomaret: ["indomaret"],
  alfamart: ["alfamart"],
  akulaku: ["akulaku"],
} as const satisfies Record<string, readonly string[]>;
export type PaymentMethod = keyof typeof MIDTRANS_CHANNELS;

export async function createSnapTransaction(input: {
  orderId: string;
  grossAmount: number;
  items: SnapItem[];
  enabledPayments: readonly string[];
  customer: { firstName: string; email: string; phone?: string | null };
  finishUrl: string;
}) {
  const config = midtransConfig();
  if (!config.configured) throw new MidtransError("Midtrans belum dikonfigurasi.");
  const itemTotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (itemTotal !== input.grossAmount) throw new MidtransError(`Rincian item (${itemTotal}) tidak sama dengan total (${input.grossAmount}).`);
  const response = await midtransFetch(`${config.snapUrl}/snap/v1/transactions`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", authorization: authHeader(config.serverKey) },
    body: JSON.stringify({
      transaction_details: { order_id: input.orderId, gross_amount: input.grossAmount },
      item_details: input.items.map((item) => ({ ...item, name: item.name.slice(0, 50) })),
      enabled_payments: input.enabledPayments,
      credit_card: { secure: true },
      customer_details: { first_name: input.customer.firstName.slice(0, 50), email: input.customer.email, ...(input.customer.phone ? { phone: input.customer.phone } : {}) },
      callbacks: { finish: input.finishUrl },
      // Unpaid transactions expire after 24 hours; the invoice can then be paid again.
      expiry: { unit: "hours", duration: 24 },
    }),
    timeoutMs: 20_000,
  });
  const body = await response.json().catch(() => ({})) as { token?: string; redirect_url?: string; error_messages?: string[] };
  if (!response.ok || !body.token) throw new MidtransError(body.error_messages?.join("; ") || `Midtrans menolak permintaan (HTTP ${response.status}).`, response.status);
  return { token: body.token, redirectUrl: body.redirect_url ?? null };
}

export type MidtransStatus = {
  order_id: string;
  transaction_status?: string;
  fraud_status?: string;
  status_code?: string;
  gross_amount?: string;
  payment_type?: string;
  transaction_id?: string;
};

/** Authoritative status from Midtrans (GET /v2/{order_id}/status). Null when Midtrans has no such order. */
export async function getTransactionStatus(orderId: string): Promise<MidtransStatus | null> {
  const config = midtransConfig();
  if (!config.configured) throw new MidtransError("Midtrans belum dikonfigurasi.");
  const response = await midtransFetch(`${config.apiUrl}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { accept: "application/json", authorization: authHeader(config.serverKey) },
    timeoutMs: 15_000,
  });
  const body = await response.json().catch(() => ({})) as MidtransStatus & { status_code?: string };
  if (response.status === 404 || body.status_code === "404") return null;
  if (!response.ok) throw new MidtransError(`Status Midtrans tidak dapat dibaca (HTTP ${response.status}).`, response.status);
  return body;
}

/** Midtrans signature: SHA512(order_id + status_code + gross_amount + server_key). */
export function verifyNotificationSignature(payload: { order_id?: unknown; status_code?: unknown; gross_amount?: unknown; signature_key?: unknown }) {
  const { serverKey } = midtransConfig();
  if (!serverKey || typeof payload.signature_key !== "string") return false;
  const expected = createHash("sha512").update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`).digest("hex");
  const given = payload.signature_key.toLowerCase();
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Maps a Midtrans status to what it means for the invoice. */
export function paymentOutcome(status: Pick<MidtransStatus, "transaction_status" | "fraud_status">): "paid" | "pending" | "failed" | "refunded" | "unknown" {
  const fraudOk = !status.fraud_status || status.fraud_status === "accept";
  switch (status.transaction_status) {
    case "settlement": return fraudOk ? "paid" : "pending";
    case "capture": return status.fraud_status === "accept" || !status.fraud_status ? "paid" : "pending";
    case "pending": case "authorize": return "pending";
    case "deny": case "cancel": case "expire": case "failure": return "failed";
    case "refund": case "partial_refund": case "chargeback": case "partial_chargeback": return "refunded";
    default: return "unknown";
  }
}
