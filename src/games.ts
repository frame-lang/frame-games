// The per-game registry. Each entry wires a manifest JSON (titles, blurbs,
// per-machine FSM metadata, version list) to the runtime bits that can't go
// in JSON: the GameDef from games/<id>/src (createMachine + Phaser Scene +
// the generated .dot). Adding a game is mostly a data change — drop in
// games/<id>/game.json and games/<id>/src/{<id>.fjs,<id>Scene.ts,index.ts}
// and add one entry here pointing at its def.
import { asteroids } from "../games/asteroids/src";
import asteroidsManifest from "../games/asteroids/game.json";
import { pacman } from "../games/pacman/src";
import pacmanManifest from "../games/pacman/game.json";
import { shooter } from "../games/shooter/src";
import shooterManifest from "../games/shooter/game.json";
import { stealth } from "../games/stealth/src";
import stealthManifest from "../games/stealth/game.json";
import { invaders } from "../games/invaders/src";
import invadersManifest from "../games/invaders/game.json";
import type { GameDef } from "./game-def";

export interface MachineMeta {
  system: string;
  title?: string;
  blurb?: string;
}

export interface VersionMeta {
  id: string; // "js" / "godot-gdscript" / "godot-rust" / …
  label: string; // shown in the version drop-down (e.g. "Godot · Rust")
  /** Public path to the version's playable when it's an external bundle (a
   * Godot WASM export). Versions with no `entry` are the in-page JS runtime. */
  entry?: string;
  /** Public path to a build-only artifact used to confirm the bundle actually
   * exists (Vite's SPA fallback serves index.html for any path, so probing the
   * entry itself can lie). Defaults to the entry's sibling `index.pck` (Godot).
   * Non-Godot bundles (e.g. Flame) set this to their own marker, like
   * `.../flutter_bootstrap.js`. */
  probe?: string;
  /** Set false for a version that's planned/wired but whose bundle isn't built
   * yet — kept in the manifest for the record, hidden from the drop-down until
   * its export is verified. Defaults to available (true). */
  available?: boolean;
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
  // GameDef brings the generated .dot + the JS createMachine factory + the
  // Phaser Scene class. Display metadata comes from `manifest`.
  def: GameDef;
  manifest: GameManifest;
}

export const GAMES: Record<string, GameEntry> = {
  asteroids: {
    def: asteroids,
    manifest: asteroidsManifest as GameManifest,
  },
  pacman: {
    def: pacman,
    manifest: pacmanManifest as GameManifest,
  },
  shooter: {
    def: shooter,
    manifest: shooterManifest as GameManifest,
  },
  stealth: {
    def: stealth,
    manifest: stealthManifest as GameManifest,
  },
  invaders: {
    def: invaders,
    manifest: invadersManifest as GameManifest,
  },
};

// Build the BroadcastChannel name for a given game. The game page publishes
// snapshots on this channel; pop-out FSM viewers for the same game listen.
export const channelName = (gameId: string): string => `frame-games:state:${gameId}`;

// Find a version entry by id (e.g. "godot-gdscript"); returns undefined if absent.
export const versionEntry = (manifest: GameManifest, id: string): VersionMeta | undefined =>
  manifest.versions.find((v) => v.id === id);
