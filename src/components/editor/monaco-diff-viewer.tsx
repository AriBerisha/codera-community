"use client";

import dynamic from "next/dynamic";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.DiffEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 bg-muted/50 animate-pulse" />
    ),
  }
);

const LANG_MAP: Record<string, string> = {
  typescript: "typescript",
  javascript: "javascript",
  python: "python",
  go: "go",
  rust: "rust",
  java: "java",
  ruby: "ruby",
  php: "php",
  c: "c",
  cpp: "cpp",
  csharp: "csharp",
  css: "css",
  scss: "scss",
  html: "html",
  sql: "sql",
  shell: "shell",
  yaml: "yaml",
  json: "json",
  markdown: "markdown",
  dockerfile: "dockerfile",
  vue: "html",
  svelte: "html",
  prisma: "graphql",
  graphql: "graphql",
};

interface MonacoDiffViewerProps {
  language: string | null;
  original: string;
  modified: string;
}

export function MonacoDiffViewer({
  language,
  original,
  modified,
}: MonacoDiffViewerProps) {
  const monacoLang = language ? LANG_MAP[language] || language : "plaintext";

  return (
    <DiffEditor
      height="100%"
      language={monacoLang}
      original={original}
      modified={modified}
      theme="vs-dark"
      options={{
        readOnly: true,
        renderSideBySide: false,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        lineNumbersMinChars: 3,
        glyphMargin: false,
        folding: true,
        lineDecorationsWidth: 0,
        automaticLayout: true,
        renderOverviewRuler: false,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
    />
  );
}
