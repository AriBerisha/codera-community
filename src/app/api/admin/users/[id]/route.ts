import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Helper: is the caller an admin-level user? */
function isAdmin(role: string) {
  return role === "ADMIN" || role === "OWNER";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { name, role } = await req.json();

  // Look up the target user to enforce hierarchy
  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const callerRole = session.user.role;

  // Nobody can change the OWNER role
  if (target.role === "OWNER") {
    // Owner can update their own name, but nobody can change OWNER's role
    if (role !== undefined && role !== "OWNER") {
      return NextResponse.json(
        { error: "Cannot change the owner's role" },
        { status: 403 }
      );
    }
    if (id !== session.user.id) {
      return NextResponse.json(
        { error: "Cannot modify the owner" },
        { status: 403 }
      );
    }
  }

  // Only OWNER can promote to/demote from ADMIN
  if (role !== undefined && callerRole !== "OWNER") {
    if (role === "ADMIN" || role === "OWNER" || target.role === "ADMIN") {
      return NextResponse.json(
        { error: "Only the owner can manage admin roles" },
        { status: 403 }
      );
    }
  }

  // Nobody can promote themselves or others to OWNER
  if (role === "OWNER") {
    return NextResponse.json(
      { error: "Cannot assign owner role" },
      { status: 403 }
    );
  }

  // Determine the safe role value
  const validRoles = ["ADMIN", "MEMBER"];
  const safeRole = role !== undefined && validRoles.includes(role) ? role : undefined;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(safeRole !== undefined && { role: safeRole }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent deleting yourself
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  // Look up the target user
  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Cannot delete the owner
  if (target.role === "OWNER") {
    return NextResponse.json(
      { error: "Cannot delete the owner account" },
      { status: 403 }
    );
  }

  // Only OWNER can delete admins
  if (target.role === "ADMIN" && session.user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only the owner can remove admins" },
      { status: 403 }
    );
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
