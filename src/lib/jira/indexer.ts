import { prisma } from "@/lib/prisma";
import { JiraClient, JiraIssueResponse, adfToPlainText } from "./client";

const CONCURRENCY = 5;
const ISSUES_PER_PAGE = 50;

/**
 * Build a single searchable text blob from an issue's fields.
 * Includes: key, summary, description, comments, labels, type, status.
 */
function buildSearchableContent(issue: JiraIssueResponse): string {
  const parts: string[] = [];

  parts.push(`[${issue.key}] ${issue.fields.summary}`);

  if (issue.fields.description) {
    const desc = adfToPlainText(issue.fields.description).trim();
    if (desc) parts.push(desc);
  }

  if (issue.fields.labels.length > 0) {
    parts.push(`Labels: ${issue.fields.labels.join(", ")}`);
  }

  parts.push(`Type: ${issue.fields.issuetype.name}`);
  parts.push(`Status: ${issue.fields.status.name}`);

  if (issue.fields.priority?.name) {
    parts.push(`Priority: ${issue.fields.priority.name}`);
  }

  if (issue.fields.assignee?.displayName) {
    parts.push(`Assignee: ${issue.fields.assignee.displayName}`);
  }

  // Comments
  const comments = issue.fields.comment?.comments ?? [];
  for (const comment of comments) {
    const text = adfToPlainText(comment.body).trim();
    if (text) {
      const author = comment.author?.displayName ?? "Unknown";
      parts.push(`Comment by ${author}: ${text}`);
    }
  }

  return parts.join("\n");
}

export async function indexJiraProject(
  projectId: string,
  client: JiraClient
): Promise<{ indexed: number; skipped: number; errors: number }> {
  const project = await prisma.jiraProject.findUnique({
    where: { id: projectId },
  });

  if (!project) throw new Error(`Jira project not found: ${projectId}`);

  try {
    // Fetch all issues for the project
    const issues: JiraIssueResponse[] = [];
    let startAt = 0;

    while (true) {
      const data = await client.searchIssues(
        `project = "${project.key}" ORDER BY updated DESC`,
        startAt,
        ISSUES_PER_PAGE
      );

      issues.push(...data.issues);
      if (issues.length >= data.total) break;
      startAt += ISSUES_PER_PAGE;
    }

    let indexed = 0;
    let skipped = 0;
    let errors = 0;

    // Process issues in batches
    for (let i = 0; i < issues.length; i += CONCURRENCY) {
      const batch = issues.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async (issue) => {
          try {
            const description = issue.fields.description
              ? adfToPlainText(issue.fields.description).trim()
              : null;
            const content = buildSearchableContent(issue);

            await prisma.jiraIssue.upsert({
              where: { jiraId: issue.id },
              update: {
                key: issue.key,
                summary: issue.fields.summary,
                description,
                issueType: issue.fields.issuetype.name,
                status: issue.fields.status.name,
                priority: issue.fields.priority?.name ?? null,
                assignee: issue.fields.assignee?.displayName ?? null,
                reporter: issue.fields.reporter?.displayName ?? null,
                labels: issue.fields.labels,
                webUrl: client.issueUrl(issue.key),
                content,
                updatedAt: new Date(),
              },
              create: {
                projectId,
                jiraId: issue.id,
                key: issue.key,
                summary: issue.fields.summary,
                description,
                issueType: issue.fields.issuetype.name,
                status: issue.fields.status.name,
                priority: issue.fields.priority?.name ?? null,
                assignee: issue.fields.assignee?.displayName ?? null,
                reporter: issue.fields.reporter?.displayName ?? null,
                labels: issue.fields.labels,
                webUrl: client.issueUrl(issue.key),
                content,
              },
            });

            indexed++;
          } catch (err) {
            console.error(`Failed to index issue ${issue.key}:`, err);
            errors++;
          }
        })
      );

      for (const result of results) {
        if (result.status === "rejected") {
          errors++;
        }
      }
    }

    // Remove issues that no longer exist in Jira
    const currentJiraIds = new Set(issues.map((i) => i.id));
    const existingIssues = await prisma.jiraIssue.findMany({
      where: { projectId },
      select: { jiraId: true },
    });

    const staleIds = existingIssues
      .filter((e) => !currentJiraIds.has(e.jiraId))
      .map((e) => e.jiraId);

    if (staleIds.length > 0) {
      await prisma.jiraIssue.deleteMany({
        where: {
          projectId,
          jiraId: { in: staleIds },
        },
      });
    }

    // Mark as indexed
    await prisma.jiraProject.update({
      where: { id: projectId },
      data: {
        indexStatus: "INDEXED",
        lastIndexedAt: new Date(),
      },
    });

    return { indexed, skipped, errors };
  } catch (err) {
    await prisma.jiraProject.update({
      where: { id: projectId },
      data: { indexStatus: "FAILED" },
    });
    throw err;
  }
}
