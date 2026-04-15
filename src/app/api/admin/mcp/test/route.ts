import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-utils";
import {
  connectMcpServer,
  listMcpTools,
  listMcpResources,
  disconnectMcpClient,
} from "@/lib/mcp/client";

/** POST — test connection to an MCP server and return its capabilities. */
export async function POST(req: Request) {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { url, apiKey } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const client = await connectMcpServer({ url, apiKey, raw: true });

    const serverInfo = client.getServerVersion();
    const capabilities = client.getServerCapabilities();

    const [tools, resources] = await Promise.all([
      listMcpTools(client),
      listMcpResources(client),
    ]);

    await disconnectMcpClient(client);

    return NextResponse.json({
      success: true,
      server: {
        name: serverInfo?.name ?? "Unknown",
        version: serverInfo?.version ?? "Unknown",
      },
      capabilities: {
        tools: !!capabilities?.tools,
        resources: !!capabilities?.resources,
        prompts: !!capabilities?.prompts,
      },
      tools: tools.map((t) => ({ name: t.name, description: t.description })),
      resources: resources.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
      })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to connect to MCP server";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
