import { prisma } from "@/lib/prisma";

interface CodeSnippet {
  projectPath: string;
  filePath: string;
  language: string | null;
  startLine: number;
  endLine: number;
  content: string;
}

const MAX_FILES = 15;
const MAX_LINES_PER_FILE = 200;
const MAX_TOTAL_LINES = 3000;
const CONTEXT_LINES = 10;

function extractSearchTerms(message: string): string[] {
  const terms: string[] = [];

  // Quoted strings
  const quoted = message.match(/"([^"]+)"/g);
  if (quoted) {
    terms.push(...quoted.map((q) => q.replace(/"/g, "")));
  }

  // CamelCase or snake_case identifiers (3+ chars)
  const identifiers = message.match(/\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b/g);
  if (identifiers) {
    terms.push(
      ...identifiers.filter(
        (t) =>
          !["the", "and", "for", "that", "this", "with", "from", "are", "was", "have", "has",
            "how", "what", "where", "when", "why", "can", "could", "would", "should", "does",
            "not", "but", "about", "into", "any", "all", "each", "which", "their", "there",
            "been", "more", "some", "than", "them", "these", "then", "other", "also",
          ].includes(t.toLowerCase())
      )
    );
  }

  // File paths (contain / or .)
  const paths = message.match(/[\w\-/.]+\.\w+/g);
  if (paths) {
    terms.push(...paths);
  }

  // Deduplicate
  return [...new Set(terms)];
}

function extractRelevantLines(
  content: string,
  searchTerms: string[],
  maxLines: number
): { startLine: number; endLine: number; text: string } | null {
  const lines = content.split("\n");
  const matchingLineNumbers: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (searchTerms.some((term) => lower.includes(term.toLowerCase()))) {
      matchingLineNumbers.push(i);
    }
  }

  if (matchingLineNumbers.length === 0) {
    // Return the first maxLines if no specific matches
    const end = Math.min(lines.length, maxLines);
    return {
      startLine: 1,
      endLine: end,
      text: lines.slice(0, end).join("\n"),
    };
  }

  // Build ranges around matching lines
  const ranges: [number, number][] = [];
  for (const lineNum of matchingLineNumbers) {
    const start = Math.max(0, lineNum - CONTEXT_LINES);
    const end = Math.min(lines.length - 1, lineNum + CONTEXT_LINES);
    ranges.push([start, end]);
  }

  // Merge overlapping ranges
  const merged: [number, number][] = [];
  let current = ranges[0];
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i][0] <= current[1] + 1) {
      current = [current[0], Math.max(current[1], ranges[i][1])];
    } else {
      merged.push(current);
      current = ranges[i];
    }
  }
  merged.push(current);

  // Build output respecting maxLines
  const snippetLines: string[] = [];
  let totalLines = 0;
  let firstLine = merged[0][0] + 1;
  let lastLine = firstLine;

  for (const [start, end] of merged) {
    const rangeLines = end - start + 1;
    if (totalLines + rangeLines > maxLines) break;

    if (snippetLines.length > 0) {
      snippetLines.push("// ...");
      totalLines++;
    }

    for (let i = start; i <= end && totalLines < maxLines; i++) {
      snippetLines.push(lines[i]);
      totalLines++;
      lastLine = i + 1;
    }
  }

  return {
    startLine: firstLine,
    endLine: lastLine,
    text: snippetLines.join("\n"),
  };
}

export async function buildCodeContext(
  userMessage: string,
  projectIds: string[]
): Promise<string> {
  if (projectIds.length === 0) return "";

  const searchTerms = extractSearchTerms(userMessage);
  if (searchTerms.length === 0) return "";

  // Get project names for display (search both GitLab and GitHub)
  const [gitlabProjects, githubProjects] = await Promise.all([
    prisma.gitlabProject.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, pathWithNamespace: true },
    }),
    prisma.githubProject.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, fullName: true },
    }),
  ]);
  const projectMap = new Map<string, string>([
    ...gitlabProjects.map((p) => [p.id, p.pathWithNamespace] as [string, string]),
    ...githubProjects.map((p) => [p.id, p.fullName] as [string, string]),
  ]);

  const likeTerms = searchTerms.slice(0, 3);

  // Run searches in parallel — search by both projectId (GitLab) and githubProjectId (GitHub)
  const [ftsResults, likeResults] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ id: string; filePath: string; projectId: string | null; githubProjectId: string | null; rank: number }>>(
      `SELECT id, "filePath", "projectId", "githubProjectId", ts_rank("search_vector", plainto_tsquery('english', $1)) as rank
       FROM "IndexedFile"
       WHERE ("projectId" = ANY($2::text[]) OR "githubProjectId" = ANY($2::text[]))
         AND "search_vector" @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $3`,
      searchTerms.join(" "),
      projectIds,
      MAX_FILES
    ).catch(() => []),

    Promise.all(
      likeTerms.map((term) =>
        prisma.indexedFile.findMany({
          where: {
            OR: [
              { projectId: { in: projectIds } },
              { githubProjectId: { in: projectIds } },
            ],
            content: { contains: term, mode: "insensitive" },
          },
          select: { id: true, filePath: true, projectId: true, githubProjectId: true },
          take: 5,
        })
      )
    )
      .then((results) => results.flat())
      .catch(() => []),
  ]);

  // Deduplicate by file ID
  const seenIds = new Set<string>();
  const fileIds: string[] = [];

  for (const result of [...ftsResults, ...likeResults]) {
    if (!seenIds.has(result.id)) {
      seenIds.add(result.id);
      fileIds.push(result.id);
    }
    if (fileIds.length >= MAX_FILES) break;
  }

  if (fileIds.length === 0) return "";

  // Fetch full file contents
  const files = await prisma.indexedFile.findMany({
    where: { id: { in: fileIds } },
    select: {
      id: true,
      projectId: true,
      githubProjectId: true,
      filePath: true,
      language: true,
      content: true,
    },
  });

  // Build context snippets
  const snippets: CodeSnippet[] = [];
  let totalLines = 0;

  for (const file of files) {
    if (totalLines >= MAX_TOTAL_LINES) break;

    const remainingLines = MAX_TOTAL_LINES - totalLines;
    const maxLinesForFile = Math.min(MAX_LINES_PER_FILE, remainingLines);

    const extracted = extractRelevantLines(file.content, searchTerms, maxLinesForFile);
    if (!extracted) continue;

    const lineCount = extracted.text.split("\n").length;
    totalLines += lineCount;

    snippets.push({
      projectPath: projectMap.get(file.projectId || file.githubProjectId || "") || "unknown",
      filePath: file.filePath,
      language: file.language,
      startLine: extracted.startLine,
      endLine: extracted.endLine,
      content: extracted.text,
    });
  }

  if (snippets.length === 0) return "";

  // Format context string
  const projectNames = [...new Set(snippets.map((s) => s.projectPath))];
  let context = `The user has selected the following repositories for context:\n`;
  context += projectNames.map((p) => `- ${p}`).join("\n");
  context += "\n\nHere are relevant code snippets from the indexed repositories:\n\n";

  for (const snippet of snippets) {
    const lang = snippet.language || "";
    context += `--- FILE: ${snippet.projectPath} :: ${snippet.filePath} (lines ${snippet.startLine}-${snippet.endLine}) ---\n`;
    context += `\`\`\`${lang}\n`;
    context += snippet.content;
    context += `\n\`\`\`\n\n`;
  }

  return context;
}
