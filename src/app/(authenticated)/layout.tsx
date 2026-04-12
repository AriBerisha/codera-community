import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Toaster } from "@/components/ui/sonner";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check setup
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });
  if (!settings?.setupCompleted) {
    redirect("/setup");
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <MobileLayout userRole={session.user.role} userName={session.user.name}>
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
