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

// Singleton store pinned to globalThis so Next.js/Turbopack HMR reloads of
// this module don't orphan a live Baileys socket behind a reset "disconnected"
// state. Without this, a fresh module instance sees `socket = null` while the
// real socket is still running on the prior instance.
type GlobalStore = {
  socket: WASocket | null;
  sessionState: SessionState;
  starting: Promise<void> | null;
  intentionalLogout: boolean;
};

const globalKey = Symbol.for("app.whatsapp.session");
const globalObj = globalThis as unknown as { [k: symbol]: GlobalStore | undefined };

const store: GlobalStore =
  globalObj[globalKey] ??
  (globalObj[globalKey] = {
    socket: null,
    sessionState: {
      status: "disconnected",
      qr: null,
      linkedPhone: null,
      linkedName: null,
      lastError: null,
    },
    starting: null,
    intentionalLogout: false,
  });

export function getSessionState(): SessionState {
  // Self-heal: if the socket has authenticated (has a logged-in user) but the
  // status hasn't caught up (e.g. HMR orphaned the "open" event, or the update
  // was interleaved), derive "connected" from the live socket.
  const sock = store.socket;
  if (sock?.user && store.sessionState.status !== "connected") {
    const phone =
      sock.user.id?.split(":")[0]?.split("@")[0] ?? store.sessionState.linkedPhone;
    store.sessionState = {
      status: "connected",
      qr: null,
      linkedPhone: phone,
      linkedName:
        sock.user.name ?? sock.user.verifiedName ?? store.sessionState.linkedName,
      lastError: null,
    };
  }
  return { ...store.sessionState };
}

export async function startSession(): Promise<void> {
  if (store.socket && store.sessionState.status !== "disconnected") return;
  if (store.starting) return store.starting;

  store.starting = (async () => {
    try {
      store.sessionState = {
        status: "connecting",
        qr: null,
        linkedPhone: store.sessionState.linkedPhone,
        linkedName: store.sessionState.linkedName,
        lastError: null,
      };

      const { state, saveCreds } = await useDbAuthState();
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 0] as [number, number, number],
      }));

      store.socket = makeWASocket({
        version,
        auth: state,
        browser: Browsers.appropriate("Chrome"),
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });

      store.socket.ev.on("creds.update", saveCreds);

      store.socket.ev.on(
        "connection.update",
        async (update: Partial<ConnectionState>) => {
          const { connection, qr, lastDisconnect } = update;

          if (qr) {
            try {
              store.sessionState = {
                ...store.sessionState,
                status: "pairing",
                qr: await qrToDataURL(qr, { margin: 1, scale: 6 }),
                lastError: null,
              };
            } catch (err) {
              console.error("[whatsapp] QR render failed", err);
            }
          }

          if (connection === "open") {
            const me = store.socket?.user;
            const phone = me?.id?.split(":")[0]?.split("@")[0] ?? null;
            store.sessionState = {
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
                  whatsappLinkedName: store.sessionState.linkedName,
                },
                create: {
                  id: "default",
                  whatsappConnected: true,
                  whatsappLinkedPhone: phone,
                  whatsappLinkedName: store.sessionState.linkedName,
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
            store.socket = null;

            if (store.intentionalLogout || loggedOut) {
              store.intentionalLogout = false;
              await clearAuthState().catch(() => {});
              store.sessionState = {
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
            store.sessionState = {
              ...store.sessionState,
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
      store.socket.ev.on("messages.upsert", async (evt) => {
        try {
          if (store.socket) await handleIncomingMessages(store.socket, evt);
        } catch (err) {
          console.error("[whatsapp] message handler failed", err);
        }
      });
    } catch (err) {
      store.sessionState = {
        ...store.sessionState,
        status: "disconnected",
        lastError: err instanceof Error ? err.message : String(err),
      };
      store.socket = null;
      throw err;
    } finally {
      store.starting = null;
    }
  })();

  return store.starting;
}

export async function logoutSession(): Promise<void> {
  store.intentionalLogout = true;
  try {
    await store.socket?.logout();
  } catch {
    // ignore
  }
  try {
    store.socket?.end(undefined);
  } catch {
    // ignore
  }
  store.socket = null;
  await clearAuthState();
  store.sessionState = {
    status: "disconnected",
    qr: null,
    linkedPhone: null,
    linkedName: null,
    lastError: null,
  };
}

export function getSocket(): WASocket | null {
  return store.socket;
}

export function isConnected(): boolean {
  // A live authenticated socket is the source of truth; the status flag can
  // lag behind (see getSessionState).
  if (store.socket?.user) return true;
  return store.sessionState.status === "connected" && store.socket !== null;
}

export async function sendWhatsAppMessage(
  chatId: string,
  text: string
): Promise<{ messageId: string | null }> {
  // Trust socket liveness over the status flag — the flag can lag during
  // reconnects or HMR. If we have an authenticated socket, just send.
  const sock = store.socket;
  if (!sock?.user) {
    throw new Error("WhatsApp is not connected");
  }
  const res = await sock.sendMessage(chatId, { text });
  return { messageId: res?.key?.id ?? null };
}
