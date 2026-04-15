#!/bin/bash
# Sincroniza /Users/securex07/flux-marketing/ → data/flux-marketing/
# para que Vercel pueda leer el workspace de los agentes en prod.
# Excluye secretos (.claude/, .mcp.json) y binarios grandes.

set -e
SRC="/Users/securex07/flux-marketing/"
DST="$(cd "$(dirname "$0")/.." && pwd)/data/flux-marketing/"

echo "↻ Syncing agents workspace…"
echo "  from: $SRC"
echo "  to:   $DST"

rsync -a --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.claude/' \
  --exclude='.mcp.json' \
  --exclude='.DS_Store' \
  --exclude='output/*.jpg' \
  --exclude='output/*.jpeg' \
  --exclude='output/*.png' \
  --exclude='output/*.webp' \
  --exclude='output/*.mp4' \
  --exclude='output/*.mov' \
  "$SRC" "$DST"

# Verificar que no filtramos secretos
if grep -rlE "(sk-ant-|sk-proj-|fal_|AIza)" "$DST" 2>/dev/null; then
  echo "⚠️  ADVERTENCIA: se detectaron posibles secretos en los archivos sincronizados."
  echo "   Revisá los archivos anteriores y limpiá antes de commitear."
  exit 1
fi

SIZE=$(du -sh "$DST" | cut -f1)
COUNT=$(find "$DST" -type f | wc -l | tr -d ' ')
echo "✓ OK — $COUNT archivos, $SIZE"
echo ""
echo "Siguiente paso:"
echo "  git add data/flux-marketing && git commit -m 'sync: agents workspace snapshot'"
