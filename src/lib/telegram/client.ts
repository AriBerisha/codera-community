const BASE_URL = "https://api.telegram.org";

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

interface TelegramEntity {
  type: string; // "mention", "bot_command", etc.
  offset: number;
  length: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; username?: string; is_bot?: boolean };
    chat: { id: number; title?: string; type: string };
    date: number;
    text?: string;
    entities?: TelegramEntity[];
  };
}

export type { TelegramUpdate, TelegramUser, TelegramEntity };

export class TelegramClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${BASE_URL}/bot${this.token}/${method}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || "Unknown error"}`);
    }
    return data.result as T;
  }

  /** Validate the bot token by calling getMe. */
  async validateConnection(): Promise<TelegramUser> {
    return this.request<TelegramUser>("getMe");
  }

  /** Delete any active webhook so getUpdates works. */
  async deleteWebhook(): Promise<boolean> {
    return this.request<boolean>("deleteWebhook", { drop_pending_updates: false });
  }

  /** Set a webhook URL for receiving updates. */
  async setWebhook(url: string, secretToken?: string): Promise<boolean> {
    return this.request<boolean>("setWebhook", {
      url,
      allowed_updates: ["message"],
      ...(secretToken && { secret_token: secretToken }),
    });
  }

  /** Check if a webhook is currently set. */
  async getWebhookInfo(): Promise<{ url: string }> {
    return this.request<{ url: string }>("getWebhookInfo");
  }

  /** Get recent messages (updates) the bot has received. */
  async getUpdates(limit = 50, offset?: number): Promise<TelegramUpdate[]> {
    return this.request<TelegramUpdate[]>("getUpdates", {
      limit,
      allowed_updates: ["message"],
      ...(offset !== undefined && { offset }),
    });
  }

  /** Send a text message to a chat. */
  async sendMessage(chatId: number | string, text: string): Promise<{ message_id: number; chat: { id: number } }> {
    return this.request("sendMessage", {
      chat_id: chatId,
      text,
    });
  }
}
