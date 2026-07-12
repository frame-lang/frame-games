import { Pong } from "./pong.machine.js";
import dot from "./pong.dot?raw";
import { PongScene } from "./PongScene";
import type { GameDef } from "../../../src/game-def";

export const pong: GameDef = {
  id: "pong",
  title: "Pong",
  teaches:
    "The core FSM shape · enter/exit handlers · domain variables · labeled transitions · a pass-through state that re-transitions on entry · the engine-integration pattern",
  controls: "W/S or ↑/↓ move · SPACE serve/replay · P pause",
  dot,
  createMachine: () => Pong._create(),
  Scene: PongScene,
};
