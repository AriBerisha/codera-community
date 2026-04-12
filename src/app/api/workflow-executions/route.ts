import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId, workflowId } = await req.json();

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  if (!workflow || !workflow.isActive) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId,
      conversationId,
      userId: session.user.id,
      currentStepOrder: 0,
    },
    include: {
      workflow: { include: { steps: { orderBy: { order: "asc" } } } },
      fileChanges: true,
    },
  });

  return NextResponse.json(execution);
}
