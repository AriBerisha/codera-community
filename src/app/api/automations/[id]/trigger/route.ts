import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeAutomation } from "@/lib/automations/runner";
import { isAdminRole } from "@/lib/auth-utils";

/** POST — manually trigger an automation run. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const automation = await prisma.automation.findUnique({ where: { id } });
  if (!automation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  after(async () => {
    try {
      await executeAutomation(id);
    } catch (err) {
      console.error(`Manual trigger failed for automation ${id}:`, err);
    }
  });

  return NextResponse.json({ success: true, message: "Automation triggered" });
}
