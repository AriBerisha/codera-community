import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { ssoEnabled, auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // If setup hasn't been completed yet, there's nobody to log in as.
  // Send users to /setup to create the initial OWNER account.
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });
  if (!settings?.setupCompleted) {
    redirect("/setup");
  }

  // Already signed in? Skip the form and go straight to /chat.
  const session = await auth();
  if (session?.user) {
    redirect("/chat");
  }

  return <LoginForm ssoEnabled={ssoEnabled} />;
}
