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
    a.href = `${import.meta.env.BASE_URL}game.html?game=${encodeURIComponent(m.id)}`;

    const h = document.createElement("h2");
    h.textContent = m.title;

    const t = document.createElement("p");
    t.className = "teaches";
    t.textContent = m.summary;

    a.append(h, t);
    return a;
  }),
);
