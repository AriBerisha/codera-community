export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { prisma } = await import("@/lib/prisma");
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
      select: { whatsappAuthState: true },
    });
    if (!settings?.whatsappAuthState) return;

    const { startSession } = await import("@/lib/whatsapp/session");
    await startSession();
    console.log("[whatsapp] session auto-started from saved auth");
  } catch (err) {
    console.error("[whatsapp] auto-start failed", err);
  }
}
