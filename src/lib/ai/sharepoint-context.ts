import { prisma } from "@/lib/prisma";
import type { SharePointFile } from "@/generated/prisma/client";

const MAX_FILES = 10;
const MAX_CONTENT_LENGTH = 800;

function extractSearchTerms(message: string): string[] {
  const terms: string[] = [];

  const quoted = message.match(/"([^"]+)"/g);
  if (quoted) {
    terms.push(...quoted.map((q) => q.replace(/"/g, "")));
  }

  const words = message.match(/\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b/g);
  if (words) {
    terms.push(
      ...words.filter(
        (t) =>
          ![
            "the", "and", "for", "that", "this", "with", "from", "are", "was",
            "have", "has", "how", "what", "where", "when", "why", "can", "could",
            "would", "should", "does", "not", "but", "about", "into", "any",
            "all", "each", "which", "their", "there", "been", "more", "some",
            "than", "them", "these", "then", "other", "also",
          ].includes(t.toLowerCase())
      )
    );
  }

  return [...new Set(terms)];
}

export async function buildSharePointContext(userMessage: string): Promise<string> {
  const includedSites = await prisma.sharePointSite.findMany({
    where: { included: true, indexStatus: "INDEXED" },
    select: { id: true, name: true, displayName: true },
  });

  if (includedSites.length === 0) return "";

  const searchTerms = extractSearchTerms(userMessage);
  if (searchTerms.length === 0) return "";

  const siteIds = includedSites.map((s) => s.id);
  const siteMap = new Map(includedSites.map((s) => [s.id, s]));

  // Search by file name and content
  const results = await Promise.all(
    searchTerms.slice(0, 3).map((term) =>
      prisma.sharePointFile.findMany({
        where: {
          siteId: { in: siteIds },
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { content: { contains: term, mode: "insensitive" } },
          ],
        },
        take: 5,
      })
    )
  )
    .then((r) => r.flat())
    .catch(() => [] as SharePointFile[]);

  // Deduplicate
  const seenIds = new Set<string>();
  const files: typeof results = [];

  for (const file of results) {
    if (!seenIds.has(file.id)) {
      seenIds.add(file.id);
      files.push(file);
    }
    if (files.length >= MAX_FILES) break;
  }

  if (files.length === 0) return "";

  let context = "\n\nHere are relevant SharePoint documents from the connected sites:\n\n";

  for (const file of files) {
    const site = siteMap.get(file.siteId);
    let content = file.content;
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.substring(0, MAX_CONTENT_LENGTH) + "...";
    }

    context += `--- SHAREPOINT: ${site?.displayName ?? "?"} / ${file.path}/${file.name} ---\n`;
    context += `URL: ${file.webUrl}\n`;
    context += `${content}\n\n`;
  }

  return context;
}
