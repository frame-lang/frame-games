// The games index. Data-driven: Vite eager-loads every games/<id>/game.json
// manifest at build time, so adding a game is a data-only change — drop in a
// new manifest and it appears in the grid.
import type { GameManifest } from "./games";

const modules = import.meta.glob<{ default: GameManifest }>(
  "../games/*/game.json",
  { eager: true },
);
const manifests = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.title.localeCompare(b.title));

const grid = document.getElementById("game-grid")!;
grid.replaceChildren(
  ...manifests.map((m) => {
    const a = document.createElement("a");
    a.className = "game-card";
    a.href = `/game.html?game=${encodeURIComponent(m.id)}`;

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
