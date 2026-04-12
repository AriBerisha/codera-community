import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { query, projectIds } = await req.json();

  if (!query || !projectIds?.length) {
    return NextResponse.json(
      { error: "Query and projectIds are required" },
      { status: 400 }
    );
  }

  try {
    // Full-text search
    const results = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        filePath: string;
        fileName: string;
        projectId: string;
        language: string | null;
        rank: number;
      }>
    >(
      `SELECT id, "filePath", "fileName", "projectId", "language",
              ts_rank("search_vector", plainto_tsquery('english', $1)) as rank
       FROM "IndexedFile"
       WHERE "projectId" = ANY($2::text[])
         AND "search_vector" @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT 20`,
      query,
      projectIds
    );

    return NextResponse.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
