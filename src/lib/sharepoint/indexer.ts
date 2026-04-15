import { prisma } from "@/lib/prisma";
import { SharePointClient, GraphDriveItem, isIndexableFile, isDocx } from "./client";
import mammoth from "mammoth";

const CONCURRENCY = 5;

/** Extract plain text from a .docx buffer using mammoth. */
async function extractDocxText(buf: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value;
}

/** Extract plain text from a text-based file buffer. */
function extractPlainText(buf: Buffer): string {
  return buf.toString("utf-8");
}

export async function indexSharePointSite(
  siteDbId: string,
  client: SharePointClient
): Promise<{ indexed: number; skipped: number; errors: number }> {
  const site = await prisma.sharePointSite.findUnique({
    where: { id: siteDbId },
  });

  if (!site) throw new Error(`SharePoint site not found: ${siteDbId}`);

  try {
    const files = await client.listSiteFiles(site.siteId);

    let indexed = 0;
    let skipped = 0;
    let errors = 0;

    // Process files in batches
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY);

      await Promise.allSettled(
        batch.map(async (item: GraphDriveItem) => {
          try {
            if (!isIndexableFile(item.name, item.size)) {
              skipped++;
              return;
            }

            // Check if file changed (eTag comparison)
            const existing = await prisma.sharePointFile.findUnique({
              where: { driveItemId: item.id },
              select: { sha: true },
            });

            if (existing?.sha && existing.sha === item.eTag) {
              skipped++;
              return;
            }

            // Get drive item with download URL
            const driveItem = await client.getDriveItem(site.siteId, item.id);
            const downloadUrl = driveItem["@microsoft.graph.downloadUrl"];
            if (!downloadUrl) {
              skipped++;
              return;
            }

            const buf = await client.downloadFile(downloadUrl);

            let content: string;
            if (isDocx(item.name)) {
              content = await extractDocxText(buf);
            } else {
              content = extractPlainText(buf);
            }

            if (!content.trim()) {
              skipped++;
              return;
            }

            const folderPath =
              item.parentReference?.path?.replace(/.*\/root:?\/?/, "") || "/";

            await prisma.sharePointFile.upsert({
              where: { driveItemId: item.id },
              update: {
                name: item.name,
                path: folderPath,
                mimeType: item.file?.mimeType || null,
                webUrl: item.webUrl,
                sizeBytes: item.size,
                content,
                sha: item.eTag || null,
                indexedAt: new Date(),
              },
              create: {
                siteId: siteDbId,
                driveItemId: item.id,
                name: item.name,
                path: folderPath,
                mimeType: item.file?.mimeType || null,
                webUrl: item.webUrl,
                sizeBytes: item.size,
                content,
                sha: item.eTag || null,
              },
            });

            indexed++;
          } catch (err) {
            console.error(`Failed to index file ${item.name}:`, err);
            errors++;
          }
        })
      );
    }

    // Remove files that no longer exist in SharePoint
    const currentIds = new Set(files.map((f) => f.id));
    const existingFiles = await prisma.sharePointFile.findMany({
      where: { siteId: siteDbId },
      select: { driveItemId: true },
    });

    const staleIds = existingFiles
      .filter((e) => !currentIds.has(e.driveItemId))
      .map((e) => e.driveItemId);

    if (staleIds.length > 0) {
      await prisma.sharePointFile.deleteMany({
        where: { siteId: siteDbId, driveItemId: { in: staleIds } },
      });
    }

    await prisma.sharePointSite.update({
      where: { id: siteDbId },
      data: { indexStatus: "INDEXED", lastIndexedAt: new Date() },
    });

    return { indexed, skipped, errors };
  } catch (err) {
    await prisma.sharePointSite.update({
      where: { id: siteDbId },
      data: { indexStatus: "FAILED" },
    });
    throw err;
  }
}
