import { NextResponse } from "next/server";
import { after } from "next/server";
import { runDueAutomations } from "@/lib/automations/runner";
import { syncTelegramAndReply } from "@/lib/telegram/sync";

/**
 * GET /api/automations/cron
 *
 * Call this endpoint on a schedule (e.g. every minute via system cron,
 * Vercel cron, or an external scheduler) to trigger any due automations
 * and sync Telegram messages + auto-replies.
 *
 * Optionally protect with a CRON_SECRET env var.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  after(async () => {
    // Run due automations
    try {
      const result = await runDueAutomations();
      if (result.triggered > 0) {
        console.log(
          `[Cron] Triggered ${result.triggered} automation(s):`,
          result.ids
        );
      }
    } catch (err) {
      console.error("[Cron] Failed to run due automations:", err);
    }

    // Sync Telegram + auto-reply
    try {
      const tg = await syncTelegramAndReply();
      if (tg.synced > 0 || tg.replied > 0) {
        console.log(
          `[Cron] Telegram: synced ${tg.synced} message(s), replied to ${tg.replied}`
        );
      }
    } catch (err) {
      console.error("[Cron] Telegram sync failed:", err);
    }
  });

  return NextResponse.json({ success: true, message: "Cron check started" });
}
