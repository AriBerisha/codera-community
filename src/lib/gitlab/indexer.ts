import { prisma } from "@/lib/prisma";
import { GitlabClient } from "./client";
import { shouldIndexFile, getLanguageFromPath, MAX_FILE_SIZE } from "./file-filter";

const CONCURRENCY = 5;
const DELAY_MS = 50;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processInBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
  delayMs: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }

    if (i + concurrency < items.length) {
      await delay(delayMs);
    }
  }

  return results;
}

export async function indexProject(
  projectId: string,
  client: GitlabClient
): Promise<{ indexed: number; skipped: number; errors: number }> {
  const project = await prisma.gitlabProject.findUnique({
    where: { id: projectId },
  });

  if (!project) throw new Error(`Project not found: ${projectId}`);

  try {
    // Get the full tree
    const tree = await client.getRepositoryTree(
      project.gitlabId,
      project.defaultBranch
    );

    // Filter to indexable files
    const filesToIndex = tree.filter(
      (item) => item.type === "blob" && shouldIndexFile(item.path)
    );

    // Get existing files for SHA comparison
    const existingFiles = await prisma.indexedFile.findMany({
      where: { projectId },
      select: { filePath: true, sha: true },
    });
    const existingShaMap = new Map(
      existingFiles.map((f) => [f.filePath, f.sha])
    );

    let indexed = 0;
    let skipped = 0;
    let errors = 0;

    // Fetch and index each file
    await processInBatches(
      filesToIndex,
      async (item) => {
        // Skip if SHA hasn't changed
        if (existingShaMap.get(item.path) === item.id) {
          skipped++;
          return;
        }

        try {
          const content = await client.getFileContent(
            project.gitlabId,
            item.path,
            project.defaultBranch
          );

          // Skip files that are too large
          const sizeBytes = Buffer.byteLength(content, "utf8");
          if (sizeBytes > MAX_FILE_SIZE) {
            skipped++;
            return;
          }

          const fileName = item.path.split("/").pop() || item.name;
          const language = getLanguageFromPath(item.path);

          await prisma.indexedFile.upsert({
            where: {
              projectId_filePath: {
                projectId,
                filePath: item.path,
              },
            },
            update: {
              content,
              fileName,
              language,
              sizeBytes,
              sha: item.id,
              indexedAt: new Date(),
            },
            create: {
              projectId,
              filePath: item.path,
              fileName,
              language,
              content,
              sizeBytes,
              sha: item.id,
            },
          });

          indexed++;
        } catch (err) {
          console.error(`Failed to index ${item.path}:`, err);
          errors++;
        }
      },
      CONCURRENCY,
      DELAY_MS
    );

    // Remove files that no longer exist in the tree
    const currentPaths = new Set(filesToIndex.map((f) => f.path));
    const stalePaths = existingFiles
      .filter((f) => !currentPaths.has(f.filePath))
      .map((f) => f.filePath);

    if (stalePaths.length > 0) {
      await prisma.indexedFile.deleteMany({
        where: {
          projectId,
          filePath: { in: stalePaths },
        },
      });
    }

    // Mark as indexed
    await prisma.gitlabProject.update({
      where: { id: projectId },
      data: {
        indexStatus: "INDEXED",
        lastIndexedAt: new Date(),
      },
    });

    return { indexed, skipped, errors };
  } catch (err) {
    // Mark as failed
    await prisma.gitlabProject.update({
      where: { id: projectId },
      data: { indexStatus: "FAILED" },
    });
    throw err;
  }
}
