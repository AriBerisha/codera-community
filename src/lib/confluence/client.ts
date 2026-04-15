export interface ConfluenceSpaceResponse {
  id: string;
  key: string;
  name: string;
  description?: { plain?: { value: string } };
  _links: { webui: string };
}

export interface ConfluencePageResponse {
  id: string;
  title: string;
  spaceId: string;
  _links: { webui: string };
  body?: {
    storage?: { value: string };
  };
}

/**
 * Strip HTML/storage-format tags to plain text.
 */
export function storageToPlainText(html: string): string {
  return html
    .replace(/<ac:[^>]*\/>/g, "") // self-closing Atlassian macros
    .replace(/<ac:[^>]*>[\s\S]*?<\/ac:[^>]*>/g, "") // block Atlassian macros
    .replace(/<ri:[^>]*\/>/g, "") // resource identifiers
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "") // remaining tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n") // collapse blank lines
    .trim();
}

export class ConfluenceClient {
  private baseUrl: string;
  private wikiBase: string;
  private authHeader: string;

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.wikiBase = `${this.baseUrl}/wiki`;
    this.authHeader = "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64");
  }

  private async request<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Confluence API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  async validateConnection(): Promise<{ accountId: string; displayName: string }> {
    // Use the Atlassian /myself endpoint (same as Jira)
    return this.request(`${this.baseUrl}/rest/api/3/myself`);
  }

  async listSpaces(): Promise<ConfluenceSpaceResponse[]> {
    interface SpaceListResponse {
      results: ConfluenceSpaceResponse[];
      _links?: { next?: string };
    }

    const results: ConfluenceSpaceResponse[] = [];
    let nextUrl: string | null = `${this.wikiBase}/api/v2/spaces?limit=25&sort=name`;

    while (nextUrl) {
      const data: SpaceListResponse = await this.request(nextUrl);
      results.push(...data.results);
      nextUrl = data._links?.next ? `${this.wikiBase}${data._links.next}` : null;
    }

    return results;
  }

  async listSpacePages(spaceId: string): Promise<ConfluencePageResponse[]> {
    interface PageListResponse {
      results: ConfluencePageResponse[];
      _links?: { next?: string };
    }

    const results: ConfluencePageResponse[] = [];
    let nextUrl: string | null =
      `${this.wikiBase}/api/v2/spaces/${spaceId}/pages?limit=25&sort=modified-date&body-format=storage`;

    while (nextUrl) {
      const data: PageListResponse = await this.request(nextUrl);
      results.push(...data.results);
      nextUrl = data._links?.next ? `${this.wikiBase}${data._links.next}` : null;
    }

    return results;
  }

  /** Build browser URL for a space. */
  spaceUrl(spaceKey: string): string {
    return `${this.wikiBase}/spaces/${spaceKey}`;
  }

  /** Build browser URL for a page. */
  pageUrl(webuiLink: string): string {
    return `${this.wikiBase}${webuiLink}`;
  }
}
