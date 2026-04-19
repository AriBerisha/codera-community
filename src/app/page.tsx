import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  let settings: Awaited<ReturnType<typeof prisma.appSettings.findUnique>> = null;
  try {
    settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });
  } catch (err) {
    console.error("[home] failed to read app settings", err);
    redirect("/setup");
  }

  if (!settings?.setupCompleted) {
    redirect("/setup");
  }

  let session: Session | null = null;
  try {
    session = (await auth()) as Session | null;
  } catch (err) {
    console.error("[home] failed to resolve session", err);
    redirect("/login");
  }
  if (!session) {
    redirect("/login");
  }

  redirect("/chat");
}
