#!/usr/bin/env bash
# ============================================================
# build/share-engine.sh <full-export-dir> <published-game-dir>
# ------------------------------------------------------------
# Splits a full Godot 4.x web export into:
#   - a SHARED engine at  <game-dir>/../_engine/  (the ~46 MB the browser
#     downloads once and caches across every language tab), and
#   - a THIN per-game dir  <game-dir>/  holding only what's unique:
#     index.pck (the project), the GDExtension .wasm (if any), and an
#     index.html whose loader points `executable` at ../_engine/ while keeping
#     `mainPack` (and gdextensionLibs) local.
# All four ports use the SAME dlink engine (export with extensions_support=true),
# so _engine/ is written identically by each — idempotent.
# ============================================================
set -euo pipefail

SRC="$1"; DST="$2"
ENGINE="$(cd "$(dirname "$DST")" && pwd)/_engine"
ENGINE_FILES=(index.js index.wasm index.side.wasm \
  index.audio.worklet.js index.audio.position.worklet.js \
  index.png index.icon.png index.apple-touch-icon.png)

# stage the source (handles SRC == DST, e.g. an in-place gdscript export)
TMP="$(mktemp -d)"; cp "$SRC"/* "$TMP"/
mkdir -p "$ENGINE"
for f in "${ENGINE_FILES[@]}"; do [ -f "$TMP/$f" ] && cp "$TMP/$f" "$ENGINE/$f"; done

rm -rf "$DST"; mkdir -p "$DST"
# per-game payload = everything that is NOT a shared engine file or the html
for f in "$TMP"/*; do
  base="$(basename "$f")"
  case " ${ENGINE_FILES[*]} index.html " in *" $base "*) continue ;; esac
  cp "$f" "$DST/$base"
done

# thin index.html: load engine + executable from ../_engine, keep pck local
python3 - "$TMP/index.html" "$DST/index.html" <<'PY'
import sys, re
s = open(sys.argv[1]).read()
s = s.replace('<script src="index.js"></script>', '<script src="../_engine/index.js"></script>')
s = re.sub(r'"executable":"index"', '"executable":"../_engine/index","mainPack":"index.pck"', s)
s = s.replace('"index.wasm":', '"../_engine/index.wasm":')          # fileSizes progress key
for ic in ('index.icon.png', 'index.apple-touch-icon.png', 'index.png'):
    s = s.replace('"%s"' % ic, '"../_engine/%s"' % ic)
open(sys.argv[2], 'w').write(s)
PY

rm -rf "$TMP"
echo "    shared -> $(du -sh "$ENGINE" | cut -f1) engine, $(du -sh "$DST" | cut -f1) game dir ($DST)"
