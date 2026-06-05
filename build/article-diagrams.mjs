#!/usr/bin/env node
// ============================================================
// build/article-diagrams.mjs — render per-system state diagrams
// ============================================================
// Produces the static SVGs each game's article.md embeds (e.g.
// games/asteroids/images/ship.svg). Output matches the live in-game
// FSM panel: HTML-table method lists are stripped, leaving just the
// state name on each node + the cluster name on each HSM parent.
//
// Pipeline:
//   1. framec -l graphviz (already done by npm run gen) → game.dot
//   2. Split into per-system digraphs
//   3. Apply the same compactStateLabels / compactClusterLabels
//      regexes the FSM panel uses (src/fsm-panel.ts)
//   4. Pipe each through `dot -Tsvg`
//
// Usage:
//   node build/article-diagrams.mjs <game-id> [System1 System2 ...]
//   node build/article-diagrams.mjs asteroids
//   node build/article-diagrams.mjs asteroids Ship
//
// File naming: PascalCase system → snake_case .svg
//   AsteroidsGame → asteroids_game.svg
//   Ship          → ship.svg
// ============================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(import.meta.url), "..", "..");

// Same regexes as src/fsm-panel.ts. If those change, update here too.
const compactStateLabels = (d) =>
  d.replace(
    /(\w+)\s*\[label = <[\s\S]*?> margin=0 shape=none\]/g,
    (_, name) => `${name} [label="${name}"]`,
  );
const compactClusterLabels = (d) =>
  d.replace(
    /(subgraph\s+cluster_(\w+)\s*\{\s*)label\s*=\s*<[\s\S]*?<\/table>\s*>/g,
    (_, prefix, name) => `${prefix}label = "${name}"`,
  );

function splitSystems(dot) {
  const out = [];
  const re = /digraph\s+(\w+)\s*\{/g;
  let m;
  while ((m = re.exec(dot))) {
    const start = m.index;
    let depth = 0;
    let i = dot.indexOf("{", start);
    for (; i < dot.length; i++) {
      if (dot[i] === "{") depth++;
      else if (dot[i] === "}" && --depth === 0) {
        i++;
        break;
      }
    }
    out.push({ name: m[1], dot: dot.slice(start, i) });
    re.lastIndex = i;
  }
  return out;
}

function snakeCase(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

const [, , game, ...filter] = process.argv;
if (!game) {
  console.error("usage: node build/article-diagrams.mjs <game-id> [System ...]");
  process.exit(1);
}

const dotPath = resolve(
  REPO,
  `vendor/frame-arcade-js/src/games/${game}/${game}.dot`,
);
if (!existsSync(dotPath)) {
  console.error(`error: not found: ${dotPath}`);
  console.error("hint: run `npm run gen` first");
  process.exit(1);
}

const outDir = resolve(REPO, `games/${game}/images`);
mkdirSync(outDir, { recursive: true });

const full = readFileSync(dotPath, "utf8");
const splits = splitSystems(full);
const wanted = filter.length ? new Set(filter) : null;

let rendered = 0;
for (const { name, dot } of splits) {
  if (wanted && !wanted.has(name)) continue;
  const compact = compactClusterLabels(compactStateLabels(dot));
  const file = snakeCase(name);
  const tmp = resolve("/tmp", `${game}_${file}.dot`);
  const svg = resolve(outDir, `${file}.svg`);
  writeFileSync(tmp, compact);
  execSync(`dot -Tsvg "${tmp}" -o "${svg}"`);
  console.log(`  ${name.padEnd(20)} → ${svg.replace(REPO + "/", "")}`);
  rendered++;
}

if (rendered === 0) {
  console.error(`no systems rendered (asked for: ${[...(wanted ?? [])].join(", ") || "all"})`);
  process.exit(1);
}
