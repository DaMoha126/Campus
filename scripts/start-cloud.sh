#!/bin/sh
set -eu
umask 077
: "${PORT:=10000}"
: "${ETUDIA_DATA_DIR:=/var/data/pb_data}"
if [ "${ETUDIA_DEMO:-0}" = "1" ]; then
  : "${ETUDIA_DEMO_PASSWORD:?Set a private password for the demo accounts}"
  case "$ETUDIA_DATA_DIR" in
    /tmp/etudia-demo-*) ;;
    *) echo "Demo mode requires an isolated /tmp/etudia-demo-* directory." >&2; exit 1 ;;
  esac
  # Technical account is random and never shared with visitors of the demo.
  ETUDIA_SUPERUSER_EMAIL=technical@demo.invalid
  ETUDIA_SUPERUSER_PASSWORD="$(head -c 48 /dev/urandom | base64 | tr -d '\n')"
fi
if [ -z "${ETUDIA_PUBLIC_HOST:-${RENDER_EXTERNAL_HOSTNAME:-}}" ]; then
  echo "A public hostname must be configured." >&2
  exit 1
fi
mkdir -p "$ETUDIA_DATA_DIR"
/app/pocketbase migrate up --dir="$ETUDIA_DATA_DIR" --migrationsDir=/app/pb_migrations --dev=false
# Never expose a fresh PocketBase instance without an initial superuser.
# The marker is on the persistent disk; subsequent restarts never reset credentials.
if [ ! -f "$ETUDIA_DATA_DIR/.etudia-initialized" ]; then
  : "${ETUDIA_SUPERUSER_EMAIL:?Set the initial superuser email in Render secrets}"
  : "${ETUDIA_SUPERUSER_PASSWORD:?Set the initial superuser password in Render secrets}"
  /app/pocketbase superuser create "$ETUDIA_SUPERUSER_EMAIL" "$ETUDIA_SUPERUSER_PASSWORD" \
    --dir="$ETUDIA_DATA_DIR" --migrationsDir=/app/pb_migrations --dev=false >/dev/null
  touch "$ETUDIA_DATA_DIR/.etudia-initialized"
fi
unset ETUDIA_SUPERUSER_EMAIL ETUDIA_SUPERUSER_PASSWORD
if [ "${ETUDIA_DEMO:-0}" = "1" ]; then
  /app/pocketbase seed-demo --dir="$ETUDIA_DATA_DIR" --hooksDir=/app/pb_hooks \
    --migrationsDir=/app/pb_migrations --dev=false
fi
exec /app/pocketbase serve --http="0.0.0.0:$PORT" --dir="$ETUDIA_DATA_DIR" \
  --migrationsDir=/app/pb_migrations --hooksDir=/app/pb_hooks --publicDir=/app/pb_public \
  --automigrate=false --dev=false
