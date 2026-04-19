import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Toaster } from "@/components/ui/sonner";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let settings: Awaited<ReturnType<typeof prisma.appSettings.findUnique>> = null;
  try {
    settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });
  } catch (err) {
    console.error("[auth-layout] failed to read app settings", err);
    redirect("/setup");
  }
  if (!settings?.setupCompleted) {
    redirect("/setup");
  }

  let session: Session | null = null;
  try {
    session = (await auth()) as Session | null;
  } catch (err) {
    console.error("[auth-layout] failed to resolve session", err);
    redirect("/login");
  }
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <MobileLayout userRole={session.user.role} userName={session.user.name} userEmail={session.user.email}>
        {children}
      </MobileLayout>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "text-[13px]",
        }}
      />
    </>
  );
}
