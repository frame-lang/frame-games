// The Stealth cross-language oracle — JS side.
//
// Same contract as games/pacman/oracle and games/shooter/oracle: runs a
// canonical scenario against the JS baseline and prints one line per step;
// the committed output (expected-trace.txt) is the byte-exact behavioral
// contract for every other language port. dt = 1/64 keeps timer math
// bit-identical across languages. Times print as integer TICKS (elapsed*64)
// so no float formatting crosses the language boundary.
//
// What this scenario exercises that Shooter couldn't:
//   - The $Aware HSM FAN: $Patrolling/$Investigating/$Alerted/$Searching are
//     four siblings under one parent that owns the shared spot_player and
//     touched_player responses — the same perception escalates identically
//     from any of them.
//   - push$/pop$ as an interruptible subroutine: hear_sound pushes the live
//     $Patrolling compartment and enters $Investigating; the pop$ 1.5s later
//     must resume the EXACT interrupted compartment (patrol cursor intact).
//   - The ORPHANED-COMPARTMENT path: spot_player during $Investigating is
//     answered by the $Aware parent (-> $Alerted), abandoning the pushed
//     compartment on the stack; the later $Searching -> $Patrolling exit is a
//     plain transition, so that stack entry is never popped. Canonical: the
//     machine must keep working (and a later hear_sound/pop$ cycle must pop
//     the NEW compartment, LIFO) — mirrors the Godot ch08 reference.
//   - @@[persist]/@@[save]/@@[load]: save_state() mid-game — WITH a pushed
//     compartment live on one guard and another guard alerted — then
//     restore_state() into a fresh instance and run original + restored in
//     lockstep. Their lines must be byte-identical (S-section). The blob
//     itself is per-language and never printed.
//
// Usage: node games/stealth/oracle/run-oracle.mjs > games/stealth/oracle/expected-trace.txt
import { Stealth } from "../src/stealth.machine.js";

const DT = 1 / 64;
const P = (x, y) => ({ x, y });
let step = 0;

// Fixed patrol routes (driver-owned geometry, but part of the contract):
//   g1: triangle (0,0) -> (64,0) -> (64,64)
//   g2: out-and-back (0,0) -> (96,0)
//   g3: diagonal (0,0) -> (96,96)
const P1 = [P(0, 0), P(64, 0), P(64, 64)];
const P2 = [P(0, 0), P(96, 0)];
const P3 = [P(0, 0), P(96, 96)];

// Guard positions the driver reports each tick. FAR keeps a guard away from
// every waypoint/last-known so nothing arrives by accident.
const FAR = P(500, 500);
let pos1 = FAR, pos2 = FAR, pos3 = FAR;

const g = Stealth._create();

function flags(gd) {
  return `${gd.is_aware() ? 1 : 0}${gd.is_alerted() ? 1 : 0}${gd.should_move() ? 1 : 0}`;
}
function gcol(gd) {
  const t = gd.get_target();
  return `${gd.get_state()}/${flags(gd)} tgt=(${Math.round(t.x)},${Math.round(t.y)})`;
}
function snapOf(m, label, tag) {
  console.log(
    `${tag}${String(step).padStart(3, "0")} ${label.padEnd(38)} st=${m.get_state().padEnd(8)} ` +
      `t=${String(Math.round(m.get_elapsed() * 64)).padStart(4)} by=${String(m.get_caught_by()).padStart(2)} | ` +
      `g1=${gcol(m.guard1).padEnd(28)} | g2=${gcol(m.guard2).padEnd(28)} | g3=${gcol(m.guard3).padEnd(28)}`,
  );
  step++;
}
const snap = (label) => snapOf(g, label, "");
function pump(n) {
  for (let i = 0; i < n; i++) g.tick(DT, pos1, pos2, pos3);
}
function run(n, label) {
  pump(n);
  snap(`pump x${n} (${label})`);
}

// ---- the canonical scenario ----
snap("created (guards idle)");
g.start(P1, P2, P3);
snap("start -> playing, guards patrol wp0");
console.log(`OP  get_current_state_name=${g.get_current_state_name()}`);

run(32, "0.5s: nobody arrives (FAR)");

// waypoint advance + wrap on g1 (arrivals are position-driven)
pos1 = P(1, 1);                      // within ARRIVAL_RADIUS of wp0
run(1, "g1 arrives wp0 -> tgt wp1");
pos1 = P(63, 1);
run(1, "g1 arrives wp1 -> tgt wp2");
pos1 = P(63, 63);
run(1, "g1 arrives wp2 -> WRAP tgt wp0");
pos1 = FAR;

// push$/pop$ investigate on TWO guards at once
g.guard1.hear_sound(P(50, 50));
g.guard2.hear_sound(P(10, 90));
snap("g1+g2 hear_sound -> investigating");
run(95, "1.484s: both still investigating");
run(1, "tick 96 = 1.5s: both pop$ -> patrol");

