#!/usr/bin/env bash
# Generates a .env file with random secrets for local development.
# Usage: ./scripts/setup-env.sh
#
# Safe to re-run — will NOT overwrite an existing .env file unless --force is passed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

if [[ -f "$ENV_FILE" ]] && [[ "${1:-}" != "--force" ]]; then
  echo "⚠  .env already exists. Use --force to overwrite."
  exit 1
fi

NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

cat > "$ENV_FILE" <<EOF
# Database (port 5433 to avoid conflicts with local PostgreSQL on 5432)
DATABASE_URL="postgresql://gitlab_ai:changeme@localhost:5433/gitlab_ai"
POSTGRES_PASSWORD=changeme

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# Encryption (for storing API keys at rest)
ENCRYPTION_KEY=${ENCRYPTION_KEY}
EOF

echo "✓ Created $ENV_FILE with fresh secrets."
