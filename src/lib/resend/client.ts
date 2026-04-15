const RESEND_API_URL = "https://api.resend.com";

export interface SendEmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export interface SendEmailResult {
  id: string;
}

export class ResendClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const res = await fetch(`${RESEND_API_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  /** Validate the API key by fetching domains (allowed for send-only keys). */
  async validateConnection(): Promise<void> {
    await this.request("/domains");
  }

  /** Send an email. */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    return this.request<SendEmailResult>("/emails", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }
}