// hear_sound outside $Patrolling is unhandled (only $Patrolling pushes)
g.guard3.spot_player(P(80, 80));
snap("g3 spotted (patrolling->alerted)");
g.guard3.hear_sound(P(5, 5));
snap("g3 hear_sound while alerted: NO-OP");

// alerted chase: re-spot resets the chase timer
run(200, "3.125s chasing (far, no arrive)");
g.guard3.spot_player(P(80, 80));
snap("re-spot at 3.125s: chase timer RESET");
run(200, "3.125s more: still alerted (reset)");
run(56, "chase clock hits 4.0s -> searching");
pos3 = P(90, 90);                    // nearest patrol wp is (96,96), index 1
run(192, "3.0s search over -> NEAREST wp1");
pos3 = FAR;

// interrupted investigation: parent $Aware answers spot_player, the pushed
// compartment is ORPHANED; guard keeps working, later push/pop is LIFO-clean
g.guard1.hear_sound(P(50, 50));
snap("g1 investigating again (push #2)");
g.guard1.spot_player(P(30, 30));
snap("spot DURING investigate -> alerted");
pos1 = P(29, 29);                    // arrive at last_known -> searching
run(1, "g1 arrives last_known -> searching");
pos1 = P(1, 1);                      // nearest wp for resume = wp0
run(192, "3.0s search over -> patrolling");
g.guard1.hear_sound(P(40, 40));
snap("g1 push #3 (orphan below on stack)");
run(96, "1.5s: pop$ is LIFO -> patrolling");
pos1 = FAR;

// game-level pause is push$/pop$ and freezes every guard's timers
g.guard2.hear_sound(P(10, 90));
snap("g2 investigating (timer at 0)");
g.pause();
snap("pause during playing (push)");
run(192, "3.0s paused: g2 timer FROZEN");
g.resume();
snap("resume (pop -> playing)");
run(96, "1.5s after resume: g2 pops now");

// touched_player via the $Aware parent from a leaf; game -> caught
g.guard_caught_player(1);
snap("g2 touches player -> caught");

// restart, then the pinned re-init quirk (Q-section below)
g.restart();
snap("restart -> attract (counters reset)");

// escape path on a fresh run
const esc = Stealth._create();
esc.start(P1, P2, P3);
for (let i = 0; i < 64; i++) esc.tick(DT, FAR, FAR, FAR);
esc.player_at_exit();
console.log(`ESC escape path: st=${esc.get_state()} by=${esc.get_caught_by()} t=${Math.round(esc.get_elapsed() * 64)}`);

// --- pinned quirk: init() is only handled in $Idle ---
// After restart -> start(), guards are NOT in $Idle (g2 is $Engaged, g1/g3
// kept patrolling), so the re-init is silently dropped: g2 stays engaged
// forever and g1/g3 keep their OLD patrol arrays/cursors. Canonical — the
// Godot ch08 reference behaves identically; the scene works around it by
// recreating the machine on restart.
g.start(P2, P3, P1);
snap("Q: start after restart: init DROPPED");

// ---- S-section: save/restore lockstep continuation ----
// Save at maximum awkwardness: s1 has a pushed compartment (investigating),
// s2 is alerted, s3 mid-patrol toward wp1. Restore into a fresh instance and
// drive both with identical inputs; every paired line must match.
step = 0;
const s = Stealth._create();
s.start(P1, P2, P3);
for (let i = 0; i < 32; i++) s.tick(DT, P(1, 1), FAR, FAR); // s1 arrives wp0 en route
s.guard1.hear_sound(P(50, 50));
s.guard2.spot_player(P(80, 80));
for (let i = 0; i < 32; i++) s.tick(DT, FAR, FAR, FAR);
snapOf(s, "SAVE POINT (push live, alerted, mid)", "S");
const blob = s.save_state();
const r = Stealth._create();
r.restore_state(blob);
snapOf(r, "restored copy, same tick", "S");
step--; // paired lines share a step number: diff enforces equality
for (const [n, label] of [[64, "invest pops on both"], [224, "chase times out on both"], [192, "search resumes patrol on both"]]) {
  for (let i = 0; i < n; i++) s.tick(DT, FAR, FAR, FAR);
  for (let i = 0; i < n; i++) r.tick(DT, FAR, FAR, FAR);
  snapOf(s, `orig  +${n} (${label})`, "S");
  step--;
  snapOf(r, `rest  +${n} (${label})`, "S");
}
// pause survives a save/restore round-trip (game-level pushed compartment)
s.pause();
const blob2 = s.save_state();
const r2 = Stealth._create();
r2.restore_state(blob2);
r2.resume();
console.log(`SP  paused save -> restore -> resume: st=${r2.get_state()} t=${Math.round(r2.get_elapsed() * 64)}`);
