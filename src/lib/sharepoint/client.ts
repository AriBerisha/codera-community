export interface GraphSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
}

export interface GraphDriveItem {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  file?: { mimeType: string };
  folder?: { childCount: number };
  parentReference?: { path: string };
  eTag?: string;
  "@microsoft.graph.downloadUrl"?: string;
}

/** File types we can extract text from. */
const INDEXABLE_EXTENSIONS = new Set([
  // Documents
  ".docx", ".doc",
  // Text
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".xml", ".yaml", ".yml",
  // Web
  ".html", ".htm",
  // Code / config (useful for documentation repos)
  ".rst", ".adoc", ".tex",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function isIndexableFile(name: string, size: number): boolean {
  if (size > MAX_FILE_SIZE) return false;
  const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
  return INDEXABLE_EXTENSIONS.has(ext);
}

export function isDocx(name: string): boolean {
  return name.toLowerCase().endsWith(".docx");
}

export class SharePointClient {
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(tenantId: string, clientId: string, clientSecret: string) {
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /** Acquire an access token via OAuth 2.0 client credentials flow. */
  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const url = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Azure AD token error ${res.status}: ${text}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    // Expire 5 minutes early to be safe
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
    return this.accessToken!;
  }

  private async request<T>(path: string): Promise<T> {
    const token = await this.getToken();
    const url = path.startsWith("https://")
      ? path
      : `https://graph.microsoft.com/v1.0${path}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  /** Download raw file content as a Buffer. */
  async downloadFile(downloadUrl: string): Promise<Buffer> {
    const token = await this.getToken();
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`File download error ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Validate credentials by fetching org info. */
  async validateConnection(): Promise<{ displayName: string }> {
    return this.request("/organization?$select=displayName")
      .then((data: unknown) => {
        const org = data as { value: Array<{ displayName: string }> };
        return { displayName: org.value[0]?.displayName ?? "Unknown" };
      });
  }

  /** List all SharePoint sites the app has access to. */
  async listSites(): Promise<GraphSite[]> {
    const results: GraphSite[] = [];
    let url: string | null = "https://graph.microsoft.com/v1.0/sites?search=*&$select=id,name,displayName,webUrl&$top=100";

    while (url) {
      const token = await this.getToken();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Graph API error ${res.status}: ${text}`);
      }
      const data = await res.json() as { value: GraphSite[]; "@odata.nextLink"?: string };
      results.push(...data.value);
      url = data["@odata.nextLink"] ?? null;
    }

    return results;
  }

  /** List all files in the default document library of a site, recursively. */
  async listSiteFiles(siteId: string): Promise<GraphDriveItem[]> {
    const results: GraphDriveItem[] = [];

    // Get the default drive
    const drives = await this.request<{ value: Array<{ id: string }> }>(
      `/sites/${siteId}/drives?$select=id&$top=1`
    );
    if (drives.value.length === 0) return results;
    const driveId = drives.value[0].id;

    // Recursively walk the drive
    await this.walkFolder(driveId, "root", results);

    return results;
  }

  private async walkFolder(driveId: string, folderId: string, results: GraphDriveItem[]): Promise<void> {
    let url: string | null =
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children?$select=id,name,webUrl,size,file,folder,parentReference,eTag&$top=200`;

    while (url) {
      const token = await this.getToken();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) break;
      const data = await res.json() as { value: GraphDriveItem[]; "@odata.nextLink"?: string };

      for (const item of data.value) {
        if (item.folder) {
          await this.walkFolder(driveId, item.id, results);
        } else if (item.file) {
          results.push(item);
        }
      }

      url = data["@odata.nextLink"] ?? null;
    }
  }

  /** Get a single drive item with a download URL. */
  async getDriveItem(siteId: string, itemId: string): Promise<GraphDriveItem> {
    // Get the default drive ID first
    const drives = await this.request<{ value: Array<{ id: string }> }>(
      `/sites/${siteId}/drives?$select=id&$top=1`
    );
    const driveId = drives.value[0].id;
    return this.request(`/drives/${driveId}/items/${itemId}`);
  }
}
