#!/bin/bash
set -e

DB_PATH="./data/staking.db"
BACKUP_DIR="./backups"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: database not found at $DB_PATH"
  exit 1
fi

STAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/staking_$STAMP.db"

cp "$DB_PATH" "$BACKUP_FILE"

echo "BACKUP CREATED: $BACKUP_FILE"
