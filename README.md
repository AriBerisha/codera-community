# GitLab AI

A multi-user platform that connects to GitLab, indexes repository code, and lets teams chat with AI that can cross-reference and pinpoint code across projects.

## Features

- **Multi-user auth** with admin/member roles (first launch creates admin)
- **GitLab integration** via Personal Access Token -- syncs and indexes projects from a group
- **Multi-provider AI** -- OpenRouter, OpenAI, Google, Ollama, Open WebUI
- **Code-aware chat** -- AI searches indexed files with full-text search (tsvector + pg_trgm) and cites `file:line`
- **Streaming responses** with Markdown and syntax-highlighted code blocks

## Tech stack

Next.js 16, TypeScript, PostgreSQL 16, Prisma 7, Auth.js v5, Vercel AI SDK v6, Tailwind CSS v4, shadcn/ui v4, Docker

---

## Quick start (local development)

### Prerequisites

- Node.js 22+
- Docker (for PostgreSQL)

### 1. Clone and install

```bash
git clone <repo-url> && cd gitlab-ai
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Generate the secrets and paste them into `.env`:

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY
openssl rand -hex 32
```

Your `.env` should look like:

```
DATABASE_URL="postgresql://gitlab_ai:changeme@localhost:5433/gitlab_ai"
POSTGRES_PASSWORD=changeme
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<paste-base64-here>
ENCRYPTION_KEY=<paste-hex-here>
```

### 3. Start PostgreSQL

```bash
docker compose up db -d
```

This runs Postgres on **port 5433** (to avoid conflicts with any local Postgres on 5432). Wait a few seconds for the healthcheck.

### 4. Run migrations and generate Prisma client

```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/setup` to create the initial admin account.

---

## Fresh start (reset everything)

To wipe the database and start over:

```bash
# Stop the app if running, then:
docker compose down -v          # removes the DB container AND its data volume
docker compose up db -d          # start a fresh DB
npx prisma migrate deploy       # re-create all tables + indexes
npm run dev                      # app starts, redirects to /setup
```

If you also want to regenerate your secrets:

```bash
# New NEXTAUTH_SECRET -- all existing sessions will be invalidated
openssl rand -base64 32

# New ENCRYPTION_KEY -- any previously stored API keys / PATs become unreadable
openssl rand -hex 32
```

Update `.env` with the new values before starting the app.

---

## Docker (full stack)

Run the entire platform (app + database) with a single command.

### 1. Environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` (see commands above).

**Note:** When running fully in Docker, the app connects to the DB container internally, so `DATABASE_URL` is set automatically in `docker-compose.yml`. The one in `.env` is only used for local development.

### 2. Build and start

```bash
docker compose up --build -d
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### 3. Fresh start (Docker)

```bash
docker compose down -v           # stop everything, delete DB volume
docker compose up --build -d     # rebuild and start fresh
```

The app auto-runs `prisma migrate deploy` on startup (see `Dockerfile` CMD), so tables are created automatically.

---

## After setup

1. **Create admin** -- first visit redirects to `/setup`
2. **Configure AI** -- Admin > Settings > pick provider, model, and API key
3. **Connect GitLab** -- Admin > GitLab > enter URL, PAT (`read_api` scope), and Group ID
4. **Index projects** -- include the repos you want, click Index (runs in background)
5. **Chat** -- select indexed repos from the dropdown and ask about your code

---

## Project structure

```
src/
  app/
    setup/                      First-time admin setup
    login/                      Login page
    (authenticated)/
      chat/                     Chat interface + conversations
      admin/
        users/                  User management
        gitlab/                 GitLab connection + indexing
        settings/               AI provider config
    api/                        All API routes
  lib/
    auth.ts / auth.config.ts    Auth.js (split for Edge compatibility)
    prisma.ts                   Prisma client singleton (PrismaPg adapter)
    crypto.ts                   AES-256-GCM encrypt/decrypt
    ai/
      providers.ts              AI provider factory
      code-context.ts           Three-tier code search (FTS + trigram + ILIKE)
      system-prompt.ts          System prompt builder with code context
    gitlab/
      client.ts                 GitLab API wrapper
      indexer.ts                Repository indexing pipeline
      file-filter.ts            File inclusion rules + language detection
  components/
    chat/                       ChatInterface, MessageBubble, ProjectSelector
    layout/                     Sidebar
    ui/                         shadcn/ui components
prisma/
  schema.prisma                 Database schema
  migrations/                   All migrations (including FTS indexes)
```
