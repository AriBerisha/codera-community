import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { decrypt } from "@/lib/crypto";

interface McpServerConfig {
  url: string;
  apiKey?: string | null;
  headers?: Record<string, string> | null;
  /** When true, apiKey/headers are already plaintext (e.g. from test form). */
  raw?: boolean;
}

/** Create an MCP client connected to a remote server via Streamable HTTP, falling back to SSE. */
export async function connectMcpServer(config: McpServerConfig): Promise<Client> {
  const requestInit: RequestInit = { headers: {} };
  const hdrs = requestInit.headers as Record<string, string>;

  if (config.apiKey) {
    const key = config.raw ? config.apiKey : decrypt(config.apiKey);
    hdrs["Authorization"] = `Bearer ${key}`;
  }

  if (config.headers) {
    for (const [k, v] of Object.entries(config.headers)) {
      hdrs[k] = config.raw ? v : decrypt(v);
    }
  }

  const url = new URL(config.url);

  // Try Streamable HTTP first, fall back to SSE.
  // Each attempt needs a fresh Client since connect() is one-shot.
  try {
    const client = new Client({ name: "codera", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(url, { requestInit });
    await client.connect(transport);
    return client;
  } catch (streamableErr) {
    try {
      const client = new Client({ name: "codera", version: "1.0.0" });
      const transport = new SSEClientTransport(url, { requestInit });
      await client.connect(transport);
      return client;
    } catch (sseErr) {
      // Surface both errors so the root cause is visible
      const msg1 = streamableErr instanceof Error ? streamableErr.message : String(streamableErr);
      const msg2 = sseErr instanceof Error ? sseErr.message : String(sseErr);
      throw new Error(
        `Streamable HTTP failed: ${msg1}; SSE fallback failed: ${msg2}`
      );
    }
  }
}

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpResourceInfo {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** List all tools exposed by an MCP server. */
export async function listMcpTools(client: Client): Promise<McpToolInfo[]> {
  const caps = client.getServerCapabilities();
  if (!caps?.tools) return [];

  const result = await client.listTools();
  return result.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as Record<string, unknown>,
  }));
}

/** List all resources exposed by an MCP server. */
export async function listMcpResources(client: Client): Promise<McpResourceInfo[]> {
  const caps = client.getServerCapabilities();
  if (!caps?.resources) return [];

  const result = await client.listResources();
  return result.resources.map((r) => ({
    uri: r.uri,
    name: r.name,
    description: r.description,
    mimeType: r.mimeType,
  }));
}

/** Call a tool on an MCP server and return the text content. */
export async function callMcpTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  const result = await client.callTool({ name, arguments: args });

  if ("content" in result && Array.isArray(result.content)) {
    return result.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }

  return JSON.stringify(result);
}

/** Read a resource from an MCP server and return its text content. */
export async function readMcpResource(
  client: Client,
  uri: string
): Promise<string> {
  const result = await client.readResource({ uri });
  return result.contents
    .filter((c): c is { uri: string; text: string } => "text" in c)
    .map((c) => c.text)
    .join("\n");
}

/** Safely disconnect an MCP client. */
export async function disconnectMcpClient(client: Client): Promise<void> {
  try {
    await client.close();
  } catch {
    // Ignore disconnect errors
  }
}
