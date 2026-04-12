export interface GitlabProjectResponse {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  default_branch: string;
}

export interface GitlabTreeItem {
  id: string;
  name: string;
  type: "blob" | "tree";
  path: string;
  mode: string;
}

export class GitlabClient {
  private baseUrl: string;
  private pat: string;

  constructor(baseUrl: string, pat: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.pat = pat;
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/v4${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: { "PRIVATE-TOKEN": this.pat },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitLab API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  private async requestAll<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    const perPage = "100";

    while (true) {
      const url = new URL(`${this.baseUrl}/api/v4${path}`);
      url.searchParams.set("per_page", perPage);
      url.searchParams.set("page", String(page));
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      }

      const res = await fetch(url.toString(), {
        headers: { "PRIVATE-TOKEN": this.pat },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitLab API error ${res.status}: ${text}`);
      }

      const data: T[] = await res.json();
      results.push(...data);

      const totalPages = parseInt(res.headers.get("x-total-pages") || "1", 10);
      if (page >= totalPages) break;
      page++;
    }

    return results;
  }

  async validateConnection(): Promise<{ name: string }> {
    return this.request("/user");
  }

  async getGroup(groupId: string): Promise<{ id: number; name: string; full_path: string }> {
    return this.request(`/groups/${encodeURIComponent(groupId)}`);
  }

  async listGroupProjects(groupId: string): Promise<GitlabProjectResponse[]> {
    return this.requestAll(`/groups/${encodeURIComponent(groupId)}/projects`, {
      include_subgroups: "true",
      archived: "false",
    });
  }

  async getRepositoryTree(projectId: number, ref: string): Promise<GitlabTreeItem[]> {
    return this.requestAll(`/projects/${projectId}/repository/tree`, {
      recursive: "true",
      ref,
    });
  }

  private async postRequest<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}/api/v4${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": this.pat,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitLab API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async createBranch(projectId: number, branchName: string, ref: string): Promise<{ name: string }> {
    return this.postRequest(`/projects/${projectId}/repository/branches`, {
      branch: branchName,
      ref,
    });
  }

  async createCommit(projectId: number, payload: {
    branch: string;
    commit_message: string;
    actions: Array<{
      action: "create" | "update" | "delete";
      file_path: string;
      content: string;
    }>;
    start_branch?: string;
  }): Promise<{ id: string; short_id: string; web_url: string }> {
    return this.postRequest(`/projects/${projectId}/repository/commits`, payload);
  }

  async listProtectedBranches(projectId: number): Promise<Array<{ name: string }>> {
    return this.requestAll(`/projects/${projectId}/protected_branches`);
  }

  async searchBranches(projectId: number, search: string): Promise<Array<{ name: string }>> {
    return this.request(`/projects/${projectId}/repository/branches`, {
      search,
      per_page: "30",
    }) as Promise<Array<{ name: string }>>;
  }

  async getFileContent(projectId: number, filePath: string, ref: string): Promise<string> {
    const encodedPath = encodeURIComponent(filePath);
    const url = new URL(
      `${this.baseUrl}/api/v4/projects/${projectId}/repository/files/${encodedPath}/raw`
    );
    url.searchParams.set("ref", ref);

    const res = await fetch(url.toString(), {
      headers: { "PRIVATE-TOKEN": this.pat },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${filePath}: ${res.status}`);
    }

    return res.text();
  }
}
