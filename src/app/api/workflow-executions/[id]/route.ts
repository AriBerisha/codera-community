import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const execution = await prisma.workflowExecution.findUnique({
    where: { id, userId: session.user.id },
    include: {
      workflow: { include: { steps: { orderBy: { order: "asc" } } } },
      fileChanges: { orderBy: { filePath: "asc" } },
    },
  });

  if (!execution) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(execution);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const execution = await prisma.workflowExecution.update({
    where: { id, userId: session.user.id },
    data: {
      ...(body.currentStepOrder !== undefined && { currentStepOrder: body.currentStepOrder }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.planText !== undefined && { planText: body.planText }),
      ...(body.commitBranch !== undefined && { commitBranch: body.commitBranch }),
      ...(body.commitMessage !== undefined && { commitMessage: body.commitMessage }),
      ...(body.commitResult !== undefined && { commitResult: body.commitResult }),
    },
    include: {
      workflow: { include: { steps: { orderBy: { order: "asc" } } } },
      fileChanges: { orderBy: { filePath: "asc" } },
    },
  });

  return NextResponse.json(execution);
}
