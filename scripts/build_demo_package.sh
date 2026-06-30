#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_NAME="Project-A-demo"
STAMP="$(date +%Y%m%d-%H%M%S)"
WORK_DIR="$ROOT/dist/demo-package"
PACKAGE_DIR="$WORK_DIR/$PACKAGE_NAME"
ZIP_PATH="$ROOT/dist/$PACKAGE_NAME-$STAMP.zip"

cd "$ROOT/frontend"
npm run build

rm -rf "$WORK_DIR"
mkdir -p "$PACKAGE_DIR/backend" "$PACKAGE_DIR/frontend" "$PACKAGE_DIR/scripts" "$PACKAGE_DIR/docs"

rsync -a \
  --exclude "__pycache__/" \
  --exclude "*.pyc" \
  "$ROOT/backend/" "$PACKAGE_DIR/backend/"

rsync -a "$ROOT/frontend/dist/" "$PACKAGE_DIR/frontend/dist/"
rsync -a "$ROOT/docs/" "$PACKAGE_DIR/docs/"
rsync -a "$ROOT/slides/" "$PACKAGE_DIR/slides/"

cp "$ROOT/README.md" "$PACKAGE_DIR/README.md"
cp "$ROOT/docs/FRIEND_DEMO_GUIDE.md" "$PACKAGE_DIR/README_FOR_DEMO.md"
cp "$ROOT/scripts/start_demo.command" "$PACKAGE_DIR/scripts/start_demo.command"
cp "$ROOT/scripts/start_demo_windows.bat" "$PACKAGE_DIR/scripts/start_demo_windows.bat"
cp "$ROOT/scripts/find_free_port.py" "$PACKAGE_DIR/scripts/find_free_port.py"
chmod +x "$PACKAGE_DIR/scripts/start_demo.command"

cat > "$PACKAGE_DIR/.env.example" <<'EOF'
# Optional, but required for running the full AI campaign analysis.
# Copy this file to .env and fill in your own key before the demo.
DEEPSEEK_API_KEY=sk-your-key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
EOF

mkdir -p "$ROOT/dist"
python3 - "$PACKAGE_DIR" "$ZIP_PATH" <<'PY'
from pathlib import Path
import sys
import zipfile

package_dir = Path(sys.argv[1])
zip_path = Path(sys.argv[2])
root = package_dir.parent

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(package_dir.rglob("*")):
        if path.is_dir() or path.name == ".DS_Store" or path.name.startswith("._"):
            continue
        arcname = path.relative_to(root).as_posix()
        info = zipfile.ZipInfo.from_file(path, arcname)
        if path.name == "start_demo.command":
            info.external_attr = (0o100755 & 0xFFFF) << 16
        with path.open("rb") as handle:
            archive.writestr(info, handle.read(), compress_type=zipfile.ZIP_DEFLATED)
PY

echo "Demo package created:"
echo "$ZIP_PATH"
