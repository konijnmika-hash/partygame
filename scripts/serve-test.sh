#!/usr/bin/env bash
# Builds and (re)starts the production server on a test port, recording its PID.
# Usage: scripts/serve-test.sh <port> <db-path> <pid-file>
set -e
PORT_ARG="$1"
DB_ARG="$2"
PID_FILE="$3"
if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE")"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID"
    sleep 0.5
  fi
fi
npm run build > /dev/null 2>&1 || { echo "build failed"; npm run build 2>&1 | tail -30; exit 1; }
PORT="$PORT_ARG" DATABASE_PATH="$DB_ARG" nohup node dist/server/index.js > "$PID_FILE.log" 2>&1 &
echo $! > "$PID_FILE"
sleep 1.2
curl -s "localhost:$PORT_ARG/api/health"
echo
