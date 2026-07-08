import { Invaders } from "./invaders.machine.js";
import dot from "./invaders.dot?raw";
import { InvadersScene } from "./InvadersScene";
import type { GameDef } from "../../../src/game-def";

export const invaders: GameDef = {
  id: "invaders",
  title: "Space Invaders",
  teaches:
    "Orchestrator-as-HSM · $InGame parent shares handlers across $Playing/$PlayerDying/$WaveComplete via => $^ · a Fleet that marches a formation · push$/pop$ pause",
  controls: "A/D or ←/→ move · hold SPACE fire · P pause · SPACE start · R restart",
  dot,
  createMachine: () => Invaders._create(),
  Scene: InvadersScene,
};
