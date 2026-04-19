import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-utils";
import { logoutSession } from "@/lib/whatsapp/session";

/** POST — Log out the linked WhatsApp session and clear auth state. */
export async function POST() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await logoutSession();
  return NextResponse.json({ success: true });
}
