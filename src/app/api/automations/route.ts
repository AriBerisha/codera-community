import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

/** GET — list all automations for the current user (admins see all). */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where =
    isAdminRole(session.user.role) ? {} : { userId: session.user.id };

  const automations = await prisma.automation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { runs: true } },
    },
  });

  return NextResponse.json(automations);
}

/** POST — create a new automation. */
export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, instructions, cronExpression, scheduleType, scheduleConfig, dataSources, emailRecipients, telegramChatIds, enabled } =
    await req.json();

  if (!title || !instructions) {
    return NextResponse.json(
      { error: "Title and instructions are required" },
      { status: 400 }
    );
  }

  const automation = await prisma.automation.create({
    data: {
      title,
      instructions,
      cronExpression: cronExpression ?? "0 * * * *",
      scheduleType: scheduleType ?? "interval",
      scheduleConfig: scheduleConfig ?? null,
      dataSources: dataSources ?? [],
      emailRecipients: emailRecipients ?? [],
      telegramChatIds: telegramChatIds ?? [],
      enabled: enabled ?? true,
      userId: session!.user!.id,
    },
  });

  return NextResponse.json(automation, { status: 201 });
}
