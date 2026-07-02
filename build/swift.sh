#!/usr/bin/env bash
# Build the Swift (SwiftWasm) Asteroids port -> games/asteroids/versions/swift/
#
# Pipeline:
#   AsteroidsGame.fswift  --(framec, swift backend)-->  AsteroidsGame.swift
#   FSM + host.swift (JavaScriptKit)  --(SwiftWasm SDK)-->  AsteroidsSwift.wasm
#   swift package js (PackageToJS)  -->  ESM runtime  --(esbuild)-->  boot.bundle.js
#
# Swift backend notes: typed backend, native-passthrough control flow in Swift
# style (`if cond {` — no parens); preamble types referenced by domain fields
# must be `public`; deferred param-referencing domain fields emit `var x: T!`
# (framec #156). Toolchain (one-time): brew install swiftly; swiftly install
# 6.3.0; swift sdk install <swift-wasm-6.3-RELEASE wasip1 artifactbundle> —
# the SDK version must match the toolchain EXACTLY (6.3.0, not 6.3.x); the
# spike's .swift-version pins it. CLT >= 15 required (plugin host compile).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SPIKE="$HERE/spike-swift-web"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="$ROOT/games/asteroids/versions/swift"
FRAMEC="${FRAMEC:-$(command -v framec || echo "$HOME/.cargo/bin/framec")}"
SDK="6.3-RELEASE-wasm32-unknown-wasip1"

. "$HOME/.swiftly/env.sh"

echo "==> framec: regenerate AsteroidsGame.swift from AsteroidsGame.fswift"
"$FRAMEC" -l swift "$HERE/spike-swift/AsteroidsGame.fswift" > "$SPIKE/Sources/AsteroidsSwift/AsteroidsGame.swift"

echo "==> SwiftWasm: build + package (swift package js)"
(cd "$SPIKE" && swift package --swift-sdk "$SDK" js -c release)

echo "==> esbuild: bundle the ESM runtime (+ wasi shim) -> boot.bundle.js"
(cd "$SPIKE" && rm -rf pkg && cp -R .build/plugins/PackageToJS/outputs/Package pkg)
[ -d "$SPIKE/node_modules/@bjorn3/browser_wasi_shim" ] || (cd "$SPIKE" && npm install --silent @bjorn3/browser_wasi_shim)
"$ROOT/node_modules/.bin/esbuild" "$SPIKE/boot.js" --bundle --format=esm --platform=browser \
  --external:./AsteroidsSwift.wasm --outfile="$SPIKE/boot.bundle.js"

echo "==> publish -> $OUT"
mkdir -p "$OUT"
cp "$SPIKE/shell.html" "$OUT/index.html"
cp "$SPIKE/boot.bundle.js" "$SPIKE/pkg/AsteroidsSwift.wasm" "$OUT/"

echo "done. wasm: $(du -h "$OUT/AsteroidsSwift.wasm" | cut -f1)  bundle: $(du -h "$OUT/boot.bundle.js" | cut -f1)"
