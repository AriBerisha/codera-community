export interface GithubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
}

export interface GithubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

export class GithubClient {
  private baseUrl: string;
  private pat: string;

  constructor(baseUrl: string, pat: string) {
    // Normalize: https://github.com -> https://api.github.com
    // GHE: https://ghe.example.com -> https://ghe.example.com/api/v3
    const url = baseUrl.replace(/\/$/, "");
    if (url === "https://github.com" || url === "https://www.github.com") {
      this.baseUrl = "https://api.github.com";
    } else {
      this.baseUrl = `${url}/api/v3`;
    }
    this.pat = pat;
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  private async requestAllPaginated<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const results: T[] = [];
    let page = 1;

    while (true) {
      const url = new URL(`${this.baseUrl}${path}`);
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      }

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.pat}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub API error ${res.status}: ${text}`);
      }

      const data: T[] = await res.json();
      results.push(...data);

      // Check for next page via Link header
      const linkHeader = res.headers.get("link") || "";
      if (!linkHeader.includes('rel="next"')) break;
      page++;
    }

    return results;
  }

  async validateConnection(): Promise<{ login: string; name: string }> {
    return this.request("/user");
  }

  async getOrg(orgName: string): Promise<{ id: number; login: string; name: string | null }> {
    return this.request(`/orgs/${encodeURIComponent(orgName)}`);
  }

  async listOrgRepos(orgName: string): Promise<GithubRepoResponse[]> {
    return this.requestAllPaginated(`/orgs/${encodeURIComponent(orgName)}/repos`, {
      type: "all",
      sort: "full_name",
    });
  }

  async listUserRepos(): Promise<GithubRepoResponse[]> {
    return this.requestAllPaginated("/user/repos", {
      sort: "full_name",
      affiliation: "owner,collaborator,organization_member",
    });
  }

  async getRepositoryTree(owner: string, repo: string, ref: string): Promise<GithubTreeItem[]> {
    const data = await this.request<{ tree: GithubTreeItem[]; truncated: boolean }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}`,
      { recursive: "1" }
    );
    return data.tree.filter((item) => item.type === "blob");
  }

  async getFileContent(owner: string, repo: string, filePath: string, ref: string): Promise<string> {
    const url = new URL(
      `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePath}`
    );
    url.searchParams.set("ref", ref);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.pat}`,
        Accept: "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${filePath}: ${res.status}`);
    }

    return res.text();
  }

  async createBranch(owner: string, repo: string, branchName: string, fromRef: string): Promise<void> {
    // Get the SHA of the source branch
    const refData = await this.request<{ object: { sha: string } }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(fromRef)}`
    );

    await this.postRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,
      { ref: `refs/heads/${branchName}`, sha: refData.object.sha }
    );
  }

  async createCommit(
    owner: string,
    repo: string,
    branch: string,
    message: string,
    files: Array<{ path: string; content: string }>
  ): Promise<{ sha: string; html_url: string }> {
    // Get the latest commit SHA on the branch
    const branchData = await this.request<{ commit: { sha: string } }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`
    );
    const baseTreeSha = branchData.commit.sha;

    // Create blobs for each file
    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
    for (const file of files) {
      const blob = await this.postRequest<{ sha: string }>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`,
        { content: file.content, encoding: "utf-8" }
      );
      treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    // Create tree
    const tree = await this.postRequest<{ sha: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,
      { base_tree: baseTreeSha, tree: treeItems }
    );

    // Create commit
    const commit = await this.postRequest<{ sha: string; html_url: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,
      { message, tree: tree.sha, parents: [baseTreeSha] }
    );

    // Update branch ref
    await this.patchRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`,
      { sha: commit.sha }
    );

    return commit;
  }

  async listProtectedBranches(owner: string, repo: string): Promise<Array<{ name: string }>> {
    try {
      return await this.requestAllPaginated<{ name: string }>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
        { protected: "true" }
      );
    } catch {
      return [];
    }
  }

  async searchBranches(owner: string, repo: string, search: string): Promise<Array<{ name: string }>> {
    // GitHub doesn't have a branch search API, so we list and filter client-side
    const branches = await this.requestAllPaginated<{ name: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`
    );
    const lower = search.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(lower)).slice(0, 30);
  }

  private async postRequest<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  private async patchRequest<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${text}`);
    }
    return res.json();
  }
}
