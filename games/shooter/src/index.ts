import { Shooter } from "./shooter.machine.js";
import dot from "./shooter.dot?raw";
import { ShooterScene } from "./ShooterScene";
import type { GameDef } from "../../../src/game-def";

export const shooter: GameDef = {
  id: "shooter",
  title: "Shooter (capstone)",
  teaches:
    "Everything composed at scale · parameterized Enemy instances with a spawn/die lifecycle · three-phase Boss HSM · waves + push$/pop$ pause",
  controls: "Arrows/WASD move · hold SPACE fire · P pause · SPACE start · R restart",
  dot,
  // Shooter takes no host — the scene drives it through the interface and
  // reads the wants_to_fire*/should_spawn* signals back each frame.
  createMachine: () => Shooter._create(),
  Scene: ShooterScene,
};
