#!/usr/bin/env bash
# Build the Java (TeaVM) Asteroids port -> games/asteroids/versions/java/
#
# Pipeline:
#   AsteroidsGame.fjava  --(framec, java backend)-->  AsteroidsGame.java  (the Frame FSM)
#   AsteroidsGame.java + Main.java  --(TeaVM via maven)-->  asteroids.js  (plain JS, self-contained)
#
# Java backend notes: typed backend with native-passthrough control flow
# (`if (cond) {` with `;` on every statement — framec adds `;` to Frame CALLS but
# NOT to Frame ASSIGNMENTS, so always write it); non-main systems must be
# `@@system private` (one public class per file — E430); factory is `__create`.
# Requires: framec, maven (brew install maven), JDK 17+.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SPIKE="$HERE/spike-java-web"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="$ROOT/games/asteroids/versions/java"
FRAMEC="${FRAMEC:-$(command -v framec || echo "$HOME/.cargo/bin/framec")}"

echo "==> framec: regenerate AsteroidsGame.java from AsteroidsGame.fjava"
"$FRAMEC" -l java "$HERE/spike-java/AsteroidsGame.fjava" > "$SPIKE/src/main/java/AsteroidsGame.java"

echo "==> TeaVM (maven): compile FSM + host -> dist/asteroids.js"
(cd "$SPIKE" && mvn -B -q package)

echo "==> publish -> $OUT"
mkdir -p "$OUT"
cp "$SPIKE/index.html" "$SPIKE/dist/asteroids.js" "$OUT/"

echo "done. asteroids.js: $(du -h "$OUT/asteroids.js" | cut -f1)"
