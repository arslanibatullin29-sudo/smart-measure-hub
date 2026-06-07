#!/usr/bin/env bash
# Restore Supabase Dashboard backup via Docker (no local psql required).
#
# Usage:
#   SUPABASE_DB_PASSWORD='your-password' ./scripts/restore-supabase-backup.sh
#   SUPABASE_DB_PASSWORD='your-password' ./scripts/restore-supabase-backup.sh /path/to/backup.backup.gz
#
# Get password: Supabase Dashboard → Project Settings → Database → Reset database password

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-czqatrknpxxjajsvkhvl}"
BACKUP_INPUT="${1:-${BACKUP_FILE:-$HOME/Downloads/db_cluster-30-12-2025@11-16-20.backup.gz}}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"
CONNECTION_MODE="${CONNECTION_MODE:-direct}"
POOLER_HOST="${SUPABASE_POOLER_HOST:-aws-0-us-east-1.pooler.supabase.com}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "Error: SUPABASE_DB_PASSWORD is not set." >&2
  echo "Reset password in Supabase Dashboard → Project Settings → Database." >&2
  exit 1
fi

if [[ ! -f "$BACKUP_INPUT" ]]; then
  echo "Error: backup file not found: $BACKUP_INPUT" >&2
  exit 1
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

BACKUP_FILE="$WORK_DIR/backup.backup"

if [[ "$BACKUP_INPUT" == *.gz ]]; then
  echo "→ Unzipping backup..."
  gunzip -c "$BACKUP_INPUT" > "$BACKUP_FILE"
else
  cp "$BACKUP_INPUT" "$BACKUP_FILE"
fi

echo "→ Pulling $POSTGRES_IMAGE (if needed)..."
docker pull "$POSTGRES_IMAGE" >/dev/null

if [[ "$CONNECTION_MODE" == "pooler" ]]; then
  DB_HOST="$POOLER_HOST"
  DB_USER="postgres.${PROJECT_REF}"
  echo "→ Restoring via session pooler ($DB_HOST)..."
else
  DB_HOST="db.${PROJECT_REF}.supabase.com"
  DB_USER="postgres"
  echo "→ Restoring via direct connection ($DB_HOST)..."
fi

echo "→ Running psql restore (this may take several minutes)..."
docker run --rm \
  -e PGPASSWORD="$DB_PASSWORD" \
  -v "$WORK_DIR:/backups:ro" \
  "$POSTGRES_IMAGE" \
  psql \
    -h "$DB_HOST" \
    -p 5432 \
    -U "$DB_USER" \
    -d postgres \
    -v ON_ERROR_STOP=0 \
    -f /backups/backup.backup

echo "✓ Restore finished. Check output above for errors."
echo "  Remember: Edge Functions, Auth settings, and API keys are NOT in the backup."
