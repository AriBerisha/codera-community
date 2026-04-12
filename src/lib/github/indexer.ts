import { prisma } from "@/lib/prisma";
import { GithubClient } from "./client";
import { shouldIndexFile, getLanguageFromPath, MAX_FILE_SIZE } from "@/lib/gitlab/file-filter";

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

export async function indexGithubProject(
  projectId: string,
  client: GithubClient
): Promise<{ indexed: number; skipped: number; errors: number }> {
  const project = await prisma.githubProject.findUnique({
    where: { id: projectId },
  });

  if (!project) throw new Error(`GitHub project not found: ${projectId}`);

  const [owner, repo] = project.fullName.split("/");

  try {
    // Get the full tree
    const tree = await client.getRepositoryTree(owner, repo, project.defaultBranch);

    // Filter to indexable files
    const filesToIndex = tree.filter((item) => shouldIndexFile(item.path));

    // Get existing files for SHA comparison
    const existingFiles = await prisma.indexedFile.findMany({
      where: { githubProjectId: projectId },
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
        if (existingShaMap.get(item.path) === item.sha) {
          skipped++;
          return;
        }

        // Skip files that are too large (GitHub tree includes size)
        if (item.size && item.size > MAX_FILE_SIZE) {
          skipped++;
          return;
        }

        try {
          const content = await client.getFileContent(
            owner,
            repo,
            item.path,
            project.defaultBranch
          );

          const sizeBytes = Buffer.byteLength(content, "utf8");
          if (sizeBytes > MAX_FILE_SIZE) {
            skipped++;
            return;
          }

          const fileName = item.path.split("/").pop() || item.path;
          const language = getLanguageFromPath(item.path);

          await prisma.indexedFile.upsert({
            where: {
              githubProjectId_filePath: {
                githubProjectId: projectId,
                filePath: item.path,
              },
            },
            update: {
              content,
              fileName,
              language,
              sizeBytes,
              sha: item.sha,
              indexedAt: new Date(),
            },
            create: {
              githubProjectId: projectId,
              filePath: item.path,
              fileName,
              language,
              content,
              sizeBytes,
              sha: item.sha,
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

    // Remove stale files
    const currentPaths = new Set(filesToIndex.map((f) => f.path));
    const stalePaths = existingFiles
      .filter((f) => !currentPaths.has(f.filePath))
      .map((f) => f.filePath);

    if (stalePaths.length > 0) {
      await prisma.indexedFile.deleteMany({
        where: {
          githubProjectId: projectId,
          filePath: { in: stalePaths },
        },
      });
    }

    // Mark as indexed
    await prisma.githubProject.update({
      where: { id: projectId },
      data: {
        indexStatus: "INDEXED",
        lastIndexedAt: new Date(),
      },
    });

    return { indexed, skipped, errors };
  } catch (err) {
    await prisma.githubProject.update({
      where: { id: projectId },
      data: { indexStatus: "FAILED" },
    });
    throw err;
  }
}
