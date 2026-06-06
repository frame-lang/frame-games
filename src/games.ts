// The per-game registry. Each entry wires a manifest JSON (titles, blurbs,
// per-machine FSM metadata, version list) to the runtime bits that can't go
// in JSON: the vendored GameDef from frame-arcade-js (createMachine + Phaser
// Scene + the generated .dot). Adding a game is mostly a data change — drop
// in games/<id>/game.json and add one entry here pointing at its def.
// Asteroids lives in frame-games proper now (games/asteroids/src) — the
// frame-arcade-js submodule is deprecated. Other games still import from
// vendor until they get the same treatment.
import { asteroids } from "../games/asteroids/src";
import { breakout } from "../vendor/frame-arcade-js/src/games/breakout";
import { pong } from "../vendor/frame-arcade-js/src/games/pong";
import { invaders } from "../vendor/frame-arcade-js/src/games/invaders";
import { pacman } from "../vendor/frame-arcade-js/src/games/pacman";
import { platformer } from "../vendor/frame-arcade-js/src/games/platformer";
import { shooter } from "../vendor/frame-arcade-js/src/games/shooter";
import { stealth } from "../vendor/frame-arcade-js/src/games/stealth";
import breakoutManifest from "../games/breakout/game.json";
import pongManifest from "../games/pong/game.json";
import invadersManifest from "../games/invaders/game.json";
import asteroidsManifest from "../games/asteroids/game.json";
import pacmanManifest from "../games/pacman/game.json";
import platformerManifest from "../games/platformer/game.json";
import shooterManifest from "../games/shooter/game.json";
import stealthManifest from "../games/stealth/game.json";
import type { GameDef } from "./game-def";

export interface MachineMeta {
  system: string;
  title?: string;
  blurb?: string;
}

export interface VersionMeta {
  id: string; // "js" / "godot-wasm" / …
  label: string;
  entry?: string; // public path to the version's playable, when external
}

/**
 * One on-screen control rendered on touch devices in place of the
 * (keyboard-only) controls text. `key` is a KeyboardEvent.code; the mobile
 * mount turns presses into synthetic keydown/keyup events so the existing
 * scene input code works unchanged. `hold: true` is press-and-hold (turn,
 * thrust); `hold: false` is a one-shot tap (fire, pause, restart).
 */
export interface MobileButton {
  label: string;
  key: string;
  hold: boolean;
  /** Where the button mounts on the touch layout — defaults to "bottom"
   * (the horizontal bar under the canvas). "left" / "right" mount into
   * the side columns that flank the canvas on phones (D-pad style). */
  position?: "left" | "right" | "bottom";
}

export interface GameManifest {
  id: string;
  title: string;
  summary: string; // index-card description
  teaches: string; // game-page header tagline
  controls: string;
  machines: readonly MachineMeta[];
  versions: readonly VersionMeta[];
  /** Optional per-game touch-device control bar. Omit to leave mobile users
   * with the keyboard-only instruction text (i.e., not yet adapted). */
  mobileButtons?: readonly MobileButton[];
}

export interface GameEntry {
  // The vendored GameDef brings the generated .dot + the JS createMachine
  // factory + the Phaser Scene class. Display metadata comes from `manifest`.
  def: GameDef;
  manifest: GameManifest;
}

export const GAMES: Record<string, GameEntry> = {
  breakout: {
    def: breakout,
    manifest: breakoutManifest as GameManifest,
  },
  pong: {
    def: pong,
    manifest: pongManifest as GameManifest,
  },
  invaders: {
    def: invaders,
    manifest: invadersManifest as GameManifest,
  },
  asteroids: {
    def: asteroids,
    manifest: asteroidsManifest as GameManifest,
  },
  pacman: {
    def: pacman,
    manifest: pacmanManifest as GameManifest,
  },
  platformer: {
    def: platformer,
    manifest: platformerManifest as GameManifest,
  },
  shooter: {
    def: shooter,
    manifest: shooterManifest as GameManifest,
  },
  stealth: {
    def: stealth,
    manifest: stealthManifest as GameManifest,
  },
};

// Build the BroadcastChannel name for a given game. The game page publishes
// snapshots on this channel; pop-out FSM viewers for the same game listen.
export const channelName = (gameId: string): string => `frame-games:state:${gameId}`;

// Find a version entry by id (e.g. "godot-wasm"); returns undefined if absent.
export const versionEntry = (manifest: GameManifest, id: string): VersionMeta | undefined =>
  manifest.versions.find((v) => v.id === id);
