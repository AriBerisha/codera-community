import { redirect } from "next/navigation";
import { SetupForm } from "./setup-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Setup is a one-time onboarding step. If it's already done, this page has
  // no purpose — send the user to /chat if they're signed in, otherwise /login.
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });
  if (settings?.setupCompleted) {
    const session = await auth();
    redirect(session?.user ? "/chat" : "/login");
  }

  return <SetupForm />;
}
