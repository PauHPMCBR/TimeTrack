// Next.js instrumentation hook: runs once when the server starts. Starts the
// daily inconsistency-reminder scheduler (no external cron needed). Whether
// reminders are actually sent is the company's `inconsistencyReminderEnabled`
// setting, stored in the DB and editable from the admin panel.
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { scheduleDailyReminder } = await import('@/lib/reminders');
        scheduleDailyReminder();
    }
}