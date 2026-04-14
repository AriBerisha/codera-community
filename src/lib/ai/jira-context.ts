import { prisma } from "@/lib/prisma";
import type { JiraIssue } from "@/generated/prisma/client";

interface JiraSnippet {
  projectKey: string;
  issueKey: string;
  summary: string;
  issueType: string;
  status: string;
  priority: string | null;
  assignee: string | null;
  webUrl: string;
  content: string;
}

const MAX_ISSUES = 10;
const MAX_CONTENT_LENGTH = 500;

function extractSearchTerms(message: string): string[] {
  const terms: string[] = [];

  // Jira issue keys (e.g. PROJ-123)
  const issueKeys = message.match(/\b[A-Z][A-Z0-9]+-\d+\b/g);
  if (issueKeys) {
    terms.push(...issueKeys);
  }

  // Quoted strings
  const quoted = message.match(/"([^"]+)"/g);
  if (quoted) {
    terms.push(...quoted.map((q) => q.replace(/"/g, "")));
  }

  // Meaningful words (3+ chars)
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

export async function buildJiraContext(userMessage: string): Promise<string> {
  // Only search if there are included Jira projects with indexed issues
  const includedProjects = await prisma.jiraProject.findMany({
    where: { included: true, indexStatus: "INDEXED" },
    select: { id: true, key: true, name: true },
  });

  if (includedProjects.length === 0) return "";

  const searchTerms = extractSearchTerms(userMessage);
  if (searchTerms.length === 0) return "";

  const projectIds = includedProjects.map((p) => p.id);
  const projectMap = new Map(includedProjects.map((p) => [p.id, p]));

  // Check for direct issue key references first
  const issueKeys = userMessage.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || [];

  const [directMatches, contentMatches] = await Promise.all([
    // Direct key matches
    issueKeys.length > 0
      ? prisma.jiraIssue.findMany({
          where: {
            projectId: { in: projectIds },
            key: { in: issueKeys },
          },
          take: MAX_ISSUES,
        })
      : Promise.resolve([] as JiraIssue[]),

    // Content search using ILIKE for each term
    Promise.all(
      searchTerms.slice(0, 3).map((term) =>
        prisma.jiraIssue.findMany({
          where: {
            projectId: { in: projectIds },
            content: { contains: term, mode: "insensitive" },
          },
          take: 5,
        })
      )
    ).then((results) => results.flat()),
  ]);

  // Deduplicate by issue ID, prioritizing direct matches
  const seenIds = new Set<string>();
  const issues: typeof directMatches = [];

  for (const issue of [...directMatches, ...contentMatches]) {
    if (!seenIds.has(issue.id)) {
      seenIds.add(issue.id);
      issues.push(issue);
    }
    if (issues.length >= MAX_ISSUES) break;
  }

  if (issues.length === 0) return "";

  // Build context
  const snippets: JiraSnippet[] = issues.map((issue) => {
    const project = projectMap.get(issue.projectId);
    let content = issue.content;
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.substring(0, MAX_CONTENT_LENGTH) + "...";
    }
    return {
      projectKey: project?.key ?? "???",
      issueKey: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      priority: issue.priority,
      assignee: issue.assignee,
      webUrl: issue.webUrl,
      content,
    };
  });

  let context = "\n\nHere are relevant Jira issues from the connected projects:\n\n";

  for (const snippet of snippets) {
    context += `--- JIRA: ${snippet.issueKey} - ${snippet.summary} ---\n`;
    context += `Type: ${snippet.issueType} | Status: ${snippet.status}`;
    if (snippet.priority) context += ` | Priority: ${snippet.priority}`;
    if (snippet.assignee) context += ` | Assignee: ${snippet.assignee}`;
    context += `\nURL: ${snippet.webUrl}\n`;
    context += `${snippet.content}\n\n`;
  }

  return context;
}
