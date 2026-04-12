export interface ParsedFileEdit {
  project: string;
  filePath: string;
  original: string;
  modified: string;
}

export function parseFileEdits(text: string): ParsedFileEdit[] {
  const edits: ParsedFileEdit[] = [];

  // Strip markdown code fences that might wrap the XML (e.g. ```xml ... ```)
  const cleaned = text.replace(/```(?:xml|html)?\s*\n?([\s\S]*?)```/g, "$1");

  const regex = /<file_edit>\s*<project>([\s\S]*?)<\/project>\s*<path>([\s\S]*?)<\/path>\s*<original>([\s\S]*?)<\/original>\s*<modified>([\s\S]*?)<\/modified>\s*<\/file_edit>/g;

  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    edits.push({
      project: match[1].trim(),
      filePath: match[2].trim(),
      original: match[3].replace(/^\n|\n$/g, ""),
      modified: match[4].replace(/^\n|\n$/g, ""),
    });
  }

  // Fallback: also try parsing from the original text in case stripping removed valid content
  if (edits.length === 0 && text !== cleaned) {
    let fallbackMatch;
    while ((fallbackMatch = regex.exec(text)) !== null) {
      edits.push({
        project: fallbackMatch[1].trim(),
        filePath: fallbackMatch[2].trim(),
        original: fallbackMatch[3].replace(/^\n|\n$/g, ""),
        modified: fallbackMatch[4].replace(/^\n|\n$/g, ""),
      });
    }
  }

  return edits;
}

export function applyEdit(fullContent: string, searchBlock: string, replaceBlock: string): string {
  // Empty original means new file
  if (!searchBlock.trim()) {
    return replaceBlock;
  }

  // Try exact match first
  if (fullContent.includes(searchBlock)) {
    return fullContent.replace(searchBlock, replaceBlock);
  }

  // Try with normalized whitespace (trim each line)
  const normalizedSearch = searchBlock.split("\n").map(l => l.trimEnd()).join("\n");
  const normalizedContent = fullContent.split("\n").map(l => l.trimEnd()).join("\n");

  if (normalizedContent.includes(normalizedSearch)) {
    const idx = normalizedContent.indexOf(normalizedSearch);
    const lines = fullContent.split("\n");
    const normalizedLines = normalizedContent.split("\n");

    // Find the start/end line indices
    let startLine = 0;
    let charCount = 0;
    for (let i = 0; i < normalizedLines.length; i++) {
      if (charCount === idx) { startLine = i; break; }
      charCount += normalizedLines[i].length + 1;
    }

    const searchLineCount = normalizedSearch.split("\n").length;
    const before = lines.slice(0, startLine).join("\n");
    const after = lines.slice(startLine + searchLineCount).join("\n");

    return [before, replaceBlock, after].filter(Boolean).join("\n");
  }

  // Fallback: couldn't match, return with replacement appended (signal to user)
  return fullContent + "\n\n// === AI EDIT (could not locate exact match) ===\n" + replaceBlock;
}
