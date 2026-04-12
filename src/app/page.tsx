import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export default async function Home() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.setupCompleted) {
    redirect("/setup");
  }

  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  redirect("/chat");
}
