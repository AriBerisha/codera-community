import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type ConnectionState,
  type WASocket,
} from "baileys";
import { toDataURL as qrToDataURL } from "qrcode";
import { prisma } from "@/lib/prisma";
import { useDbAuthState, clearAuthState } from "./auth-state";

type Status = "disconnected" | "connecting" | "pairing" | "connected";

type SessionState = {
  status: Status;
  qr: string | null; // data URL for UI
  linkedPhone: string | null;
  linkedName: string | null;
  lastError: string | null;
};

let socket: WASocket | null = null;
let sessionState: SessionState = {
  status: "disconnected",
  qr: null,
  linkedPhone: null,
  linkedName: null,
  lastError: null,
};
let starting: Promise<void> | null = null;
let intentionalLogout = false;

export function getSessionState(): SessionState {
  return { ...sessionState };
}

export async function startSession(): Promise<void> {
  if (socket && sessionState.status !== "disconnected") return;
  if (starting) return starting;

  starting = (async () => {
    try {
      sessionState = {
        status: "connecting",
        qr: null,
        linkedPhone: sessionState.linkedPhone,
        linkedName: sessionState.linkedName,
        lastError: null,
      };

      const { state, saveCreds } = await useDbAuthState();
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 0] as [number, number, number],
      }));

      socket = makeWASocket({
        version,
        auth: state,
        browser: Browsers.appropriate("Chrome"),
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });

      socket.ev.on("creds.update", saveCreds);

      socket.ev.on(
        "connection.update",
        async (update: Partial<ConnectionState>) => {
          const { connection, qr, lastDisconnect } = update;

          if (qr) {
            try {
              sessionState = {
                ...sessionState,
                status: "pairing",
                qr: await qrToDataURL(qr, { margin: 1, scale: 6 }),
                lastError: null,
              };
            } catch (err) {
              console.error("[whatsapp] QR render failed", err);
            }
          }

          if (connection === "open") {
            const me = socket?.user;
            const phone = me?.id?.split(":")[0]?.split("@")[0] ?? null;
            sessionState = {
              status: "connected",
              qr: null,
              linkedPhone: phone,
              linkedName: me?.name ?? me?.verifiedName ?? null,
              lastError: null,
            };
            await prisma.appSettings
              .upsert({
                where: { id: "default" },
                update: {
                  whatsappConnected: true,
                  whatsappLinkedPhone: phone,
                  whatsappLinkedName: sessionState.linkedName,
                },
                create: {
                  id: "default",
                  whatsappConnected: true,
                  whatsappLinkedPhone: phone,
                  whatsappLinkedName: sessionState.linkedName,
                },
              })
              .catch((err) =>
                console.error("[whatsapp] settings upsert failed", err)
              );
          }

          if (connection === "close") {
            const reason =
              (lastDisconnect?.error as { output?: { statusCode?: number } })
                ?.output?.statusCode ?? null;

            const loggedOut = reason === DisconnectReason.loggedOut;
            const restartRequired = reason === DisconnectReason.restartRequired;
            const badSession = reason === DisconnectReason.badSession;
            socket = null;

            if (intentionalLogout || loggedOut) {
              intentionalLogout = false;
              await clearAuthState().catch(() => {});
              sessionState = {
                status: "disconnected",
                qr: null,
                linkedPhone: null,
                linkedName: null,
                lastError: loggedOut ? "Logged out from device" : null,
              };
              return;
            }

            // restartRequired is expected right after QR pairing and on
            // stream-error/conflict events. Surface as "connecting" rather
            // than leaving a stream-error message in the UI.
            const willReconnect = !badSession;
            sessionState = {
              ...sessionState,
              status: willReconnect ? "connecting" : "disconnected",
              qr: null,
              lastError: willReconnect
                ? null
                : lastDisconnect?.error?.message ?? null,
            };

            if (willReconnect) {
              const delay = restartRequired ? 250 : 2000;
              setTimeout(() => {
                startSession().catch((err) =>
                  console.error("[whatsapp] reconnect failed", err)
                );
              }, delay);
            }
          }
        }
      );

      const { handleIncomingMessages } = await import("./sync");
      socket.ev.on("messages.upsert", async (evt) => {
        try {
          await handleIncomingMessages(socket!, evt);
        } catch (err) {
          console.error("[whatsapp] message handler failed", err);
        }
      });
    } catch (err) {
      sessionState = {
        ...sessionState,
        status: "disconnected",
        lastError: err instanceof Error ? err.message : String(err),
      };
      socket = null;
      throw err;
    } finally {
      starting = null;
    }
  })();

  return starting;
}

export async function logoutSession(): Promise<void> {
  intentionalLogout = true;
  try {
    await socket?.logout();
  } catch {
    // ignore
  }
  try {
    socket?.end(undefined);
  } catch {
    // ignore
  }
  socket = null;
  await clearAuthState();
  sessionState = {
    status: "disconnected",
    qr: null,
    linkedPhone: null,
    linkedName: null,
    lastError: null,
  };
}

export function getSocket(): WASocket | null {
  return socket;
}

export function isConnected(): boolean {
  return sessionState.status === "connected" && socket !== null;
}

export async function sendWhatsAppMessage(
  chatId: string,
  text: string
): Promise<{ messageId: string | null }> {
  if (!socket || sessionState.status !== "connected") {
    throw new Error("WhatsApp is not connected");
  }
  const res = await socket.sendMessage(chatId, { text });
  return { messageId: res?.key?.id ?? null };
}
