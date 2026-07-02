#!/usr/bin/env bash
# Build the Kotlin (Kotlin/JS) Asteroids port -> games/asteroids/versions/kotlin/
#
# Pipeline:
#   asteroids.fkt  --(framec, kotlin backend)-->  asteroids.kt   (the Frame FSM)
#   asteroids.kt + Main.kt  --(Kotlin/JS IR via gradle+webpack)-->  asteroids.js
#
# Kotlin backend notes: typed backend, native-passthrough control flow
# (`if (cond) {` with parens); factory `__create`; deferred param-referencing
# domain fields emit `lateinit var` (framec #147) and no `@JvmStatic` (framec
# #157) so the same FSM compiles for JVM and JS. Requires: framec, gradle
# (brew install gradle), JDK 17+. First run downloads the Kotlin toolchain.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SPIKE="$HERE/spike-kotlin-web"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="$ROOT/games/asteroids/versions/kotlin"
FRAMEC="${FRAMEC:-$(command -v framec || echo "$HOME/.cargo/bin/framec")}"

echo "==> framec: regenerate asteroids.kt from asteroids.fkt"
"$FRAMEC" -l kotlin "$HERE/spike-kotlin/asteroids.fkt" > "$SPIKE/src/jsMain/kotlin/asteroids.kt"

echo "==> Kotlin/JS (gradle): compile FSM + host -> asteroids.js"
(cd "$SPIKE" && gradle --no-daemon -q jsBrowserDistribution)

echo "==> publish -> $OUT"
mkdir -p "$OUT"
cp "$SPIKE/build/dist/js/productionExecutable/index.html" \
   "$SPIKE/build/dist/js/productionExecutable/asteroids.js" "$OUT/"

echo "done. asteroids.js: $(du -h "$OUT/asteroids.js" | cut -f1)"
