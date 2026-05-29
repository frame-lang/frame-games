// The games index. For now this is a small static list; Phase 4 will make it
// read each games/<id>/game.json manifest so adding a game is data-only.
interface IndexEntry {
  id: string;
  title: string;
  teaches: string;
  versions: string[];
}

const GAMES: IndexEntry[] = [
  {
    id: "breakout",
    title: "Breakout",
    teaches: "Multi-system composition — a Ball, a BrickField, and the game that owns them.",
    versions: ["JavaScript", "Godot (WASM)"],
  },
];

const grid = document.getElementById("game-grid")!;
grid.replaceChildren(
  ...GAMES.map((g) => {
    const a = document.createElement("a");
    a.className = "game-card";
    a.href = `/game.html?game=${encodeURIComponent(g.id)}`;

    const h = document.createElement("h2");
    h.textContent = g.title;

    const t = document.createElement("p");
    t.className = "teaches";
    t.textContent = g.teaches;

    const versions = document.createElement("div");
    versions.className = "versions";
    for (const v of g.versions) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = v;
      versions.appendChild(badge);
    }

    a.append(h, t, versions);
    return a;
  }),
);
