#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/go/bin:$PATH"
npm install

npm run db:migrate
npm run dev:server &
server_pid=$!

cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT

npm run dev
