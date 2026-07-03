// The Pac-Man cross-language oracle — JS side.
//
// Runs the CANONICAL SCENARIO against the JS baseline machine (the reference
// implementation) and prints one trace line per step. The committed output
// (expected-trace.txt) is the behavioral contract every other language port
// must reproduce byte-for-byte: each port ships a tiny native driver that
// executes the SAME scenario and prints the SAME format, and the build diffs
// the two traces.
//
// The scenario deliberately walks the semantics this game exists to validate:
//   - four independent instances of the parameterized Ghost system
//   - the GhostPen release ladder (2s cadence) staggering those instances
//   - scatter->chase wave scheduling (phase_index-dependent durations)
//   - the push$/pop$ frightened interrupt from BOTH scatter and chase,
//     including what pop$ restores (phase + its timer)
//   - re-frighten while already frightened (re-enter, no double push)
//   - eaten -> (driver-signaled) arrived_at_pen -> in_pen -> re-release
//
// Determinism: the FSM has no randomness; all arithmetic is IEEE-754 double
// (dt = 1/64 exactly representable, so timer sums are exact across languages).
// frighten_seconds_left is printed to 3 decimals.
//
// Usage: node games/pacman/oracle/run-oracle.mjs > games/pacman/oracle/expected-trace.txt
import { GhostGame, Ghost } from "../src/pacman.machine.js";

const DT = 1 / 64; // exactly representable in binary floating point
const g = GhostGame._create();
const names = ["blinky", "pinky", "inky", "clyde"];
const corners = [
  { x: 680, y: 40 },
  { x: 40, y: 40 },
  { x: 680, y: 440 },
  { x: 40, y: 440 },
];

let step = 0;
function snap(label) {
  const gs = [];
  for (let i = 0; i < g.ghost_count(); i++) gs.push(g.ghost_state(i));
  while (gs.length < 4) gs.push("-");
  const flags = [];
  for (let i = 0; i < g.ghost_count(); i++) {
    flags.push(`${g.ghost_is_dangerous(i) ? "D" : "."}${g.ghost_is_edible(i) ? "E" : "."}`);
  }
  while (flags.length < 4) flags.push("--");
  console.log(
    `${String(step).padStart(3, "0")} ${label.padEnd(28)} phase=${g.get_phase().padEnd(10)} ` +
      `fright=${g.frighten_seconds_left().toFixed(3).padStart(7)} score=${String(g.get_score()).padStart(4)} ` +
      `g=[${gs.map((s) => s.padEnd(10)).join(" ")}] f=[${flags.join(" ")}]`,
  );
  step++;
}
function tick(n, label) {
  for (let i = 0; i < n; i++) g.tick(DT);
  snap(`tick x${n} (${label})`);
}

// ---- the canonical scenario ----
snap("created");
for (let i = 0; i < 4; i++) g.add_ghost(Ghost._create(names[i], corners[i], i));
snap("add_ghost x4");
g.start();
snap("start");

tick(64, "1.0s: pen not due");          // release_interval = 2.0
tick(80, "2.25s: 1st release");         // blinky out
tick(128, "4.25s: 2nd release");        // pinky out
tick(128, "6.25s: 3rd release");        // inky out
tick(64, "7.25s: scatter(7s) over");    // -> chase (phase_index 0)

g.power_pellet_picked_up();
snap("pellet during CHASE (push)");
tick(64, "1.0s frightened");
g.ghost_caught(0);
snap("caught blinky (+200)");
g.ghost_caught(0);
snap("caught blinky again (no-op)");
g.ghost_caught(1);
snap("caught pinky (+200)");
tick(64, "2.0s frightened");
g.ghost_arrived_at_pen(0);
snap("blinky arrived at pen");
tick(256, "6.0s: frighten expires");    // pop -> back to CHASE
tick(64, "chase resumed 1.0s");

g.power_pellet_picked_up();
snap("pellet during CHASE #2 (push)");
g.power_pellet_picked_up();
snap("pellet WHILE frightened (re-enter)");
tick(320, "5.0s of re-frighten");
tick(96, "6.5s total: expires again");

// run chase out (20s) -> scatter wave 2 (phase_index 1 -> 5s)
tick(1152, "chase(20s) over -> scatter");
g.power_pellet_picked_up();
snap("pellet during SCATTER (push)");
tick(416, "6.5s: expires -> scatter");
tick(320, "scatter(5s) over -> chase");

snap("final");
