import { NextResponse } from "next/server";
import { after } from "next/server";
import { runDueAutomations } from "@/lib/automations/runner";

/**
 * GET /api/automations/cron
 *
 * Call this endpoint on a schedule (e.g. every minute via system cron,
 * Vercel cron, or an external scheduler) to trigger any due automations.
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
    try {
      const result = await runDueAutomations();
      console.log(
        `[Cron] Triggered ${result.triggered} automation(s):`,
        result.ids
      );
    } catch (err) {
      console.error("[Cron] Failed to run due automations:", err);
    }
  });

  return NextResponse.json({ success: true, message: "Cron check started" });
}
