const INCLUDED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".rb", ".php",
  ".c", ".cpp", ".h", ".hpp", ".cs",
  ".css", ".scss", ".less",
  ".html", ".htm", ".vue", ".svelte",
  ".sql", ".sh", ".bash",
  ".yaml", ".yml", ".json", ".toml",
  ".md", ".mdx",
  ".prisma", ".graphql", ".gql", ".proto",
  ".env.example", ".gitignore", ".dockerignore",
  ".tf", ".hcl",
  "Dockerfile", "Makefile",
]);

const EXCLUDED_PATHS = [
  "node_modules/",
  "vendor/",
  "dist/",
  "build/",
  ".git/",
  "__pycache__/",
  ".next/",
  ".nuxt/",
  "coverage/",
  ".cache/",
  "target/",
  "bin/",
  "obj/",
];

const EXCLUDED_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "composer.lock",
  "Gemfile.lock",
  "Cargo.lock",
  "go.sum",
]);

const MAX_FILE_SIZE = 100 * 1024; // 100KB

export function shouldIndexFile(filePath: string): boolean {
  const fileName = filePath.split("/").pop() || "";

  // Check excluded files
  if (EXCLUDED_FILES.has(fileName)) return false;

  // Check excluded paths
  if (EXCLUDED_PATHS.some((p) => filePath.includes(p))) return false;

  // Check minified files
  if (fileName.endsWith(".min.js") || fileName.endsWith(".min.css")) return false;
  if (fileName.endsWith(".map")) return false;

  // Special filenames without extension
  if (fileName === "Dockerfile" || fileName === "Makefile") return true;

  // Check extension
  const ext = "." + fileName.split(".").pop();
  return INCLUDED_EXTENSIONS.has(ext);
}

export function getLanguageFromPath(filePath: string): string | null {
  const fileName = filePath.split("/").pop() || "";
  if (fileName === "Dockerfile") return "dockerfile";
  if (fileName === "Makefile") return "makefile";

  const ext = "." + fileName.split(".").pop();
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescript",
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".rb": "ruby",
    ".php": "php",
    ".c": "c", ".h": "c",
    ".cpp": "cpp", ".hpp": "cpp",
    ".cs": "csharp",
    ".css": "css", ".scss": "scss", ".less": "less",
    ".html": "html", ".htm": "html",
    ".vue": "vue",
    ".svelte": "svelte",
    ".sql": "sql",
    ".sh": "shell", ".bash": "shell",
    ".yaml": "yaml", ".yml": "yaml",
    ".json": "json",
    ".toml": "toml",
    ".md": "markdown", ".mdx": "markdown",
    ".prisma": "prisma",
    ".graphql": "graphql", ".gql": "graphql",
    ".proto": "protobuf",
    ".tf": "terraform", ".hcl": "hcl",
  };

  return map[ext] || null;
}

export { MAX_FILE_SIZE };
