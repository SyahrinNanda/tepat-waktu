export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderScheduler } = await import("./features/subscriptions/server/reminder-scheduler");
    startReminderScheduler();
  }
}
