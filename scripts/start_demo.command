#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f "$ROOT/frontend/dist/index.html" ]; then
  echo "frontend/dist is missing."
  echo "Ask Codex to run: cd \"$ROOT/frontend\" && npm run build"
  exit 1
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV="$ROOT/.demo-venv"

if [ ! -x "$VENV/bin/python" ]; then
  echo "Creating local Python environment at .demo-venv ..."
  "$PYTHON_BIN" -m venv "$VENV"
  "$VENV/bin/python" -m pip install --upgrade pip
  "$VENV/bin/python" -m pip install -r "$ROOT/backend/requirements.txt"
fi

PYTHON="$VENV/bin/python"
PORT="$("$PYTHON" - <<'PY'
import socket

for port in range(8000, 8011):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            continue
        print(port)
        break
else:
    raise SystemExit("No free local port found in 8000-8010.")
PY
)"

URL="http://127.0.0.1:$PORT"

echo
echo "Project A demo is starting."
echo "Open this address if the browser does not open automatically:"
echo "$URL"
echo
echo "Leave this window open during the demo. Press Ctrl+C to stop."
echo

(sleep 2; command -v open >/dev/null 2>&1 && open "$URL" >/dev/null 2>&1 || true) &

export PYTHONPATH="$ROOT/backend:${PYTHONPATH:-}"
exec "$PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT"
