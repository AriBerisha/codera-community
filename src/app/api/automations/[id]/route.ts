import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

/** GET — single automation with recent runs. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const automation = await prisma.automation.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      runs: {
        orderBy: { startedAt: "desc" },
        take: 50,
      },
    },
  });

  if (!automation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isAdminRole(session.user.role) && automation.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(automation);
}

/** PATCH — update automation. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.instructions !== undefined) data.instructions = body.instructions;
  if (body.cronExpression !== undefined)
    data.cronExpression = body.cronExpression;
  if (body.scheduleType !== undefined) data.scheduleType = body.scheduleType;
  if (body.scheduleConfig !== undefined)
    data.scheduleConfig = body.scheduleConfig;
  if (body.dataSources !== undefined) data.dataSources = body.dataSources;
  if (body.emailRecipients !== undefined)
    data.emailRecipients = body.emailRecipients;
  if (body.enabled !== undefined) data.enabled = body.enabled;

  const automation = await prisma.automation.update({
    where: { id },
    data,
  });

  return NextResponse.json(automation);
}

/** DELETE — remove automation and all its runs. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.automation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
