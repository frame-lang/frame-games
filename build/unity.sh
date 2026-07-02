#!/usr/bin/env bash
# ============================================================
# build/unity.sh — build the Unity (C#) WebGL port of Asteroids
# ============================================================
# Pipeline:  framec (asteroids.fcs -> Assets/Asteroids.cs)  ->  Unity batchmode
#            WebGL build  ->  games/asteroids/versions/unity/
#
# Unlike the other ports this needs a LICENSED, modern Unity (2022 LTS or
# Unity 6) with the WebGL Build Support module. It is NOT CI-buildable (the
# editor + a Unity-account license are required), so the bundle is committed.
# See build/spike-unity/SETUP.md for the one-time install + license steps.
#
# Pre-reqs (set as env or PATH):
#   UNITY   = the Editor binary, e.g.
#             /Applications/Unity/Hub/Editor/<ver>/Unity.app/Contents/MacOS/Unity
#   FRAMEC  = framec WITH the #116 fix (void C# interface-call ';' terminator)
#
# BLOCKED until: framec #116 lands AND a licensed modern Unity is installed.
# ============================================================
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPIKE="$REPO/build/spike-unity"
OUT="$REPO/games/asteroids/versions/unity"
FRAMEC="${FRAMEC:-framec}"
UNITY="${UNITY:?set UNITY to the Unity Editor binary (see build/spike-unity/SETUP.md)}"

echo "==> [1/3] framec: asteroids.fcs -> Assets/Asteroids.cs (FSM)"
"$FRAMEC" -l csharp "$SPIKE/asteroids.fcs" > "$SPIKE/Assets/Asteroids.cs"

echo "==> [2/3] Unity batchmode WebGL build (this takes a few minutes)"
rm -rf "$SPIKE/build-out"
"$UNITY" -batchmode -nographics -quit \
    -projectPath "$SPIKE" \
    -buildTarget WebGL \
    -executeMethod BuildScript.BuildWebGL \
    -logFile - 2>&1 | tail -40
[ -f "$SPIKE/build-out/index.html" ] || { echo "error: Unity build produced no index.html"; exit 1; }

echo "==> [3/3] publish -> $OUT"
rm -rf "$OUT"; mkdir -p "$OUT"
cp -R "$SPIKE/build-out/." "$OUT/"
echo "==> done ($(du -sh "$OUT" | cut -f1))"
