import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { name, description, isActive, isDefault, steps } = await req.json();

  await prisma.$transaction(async (tx) => {
    if (steps) {
      await tx.workflowStep.deleteMany({ where: { workflowId: id } });
    }
    if (isDefault) {
      await tx.workflow.updateMany({ data: { isDefault: false } });
    }
    await tx.workflow.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(isDefault !== undefined && { isDefault }),
        ...(steps && {
          steps: {
            create: steps.map((s: { name: string; type: string; config?: unknown }, i: number) => ({
              name: s.name, type: s.type, order: i, config: s.config || undefined,
            })),
          },
        }),
      },
    });
  });

  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(workflow);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.workflow.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
