import { prisma } from "@/lib/prisma";
import { ConfluenceClient, ConfluencePageResponse, storageToPlainText } from "./client";

const CONCURRENCY = 5;

export async function indexConfluenceSpace(
  spaceId: string,
  client: ConfluenceClient
): Promise<{ indexed: number; skipped: number; errors: number }> {
  const space = await prisma.confluenceSpace.findUnique({
    where: { id: spaceId },
  });

  if (!space) throw new Error(`Confluence space not found: ${spaceId}`);

  try {
    const pages = await client.listSpacePages(space.confluenceId);

    let indexed = 0;
    let skipped = 0;
    let errors = 0;

    // Process pages in batches
    for (let i = 0; i < pages.length; i += CONCURRENCY) {
      const batch = pages.slice(i, i + CONCURRENCY);

      await Promise.allSettled(
        batch.map(async (page: ConfluencePageResponse) => {
          try {
            const bodyHtml = page.body?.storage?.value ?? "";
            const plainText = storageToPlainText(bodyHtml);

            if (!plainText) {
              skipped++;
              return;
            }

            const content = `${page.title}\n\n${plainText}`;

            await prisma.confluencePage.upsert({
              where: { confluenceId: page.id },
              update: {
                title: page.title,
                webUrl: client.pageUrl(page._links.webui),
                content,
                updatedAt: new Date(),
              },
              create: {
                spaceId,
                confluenceId: page.id,
                title: page.title,
                webUrl: client.pageUrl(page._links.webui),
                content,
              },
            });

            indexed++;
          } catch (err) {
            console.error(`Failed to index page ${page.title}:`, err);
            errors++;
          }
        })
      );
    }

    // Remove pages that no longer exist
    const currentIds = new Set(pages.map((p) => p.id));
    const existingPages = await prisma.confluencePage.findMany({
      where: { spaceId },
      select: { confluenceId: true },
    });

    const staleIds = existingPages
      .filter((e) => !currentIds.has(e.confluenceId))
      .map((e) => e.confluenceId);

    if (staleIds.length > 0) {
      await prisma.confluencePage.deleteMany({
        where: { spaceId, confluenceId: { in: staleIds } },
      });
    }

    await prisma.confluenceSpace.update({
      where: { id: spaceId },
      data: { indexStatus: "INDEXED", lastIndexedAt: new Date() },
    });

    return { indexed, skipped, errors };
  } catch (err) {
    await prisma.confluenceSpace.update({
      where: { id: spaceId },
      data: { indexStatus: "FAILED" },
    });
    throw err;
  }
}
