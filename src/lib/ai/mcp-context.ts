import { prisma } from "@/lib/prisma";
import {
  connectMcpServer,
  listMcpTools,
  listMcpResources,
  readMcpResource,
  disconnectMcpClient,
} from "@/lib/mcp/client";

const MAX_RESOURCES = 10;
const MAX_CONTENT_LENGTH = 2000;

/**
 * Build context from all enabled MCP servers.
 *
 * For each server we:
 * 1. Connect and discover capabilities
 * 2. List available resources and read them (up to MAX_RESOURCES)
 * 3. List available tools (reported as available, not called automatically)
 */
export async function buildMcpContext(userMessage: string): Promise<string> {
  const servers = await prisma.mcpServer.findMany({
    where: { enabled: true },
  });

  if (servers.length === 0) return "";

  const parts: string[] = [];

  for (const server of servers) {
    try {
      const client = await connectMcpServer({
        url: server.url,
        apiKey: server.apiKey,
        headers: server.headers as Record<string, string> | null,
      });

      try {
        const [tools, resources] = await Promise.all([
          listMcpTools(client),
          listMcpResources(client),
        ]);

        let serverContext = `\n--- MCP Server: ${server.name} ---\n`;

        // List available tools
        if (tools.length > 0) {
          serverContext += `Available tools: ${tools.map((t) => t.name + (t.description ? ` (${t.description})` : "")).join(", ")}\n`;
        }

        // Read resources (up to limit)
        if (resources.length > 0) {
          const toRead = resources.slice(0, MAX_RESOURCES);
          for (const resource of toRead) {
            try {
              let content = await readMcpResource(client, resource.uri);
              if (content.length > MAX_CONTENT_LENGTH) {
                content = content.substring(0, MAX_CONTENT_LENGTH) + "...";
              }
              serverContext += `\nResource: ${resource.name} (${resource.uri})\n`;
              serverContext += content + "\n";
            } catch {
              // Skip unreadable resources
            }
          }
        }

        parts.push(serverContext);
      } finally {
        await disconnectMcpClient(client);
      }
    } catch (err) {
      console.error(`Failed to connect to MCP server "${server.name}":`, err);
    }
  }

  if (parts.length === 0) return "";

  return "\n\nHere is context from connected MCP servers:\n" + parts.join("\n");
}
