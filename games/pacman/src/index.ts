import { GhostGame } from "./pacman.machine.js";
import dot from "./pacman.dot?raw";
import { PacmanScene } from "./PacmanScene";
import type { GameDef } from "../../../src/game-def";

export const pacman: GameDef = {
  id: "pacman",
  title: "Pac-Man (Ghost AI)",
  teaches:
    "Parameterized multi-instance systems · $OutOfPen HSM parent · push$/pop$ frightened that resumes the interrupted phase",
  controls: "Arrows/WASD move · power pellets frighten ghosts · SPACE start · P pause · R refill",
  dot,
  // GhostGame takes no host — the scene drives it through the interface and
  // reads ghost state back per-frame (steering/render stay scene-side).
  createMachine: () => GhostGame._create(),
  Scene: PacmanScene,
};
