#!/usr/bin/env bash
# Local development PostgreSQL, kept inside the project (./.pgdata) so it never
# touches any other database on this machine. Usage:
#   npm run db:start | db:stop | db:status
set -euo pipefail

# PostgreSQL on macOS refuses to start without a valid locale in the environment.
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/.pgdata"
PORT="${PGPORT_DEV:-5433}"

cmd="${1:-status}"

ensure_cluster() {
  if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
    echo "→ Creating local database cluster in .pgdata"
    "$PG_BIN/initdb" -D "$DATA_DIR" -U postgres --auth=trust -E UTF8 --locale=en_US.UTF-8 >/dev/null
    # Listen on localhost only.
    echo "listen_addresses = 'localhost'" >> "$DATA_DIR/postgresql.conf"
    echo "port = $PORT" >> "$DATA_DIR/postgresql.conf"
  fi
}

case "$cmd" in
  start)
    ensure_cluster
    if "$PG_BIN/pg_ctl" -D "$DATA_DIR" status >/dev/null 2>&1; then
      echo "✓ Database already running on port $PORT"
    else
      "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_DIR/server.log" -w start >/dev/null
      echo "✓ Database started on port $PORT"
    fi
    for db in hastkala_dev hastkala_test; do
      if ! "$PG_BIN/psql" -h localhost -p "$PORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1; then
        "$PG_BIN/createdb" -h localhost -p "$PORT" -U postgres "$db"
        echo "✓ Created database $db"
      fi
    done
    ;;
  stop)
    "$PG_BIN/pg_ctl" -D "$DATA_DIR" -w stop >/dev/null && echo "✓ Database stopped"
    ;;
  status)
    "$PG_BIN/pg_ctl" -D "$DATA_DIR" status || true
    ;;
  *)
    echo "Usage: $0 start|stop|status" >&2
    exit 1
    ;;
esac
