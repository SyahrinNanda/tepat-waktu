/**
 * In-process scheduler for the H-5 / H-2 subscription emails. It checks every hour; sends are
 * idempotent, so running several app instances or an external cron as well is harmless.
 * Disable with REMINDER_SCHEDULER=off (e.g. when an external cron calls /api/cron/subscription-reminders).
 */
const HOUR = 3_600_000;
const globalState = globalThis as typeof globalThis & { __tepatwaktuReminderTimer?: ReturnType<typeof setInterval> };

async function tick() {
  try {
    const { runSubscriptionReminders } = await import("./reminders");
    const result = await runSubscriptionReminders();
    if (result.sent || result.failed) console.info(`[pengingat-langganan] terkirim ${result.sent}, gagal ${result.failed}`, result.messages);
  } catch (error) {
    console.error("[pengingat-langganan] gagal dijalankan", error);
  }
}

export function startReminderScheduler() {
  if (process.env.REMINDER_SCHEDULER === "off" || !process.env.DATABASE_URL || globalState.__tepatwaktuReminderTimer) return;
  // First run shortly after boot, then hourly.
  setTimeout(tick, 60_000).unref?.();
  globalState.__tepatwaktuReminderTimer = setInterval(tick, HOUR);
  globalState.__tepatwaktuReminderTimer.unref?.();
}
