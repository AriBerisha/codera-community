import { prisma } from "@/lib/prisma";
import type { ConfluencePage } from "@/generated/prisma/client";

const MAX_PAGES = 10;
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

export async function buildConfluenceContext(userMessage: string): Promise<string> {
  const includedSpaces = await prisma.confluenceSpace.findMany({
    where: { included: true, indexStatus: "INDEXED" },
    select: { id: true, key: true, name: true },
  });

  if (includedSpaces.length === 0) return "";

  const searchTerms = extractSearchTerms(userMessage);
  if (searchTerms.length === 0) return "";

  const spaceIds = includedSpaces.map((s) => s.id);
  const spaceMap = new Map(includedSpaces.map((s) => [s.id, s]));

  // Search by title and content
  const results = await Promise.all(
    searchTerms.slice(0, 3).map((term) =>
      prisma.confluencePage.findMany({
        where: {
          spaceId: { in: spaceIds },
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { content: { contains: term, mode: "insensitive" } },
          ],
        },
        take: 5,
      })
    )
  )
    .then((r) => r.flat())
    .catch(() => [] as ConfluencePage[]);

  // Deduplicate
  const seenIds = new Set<string>();
  const pages: typeof results = [];

  for (const page of results) {
    if (!seenIds.has(page.id)) {
      seenIds.add(page.id);
      pages.push(page);
    }
    if (pages.length >= MAX_PAGES) break;
  }

  if (pages.length === 0) return "";

  let context = "\n\nHere are relevant Confluence pages from the connected spaces:\n\n";

  for (const page of pages) {
    const space = spaceMap.get(page.spaceId);
    let content = page.content;
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.substring(0, MAX_CONTENT_LENGTH) + "...";
    }

    context += `--- CONFLUENCE: ${space?.key ?? "?"} / ${page.title} ---\n`;
    context += `URL: ${page.webUrl}\n`;
    context += `${content}\n\n`;
  }

  return context;
}
