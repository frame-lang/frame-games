import { Breakout } from "./breakout.machine.js";
import dot from "./breakout.dot?raw";
import { BreakoutScene } from "./BreakoutScene";
import type { GameDef } from "../../../src/game-def";

export const breakout: GameDef = {
  id: "breakout",
  title: "Breakout",
  teaches:
    "Enter-arguments threaded through a transition (-> (vx, vy) $InFlight) into a state's $>(params) · a Ball sub-machine · a BrickField · push$/pop$ pause",
  controls: "A/D or ←/→ move paddle · SPACE launch/start · P pause · R restart",
  dot,
  createMachine: () => Breakout._create(),
  Scene: BreakoutScene,
};
