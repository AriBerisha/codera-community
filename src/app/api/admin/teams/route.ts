import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth-utils";

/** GET — list all teams. */
export async function GET() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const teams = await prisma.team.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json(teams);
}

/** POST — create a new team. */
export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await req.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Team name is required" },
      { status: 400 }
    );
  }

  // Generate slug from name
  const baseSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Ensure slug is unique
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.team.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const team = await prisma.team.create({
    data: { name: name.trim(), slug },
  });

  return NextResponse.json(team, { status: 201 });
}
