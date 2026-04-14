export interface JiraProjectResponse {
  id: string;
  key: string;
  name: string;
  description?: string;
  self: string;
}

export interface JiraIssueResponse {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description: unknown | null; // ADF document
    issuetype: { name: string };
    status: { name: string };
    priority?: { name: string } | null;
    assignee?: { displayName: string; accountId: string } | null;
    reporter?: { displayName: string; accountId: string } | null;
    labels: string[];
    comment?: {
      comments: Array<{
        body: unknown; // ADF document
        author?: { displayName: string };
      }>;
    };
  };
}

export interface JiraSearchResponse {
  issues: JiraIssueResponse[];
  total: number;
}

/**
 * Convert Atlassian Document Format (ADF) to plain text.
 * ADF is a nested JSON structure used by Jira Cloud API v3.
 */
export function adfToPlainText(adf: unknown): string {
  if (!adf || typeof adf !== "object") return "";

  const node = adf as { type?: string; text?: string; content?: unknown[] };

  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }

  if (Array.isArray(node.content)) {
    const parts = node.content.map((child) => adfToPlainText(child));

    // Add newlines between block-level nodes
    if (
      node.type === "doc" ||
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "bulletList" ||
      node.type === "orderedList" ||
      node.type === "listItem" ||
      node.type === "blockquote" ||
      node.type === "codeBlock" ||
      node.type === "table" ||
      node.type === "tableRow"
    ) {
      return parts.join("") + "\n";
    }

    return parts.join("");
  }

  return "";
}

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64");
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}/rest/api/3${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  async validateConnection(): Promise<{ accountId: string; displayName: string }> {
    return this.request("/myself");
  }

  async listProjects(): Promise<JiraProjectResponse[]> {
    const results: JiraProjectResponse[] = [];
    let startAt = 0;
    const maxResults = 50;

    while (true) {
      const data = await this.request<{
        values: JiraProjectResponse[];
        total: number;
        isLast: boolean;
      }>("/project/search", {
        startAt: String(startAt),
        maxResults: String(maxResults),
      });

      results.push(...data.values);

      if (data.isLast || results.length >= data.total) break;
      startAt += maxResults;
    }

    return results;
  }

  /**
   * Search issues using the new /search/jql endpoint (not the deprecated /search).
   * See: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/
   */
  async searchIssues(
    jql: string,
    startAt = 0,
    maxResults = 50
  ): Promise<JiraSearchResponse> {
    const url = new URL(`${this.baseUrl}/rest/api/3/search/jql`);
    url.searchParams.set("jql", jql);
    url.searchParams.set("startAt", String(startAt));
    url.searchParams.set("maxResults", String(maxResults));
    url.searchParams.set(
      "fields",
      "summary,description,issuetype,status,priority,assignee,reporter,labels,comment"
    );

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  /**
   * Fetch all issues for a project, paginating through results.
   */
  async listProjectIssues(projectKey: string): Promise<JiraIssueResponse[]> {
    const results: JiraIssueResponse[] = [];
    let startAt = 0;
    const maxResults = 50;

    while (true) {
      const data = await this.searchIssues(
        `project = "${projectKey}" ORDER BY updated DESC`,
        startAt,
        maxResults
      );

      results.push(...data.issues);

      if (results.length >= data.total) break;
      startAt += maxResults;
    }

    return results;
  }

  /** Build the browser URL for an issue. */
  issueUrl(issueKey: string): string {
    return `${this.baseUrl}/browse/${issueKey}`;
  }

  /** Build the browser URL for a project. */
  projectUrl(projectKey: string): string {
    return `${this.baseUrl}/jira/software/projects/${projectKey}/board`;
  }
}
