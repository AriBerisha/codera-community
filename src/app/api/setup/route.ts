import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // Check if setup already completed
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });

    if (settings?.setupCompleted) {
      return NextResponse.json(
        { error: "Setup already completed" },
        { status: 400 }
      );
    }

    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin user and mark setup as complete in a transaction
    await prisma.$transaction([
      prisma.user.create({
        data: {
          name,
          email,
          hashedPassword,
          role: "OWNER",
        },
      }),
      prisma.appSettings.upsert({
        where: { id: "default" },
        update: { setupCompleted: true },
        create: { id: "default", setupCompleted: true },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Failed to complete setup" },
      { status: 500 }
    );
  }
}
