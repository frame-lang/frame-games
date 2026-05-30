// Shared per-game metadata used by both the game page (game.ts, which mounts
// the playable + live FSM panel) and the pop-out FSM viewer page (fsm-page.ts,
// which renders the same machines but is driven by BroadcastChannel snapshots
// from a separate window). The GameDef from the vendored frame-arcade-js
// submodule supplies the id / title / teaches / controls / dot; this file
// adds the showcase-specific bits (per-machine blurbs, push$/pop$ edges, the
// Godot WASM build path).
import { breakout } from "../vendor/frame-arcade-js/src/games/breakout";
import type { PushPopEdge } from "./fsm-panel";

export interface MachineMeta {
  system: string;
  title?: string;
  blurb?: string;
  pushPop?: readonly PushPopEdge[];
}

export interface GameMeta {
  def: typeof breakout; // brings id, title, teaches, controls, dot, createMachine, Scene
  machines: readonly MachineMeta[];
  godot?: { entry: string };
}

export const GAMES: Record<string, GameMeta> = {
  breakout: {
    def: breakout,
    machines: [
      {
        system: "Breakout",
        title: "Breakout — the orchestrator",
        blurb:
          "The top-level game. It owns a Ball and a BrickField and never lets the driver touch them directly — it routes collision events inward, updates score / lives / level, and decides when a round is cleared or lost. Paused is pushed onto the state stack so resume returns exactly where you left off.",
        pushPop: [{ from: "Playing", to: "Paused", pushEvent: "pause" }],
      },
      {
        system: "Ball",
        title: "Ball",
        blurb:
          "The ball's three modes: attached to the paddle, in flight, or lost off the bottom. Velocity is a state variable that exists only while InFlight — so every launch is a fresh serve with no stale velocity.",
      },
    ],
    godot: { entry: "/games/breakout/versions/godot-wasm/index.html" },
  },
};

// Build the BroadcastChannel name for a given game. The game page publishes
// snapshots on this channel; pop-out FSM viewers for the same game listen.
export const channelName = (gameId: string): string => `frame-games:state:${gameId}`;
