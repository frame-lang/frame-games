#!/usr/bin/env bash
# Build the Ruby (ruby.wasm) Asteroids port -> games/asteroids/versions/ruby/
#
# Pipeline:
#   asteroids.frb  --(framec, ruby backend)-->  asteroids.rb   (the Frame FSM)
#   boot.js + asteroids.rb + main.rb  --(esbuild, .rb as text)-->  boot.bundle.js
#   ruby.wasm (vendored from @ruby/3.4-wasm-wasi)  is fetched at runtime by boot.js
#
# The ruby backend is native-passthrough (like js/python/ts): handler bodies are
# hand-written native Ruby. NOTE: in action bodies and for void early-returns,
# use native `return` — the `@@:return(...)` slot sigil is for value-returning
# handlers only (see framec #141). Requires framec on PATH (or ~/.cargo/bin) and
# the @ruby/* npm packages in build/spike-ruby/node_modules.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SPIKE="$HERE/spike-ruby"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="$ROOT/games/asteroids/versions/ruby"
FRAMEC="${FRAMEC:-$(command -v framec || echo "$HOME/.cargo/bin/framec")}"
ESBUILD="$ROOT/node_modules/.bin/esbuild"

echo "==> framec: regenerate asteroids.rb from asteroids.frb"
"$FRAMEC" -l ruby "$SPIKE/asteroids.frb" > "$SPIKE/asteroids.rb"
ruby -c "$SPIKE/asteroids.rb" >/dev/null

echo "==> ensure ruby.wasm + @ruby/wasm-wasi present"
if [ ! -f "$SPIKE/ruby.wasm" ]; then
  (cd "$SPIKE" && npm install --silent @ruby/wasm-wasi@2.7.1 @ruby/3.4-wasm-wasi@2.7.1)
  cp "$SPIKE/node_modules/@ruby/3.4-wasm-wasi/dist/ruby.wasm" "$SPIKE/ruby.wasm"
fi

echo "==> esbuild: bundle boot.js (+ .rb files as text)"
"$ESBUILD" "$SPIKE/boot.js" --bundle --format=iife --platform=browser \
  --loader:.rb=text --minify --outfile="$SPIKE/boot.bundle.js"

echo "==> publish -> $OUT"
mkdir -p "$OUT"
cp "$SPIKE/index.html" "$SPIKE/boot.bundle.js" "$SPIKE/ruby.wasm" "$OUT/"

echo "done. bundle: $(du -h "$OUT/boot.bundle.js" | cut -f1)  ruby.wasm: $(du -h "$OUT/ruby.wasm" | cut -f1)"
