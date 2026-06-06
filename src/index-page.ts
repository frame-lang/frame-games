// The games index. Data-driven: Vite eager-loads every games/<id>/game.json
// manifest at build time, so adding a game is a data-only change — drop in a
// new manifest and it appears in the grid.
import type { GameManifest } from "./games";

const modules = import.meta.glob<{ default: GameManifest }>(
  "../games/*/game.json",
  { eager: true },
);
// Index only shows asteroids while the mobile work is in progress — the
// other games haven't been adapted yet. They're still bundled and reachable
// via direct game.html?game=<id> URLs; this is purely a card-visibility
// filter on the home grid.
const VISIBLE_GAMES = new Set(["asteroids"]);
const manifests = Object.values(modules)
  .map((m) => m.default)
  .filter((m) => VISIBLE_GAMES.has(m.id))
  .sort((a, b) => a.title.localeCompare(b.title));

const grid = document.getElementById("game-grid")!;
grid.replaceChildren(
  ...manifests.map((m) => {
    const a = document.createElement("a");
    a.className = "game-card";
    a.href = `${import.meta.env.BASE_URL}game.html?game=${encodeURIComponent(m.id)}`;

    const h = document.createElement("h2");
    h.textContent = m.title;

    const t = document.createElement("p");
    t.className = "teaches";
    t.textContent = m.summary;

    const versions = document.createElement("div");
    versions.className = "versions";
    for (const v of m.versions) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = v.label;
      versions.appendChild(badge);
    }

    a.append(h, t, versions);
    return a;
  }),
);
