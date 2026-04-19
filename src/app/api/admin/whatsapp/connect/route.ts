import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-utils";
import { startSession, getSessionState } from "@/lib/whatsapp/session";

/** POST — Start the WhatsApp session. First call begins pairing (QR). */
export async function POST() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await startSession();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, state: getSessionState() });
}
