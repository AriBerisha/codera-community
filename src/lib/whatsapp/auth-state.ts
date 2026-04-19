import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  initAuthCreds,
  BufferJSON,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from "baileys";

type KeyStore = {
  [T in keyof SignalDataTypeMap]?: {
    [id: string]: SignalDataTypeMap[T];
  };
};

type Persisted = { creds: AuthenticationCreds; keys: KeyStore };

async function loadRaw(): Promise<Persisted | null> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { whatsappAuthState: true },
  });
  if (!settings?.whatsappAuthState) return null;
  try {
    const json = decrypt(settings.whatsappAuthState);
    return JSON.parse(json, BufferJSON.reviver) as Persisted;
  } catch (err) {
    console.error("[whatsapp] failed to decode auth state, discarding", err);
    return null;
  }
}

async function writeRaw(data: Persisted): Promise<void> {
  const json = JSON.stringify(data, BufferJSON.replacer);
  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: { whatsappAuthState: encrypt(json) },
    create: { id: "default", whatsappAuthState: encrypt(json) },
  });
}

export async function clearAuthState(): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {
      whatsappAuthState: null,
      whatsappConnected: false,
      whatsappLinkedPhone: null,
      whatsappLinkedName: null,
    },
    create: { id: "default" },
  });
}

export async function useDbAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const loaded = await loadRaw();
  const creds: AuthenticationCreds = loaded?.creds ?? initAuthCreds();
  const keys: KeyStore = loaded?.keys ?? {};

  let flushTimer: NodeJS.Timeout | null = null;
  const flush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      try {
        await writeRaw({ creds, keys });
      } catch (err) {
        console.error("[whatsapp] auth flush failed", err);
      }
    }, 150);
  };

  const keyStore = {
    get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
      const bucket = (keys[type] ?? {}) as Record<string, SignalDataTypeMap[T]>;
      const out: { [id: string]: SignalDataTypeMap[T] } = {};
      for (const id of ids) {
        if (bucket[id] !== undefined) out[id] = bucket[id];
      }
      return out;
    },
    set: async (data: { [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null } }) => {
      for (const rawType of Object.keys(data) as Array<keyof SignalDataTypeMap>) {
        const bucket =
          (keys[rawType] as Record<string, unknown> | undefined) ??
          ({} as Record<string, unknown>);
        const incoming = data[rawType];
        if (!incoming) continue;
        for (const id of Object.keys(incoming)) {
          const value = (incoming as Record<string, unknown>)[id];
          if (value === null || value === undefined) {
            delete bucket[id];
          } else {
            bucket[id] = value;
          }
        }
        (keys as Record<string, unknown>)[rawType] = bucket;
      }
      flush();
    },
    clear: async () => {
      for (const k of Object.keys(keys)) {
        delete (keys as Record<string, unknown>)[k];
      }
      flush();
    },
  };

  const state: AuthenticationState = {
    creds,
    keys: keyStore as unknown as AuthenticationState["keys"],
  };

  return {
    state,
    saveCreds: async () => {
      flush();
    },
  };
}
