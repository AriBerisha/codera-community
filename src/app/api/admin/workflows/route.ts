import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

export async function GET() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workflows = await prisma.workflow.findMany({
    include: { steps: { orderBy: { order: "asc" } }, _count: { select: { executions: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(workflows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, description, steps } = await req.json();
  if (!name || !steps?.length) {
    return NextResponse.json({ error: "Name and steps are required" }, { status: 400 });
  }

  const workflow = await prisma.workflow.create({
    data: {
      name,
      description,
      steps: {
        create: steps.map((s: { name: string; type: string; config?: unknown }, i: number) => ({
          name: s.name,
          type: s.type,
          order: i,
          config: s.config || undefined,
        })),
      },
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(workflow);
}
