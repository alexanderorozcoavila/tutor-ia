#!/usr/bin/env bash
set -euo pipefail

# db_backup.sh
# Simple Postgres backup script that saves a compressed dump to documentacion/backups/
# Usage examples:
#  PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=secret PGDATABASE=mydb ./documentacion/db_backup.sh
#  Or provide a full connection string: ./documentacion/db_backup.sh "postgres://user:pass@host:5432/dbname"

OUT_DIR="$(dirname "$0")/backups"
mkdir -p "$OUT_DIR"

TS=$(date +%Y%m%d_%H%M%S)

if [ "$#" -ge 1 ] && [[ "$1" == postgres://* ]]; then
  # Connection URL provided as first arg
  CONN_STR="$1"
  FILE="$OUT_DIR/db_backup_${TS}.dump"
  echo "Using connection string provided. Dumping database to: $FILE"
  # pg_dump with custom format (compressed) is convenient; if not available, user can modify
  pg_dump -Fc "$CONN_STR" -f "$FILE"
  gzip -f "$FILE"
  echo "Backup saved: ${FILE}.gz"
  exit 0
fi

# Otherwise expect env vars: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-$(whoami)}
PGPASSWORD=${PGPASSWORD:-}
PGDATABASE=${PGDATABASE:-}

if [ -z "$PGDATABASE" ]; then
  echo "ERROR: PGDATABASE not set. Either pass a postgres:// connection string or set PGDATABASE env var."
  echo "Example: PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=secret PGDATABASE=mydb $0"
  exit 2
fi

export PGPASSWORD

FILE="$OUT_DIR/${PGDATABASE}_backup_${TS}.sql"
echo "Starting dump of database '$PGDATABASE' on $PGHOST:$PGPORT as $PGUSER"

if command -v pg_dump > /dev/null 2>&1; then
  pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -F c -b -v -f "$FILE" "$PGDATABASE"
  gzip -f "$FILE"
  echo "Backup completed: ${FILE}.gz"
else
  echo "pg_dump not found in PATH. Install PostgreSQL client tools and retry."
  exit 3
fi

# Optional: dump globals (roles/cluster-wide) if pg_dumpall is available
if command -v pg_dumpall > /dev/null 2>&1; then
  GFILE="$OUT_DIR/global_roles_${TS}.sql"
  echo "Dumping global roles to $GFILE"
  pg_dumpall -g -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -f "$GFILE"
  gzip -f "$GFILE"
  echo "Globals backup completed: ${GFILE}.gz"
fi

echo "All done. Backups are in: $OUT_DIR"
