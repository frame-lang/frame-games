#!/usr/bin/env bash
# ============================================================
# build/bootstrap.sh — set up the toolchain to REBUILD the Godot language ports
# (C / Rust / C++) from a clean clone. Idempotent: skips anything already there.
#
#   bash build/bootstrap.sh          # set up everything
#   bash build/bootstrap.sh --check  # report what's present/missing, install nothing
#
# After this, the per-port builds work:
#   npm run build:godot        # GDScript
#   npm run build:godot-c      # C
#   npm run build:godot-rust   # Rust
#   npm run build:godot-cpp    # C++
# ============================================================
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMSDK_DIR="${EMSDK_DIR:-$HOME/emsdk}"
GODOT_CPP="$REPO/build/spike-cpp/godot-cpp-45"
JOBS="$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)"
CHECK_ONLY=0; [ "${1:-}" = "--check" ] && CHECK_ONLY=1
ok(){ printf '  \033[32mok\033[0m   %s\n' "$1"; }
miss(){ printf '  \033[33mMISS\033[0m %s\n' "$1"; }

echo "== prerequisites you must provide (not auto-installed) =="
# Godot 4.6.2 — engine + Web export templates must match the emsdk version below.
if command -v "${GODOT:-godot}" >/dev/null 2>&1; then
    ok "godot: $("${GODOT:-godot}" --version 2>/dev/null | head -1)"
else
    miss "godot 4.6.2 — install from https://godotengine.org and put on PATH (or GODOT=)"
fi
# Web export templates (Godot downloads them on first --export, or via the editor).
TPL="$HOME/Library/Application Support/Godot/export_templates"
ls -d "$TPL"/4.6.* >/dev/null 2>&1 && ok "godot export templates: $(ls "$TPL" | tail -1)" \
    || miss "Godot Web export templates — run: godot --headless --export-pack (once) or install via the editor"
# framec — for C++ it must include the no-exceptions codegen (issue #86).
if command -v "${FRAMEC:-framec}" >/dev/null 2>&1; then ok "framec on PATH"; \
    else miss "framec — build it and set FRAMEC=/path/to/framec (C++ needs the #86 no-exceptions fix)"; fi

if [ "$CHECK_ONLY" = 1 ]; then check(){ :; }; else check(){ "$@"; }; fi

echo "== emsdk 4.0.20 (must match Godot 4.6.2's emscripten) =="
if [ -f "$EMSDK_DIR/upstream/emscripten/emcc" ] && grep -q '4.0.20' "$EMSDK_DIR/upstream/emscripten/emscripten-version.txt" 2>/dev/null; then
    ok "emsdk 4.0.20 at $EMSDK_DIR"
else
    miss "emsdk 4.0.20"
    check bash -c '
        [ -d "'"$EMSDK_DIR"'" ] || git clone https://github.com/emscripten-core/emsdk "'"$EMSDK_DIR"'"
        cd "'"$EMSDK_DIR"'" && ./emsdk install 4.0.20 && ./emsdk activate 4.0.20'
fi

echo "== Rust nightly + rust-src (for cargo -Zbuild-std) =="
if rustup component list --toolchain nightly 2>/dev/null | grep -q 'rust-src (installed)'; then
    ok "nightly + rust-src"
else
    miss "rust nightly + rust-src"
    check rustup toolchain install nightly --component rust-src
fi

echo "== godot-cpp @ godot-4.5-stable, built arm64 + web (no-exceptions web) =="
# master segfaults on the 4.6.2 engine; 4.5-stable is forward-compatible.
if [ ! -d "$GODOT_CPP/.git" ]; then
    miss "godot-cpp clone"
    check git clone --depth 1 --branch godot-4.5-stable https://github.com/godotengine/godot-cpp.git "$GODOT_CPP"
else ok "godot-cpp clone"; fi
A="$GODOT_CPP/bin/libgodot-cpp.macos.template_release.arm64.a"
W="$GODOT_CPP/bin/libgodot-cpp.web.template_release.wasm32.nothreads.a"
if [ -f "$A" ]; then ok "godot-cpp arm64 lib"; else
    miss "godot-cpp arm64 lib (exceptions on — for the macOS host dylib)"
    check bash -c 'cd "'"$GODOT_CPP"'" && scons platform=macos arch=arm64 target=template_release disable_exceptions=no -j'"$JOBS"
fi
if [ -f "$W" ]; then ok "godot-cpp web lib"; else
    miss "godot-cpp web lib (exceptions OFF — Godot web has no exception runtime)"
    check bash -c 'source "'"$EMSDK_DIR"'/emsdk_env.sh" >/dev/null 2>&1; cd "'"$GODOT_CPP"'" && scons platform=web arch=wasm32 target=template_release threads=no disable_exceptions=yes -j'"$JOBS"
fi

echo
if [ "$CHECK_ONLY" = 1 ]; then echo "(--check: nothing installed)"; else
    echo "bootstrap done. Build a port:  GODOT=\$(command -v godot) FRAMEC=… npm run build:godot-c"
fi
