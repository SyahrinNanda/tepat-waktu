import { timingSafeEqual } from "node:crypto";
import { runSubscriptionReminders } from "./reminders";

/** For an external scheduler: `Authorization: Bearer $CRON_SECRET`. Disabled when CRON_SECRET is unset. */
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
  return Response.json(await runSubscriptionReminders());
}

export const GET = handle;
export const POST = handle;
