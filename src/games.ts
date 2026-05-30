// The per-game registry. Each entry wires a manifest JSON (titles, blurbs,
// per-machine FSM metadata, version list) to the runtime bits that can't go
// in JSON: the vendored GameDef from frame-arcade-js (createMachine + Phaser
// Scene + the generated .dot). Adding a game is mostly a data change — drop
// in games/<id>/game.json and add one entry here pointing at its def.
import { breakout } from "../vendor/frame-arcade-js/src/games/breakout";
import breakoutManifest from "../games/breakout/game.json";
import type { PushPopEdge } from "./fsm-panel";

export interface MachineMeta {
  system: string;
  title?: string;
  blurb?: string;
  pushPop?: readonly PushPopEdge[];
}

export interface VersionMeta {
  id: string; // "js" / "godot-wasm" / …
  label: string;
  entry?: string; // public path to the version's playable, when external
}

export interface GameManifest {
  id: string;
  title: string;
  summary: string; // index-card description
  teaches: string; // game-page header tagline
  controls: string;
  machines: readonly MachineMeta[];
  versions: readonly VersionMeta[];
}

export interface GameEntry {
  // The vendored GameDef brings the generated .dot + the JS createMachine
  // factory + the Phaser Scene class. Display metadata comes from `manifest`.
  def: typeof breakout;
  manifest: GameManifest;
}

export const GAMES: Record<string, GameEntry> = {
  breakout: {
    def: breakout,
    manifest: breakoutManifest as GameManifest,
  },
};

// Build the BroadcastChannel name for a given game. The game page publishes
// snapshots on this channel; pop-out FSM viewers for the same game listen.
export const channelName = (gameId: string): string => `frame-games:state:${gameId}`;

// Find a version entry by id (e.g. "godot-wasm"); returns undefined if absent.
export const versionEntry = (manifest: GameManifest, id: string): VersionMeta | undefined =>
  manifest.versions.find((v) => v.id === id);
