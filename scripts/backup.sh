#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p server/backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
destination="${1:-server/backups/personal-os-$timestamp.db}"
case "$destination" in
  /*) ;;
  *) destination="$PWD/$destination" ;;
esac
mkdir -p "$(dirname "$destination")"
cd server
go run ./cmd/personal-os --db data/personal-os.db --backup "$destination"
