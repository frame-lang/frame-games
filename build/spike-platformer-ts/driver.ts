// The Platformer cross-language oracle — JS side.
//
// Same contract as the other games' oracles: a canonical scenario against the
// JS baseline, one line per step; the committed output (expected-trace.txt) is
// the byte-exact behavioral contract for every other language port. dt = 1/64.
//
// What this scenario exercises that the earlier six games couldn't:
//   - ORTHOGONAL-STATE COMPOSITION. The orchestrator (Platformer) owns TWO
//     independent sibling sub-machines — Locomotion (how you move) and PowerUp
//     (what form you are) — and forwards every interface call to whichever
//     child. No single combined HSM; two additive FSMs. First game with two
//     peer children driven in parallel through one facade.
//   - A CHILD INTERFACE CALL AS THE RETURN EXPRESSION:
//     take_damage(): bool { @@:(this.power.take_damage()) } — the orchestrator's
//     return value IS the child's return value, marshalled back out.
//   - RETURN-VALUE-THEN-TRANSITION in the child (#179 shape):
//     $Big.take_damage(): bool { @@:(true) -> $Small } — sets the return slot,
//     then transitions. Regression coverage for the Rust-only #179.
//   - State-local vars driving TIMED transitions observed only by their effect:
//     $Jumping.jump_held_time (auto-fall at 0.35s unless release_jump freezes
//     it) and $Landing.timer (0.08s recovery). Plus the $Landing $>() enter
//     handler. push$/pop$ pause on the orchestrator freezes the whole rig.
//
// wants_velocity_x() is a float; printed as a scaled INTEGER (x1000) so no
// float formatting crosses the language boundary. Bools are printed 1/0.
// Every query below (locomotion_state/form/wants_velocity_x/wants_jump_impulse/
// facing/is_grounded/is_in_air/hit_box_height/can_shoot/is_paused) is handled
// in BOTH $Playing and $Paused, so no unhandled-default divergence.
//
// Usage: node games/platformer/oracle/run-oracle.mjs > games/platformer/oracle/expected-trace.txt
import { Platformer } from "./platformer";

const DT = 1 / 64;
let step = 0;
const g = Platformer._create();

const m = (x) => Math.round(x * 1000); // float -> milliunits integer
const b = (x) => (x ? 1 : 0); // bool -> 1/0 (language-agnostic)
function pad(s, w) { s = String(s); while (s.length < w) s += " "; return s; }
function lpad(s, w) { s = String(s); while (s.length < w) s = " " + s; return s; }
function snap(label) {
  console.log(
    `${String(step).padStart(3, "0")} ${pad(label, 40)} ` +
      `st=${pad(g.get_current_state_name(), 7)} loco=${pad(g.locomotion_state(), 8)} form=${pad(g.form(), 5)} ` +
      `vx=${lpad(m(g.wants_velocity_x()), 7)} face=${lpad(g.facing(), 2)} ` +
      `gnd=${b(g.is_grounded())} air=${b(g.is_in_air())} jimp=${b(g.wants_jump_impulse())} ` +
      `hbox=${lpad(g.hit_box_height(), 2)} shoot=${b(g.can_shoot())} paused=${b(g.is_paused())}`,
  );
  step++;
}
function run(n, label) {
  for (let i = 0; i < n; i++) g.tick(DT);
  snap(`pump x${n} (${label})`);
}

// ---- the canonical scenario ----
snap("created (Playing / idle / small)");
console.log(`OP  get_current_state_name=${g.get_current_state_name()}`);

// --- LOCOMOTION: Idle -> Walking -> Running and back ---
g.press_right();
snap("press_right -> walking, face+1");
g.press_sprint();
snap("press_sprint -> running (vx 260)");
g.release_sprint();
snap("release_sprint -> walking (vx 140)");
g.press_left();
snap("press_left -> face-1, vx -140");
g.release_horizontal();
snap("release_horizontal -> idle");

// --- JUMP (held): jump-impulse handshake + auto-fall at 0.35s ---
g.press_jump();
snap("press_jump -> jumping, jimp=1");
g.consume_jump_impulse();
snap("consume_jump_impulse -> jimp=0");
g.press_right();
snap("press_right in air -> vx 180 (air_speed)");
run(22, "0.34s held: still jumping");
run(1, "tick 23 (0.35s) -> falling");

// --- LAND: ground_contact -> landing (enter clears pending_jump), 0.08s recover ---
g.ground_contact();
snap("ground_contact -> landing");
run(5, "0.078s: still landing");
run(1, "tick 6 (0.08s): input_x!=0 -> walking");
g.release_horizontal();
snap("release_horizontal -> idle");

// --- JUMP (released early): release_jump freezes the timer -> no auto-fall ---
g.press_jump();
snap("press_jump -> jumping (fresh)");
g.release_jump();
snap("release_jump -> timer frozen");
run(40, "0.625s released: STILL jumping (no auto-fall)");
g.ground_contact();
snap("ground_contact -> landing (input_x=0)");
run(6, "0.08s: input_x==0 -> idle");

// --- walk off a ledge: left_ground -> falling (no jump) ---
g.left_ground();
snap("left_ground -> falling (walked off)");
g.ground_contact();
snap("ground_contact -> landing");
run(6, "recover -> idle");

// --- POWERUP thread (orthogonal to locomotion) ---
g.pickup_mushroom();
snap("pickup_mushroom -> big (hbox 48)");
g.pickup_flower();
snap("pickup_flower -> fiery (can_shoot 1)");
g.take_damage();
snap("take_damage -> big [ret-then-transition]");
g.take_damage();
snap("take_damage -> small (hbox 24)");
g.take_damage();
snap("take_damage in small -> no transition");
g.pickup_flower();
snap("pickup_flower from small -> fiery");

// --- take_damage RETURN VALUE marshalled out through the orchestrator ---
console.log(`RET take_damage(fiery)=${b(g.take_damage())} form_now=${g.form()} (expect 1 / big)`);
console.log(`RET take_damage(big)=${b(g.take_damage())} form_now=${g.form()} (expect 1 / small)`);
console.log(`RET take_damage(small)=${b(g.take_damage())} form_now=${g.form()} (expect 0 / small)`);

// --- PAUSE push$/pop$ freezes the whole rig ---
g.pickup_mushroom();
g.press_right();
snap("re-arm: big + walking before pause");
g.pause();
snap("pause -> Paused (push), paused=1");
run(64, "1.0s paused: locomotion frozen");
g.resume();
snap("resume -> Playing (pop), paused=0");

// --- secondary: orthogonality — powerup changes do not touch locomotion ---
const g2 = Platformer._create();
g2.press_right();
g2.press_sprint(); // running
const loco_before = g2.locomotion_state();
g2.pickup_mushroom();
g2.pickup_flower(); // fiery
const loco_after = g2.locomotion_state();
console.log(`ORTHO loco stable across powerups: before=${loco_before} after=${loco_after} form=${g2.form()} (expect running/running/fiery)`);

// --- secondary: pause drops ticks (jump timer must not advance while paused) ---
const g3 = Platformer._create();
g3.press_jump(); // jumping, held
for (let i = 0; i < 10; i++) g3.tick(DT); // 0.156s accumulated, still jumping
g3.pause();
for (let i = 0; i < 128; i++) g3.tick(DT); // paused: no tick handler -> dropped
g3.resume();
const loco_resumed = g3.locomotion_state();
for (let i = 0; i < 12; i++) g3.tick(DT); // 10+12=22 <23 still jumping if paused ticks were dropped
const still_jumping = g3.locomotion_state();
g3.tick(DT); // tick 23 total -> falling
const now_falling = g3.locomotion_state();
console.log(`PAUSE ticks dropped: resumed=${loco_resumed} at22=${still_jumping} at23=${now_falling} (expect jumping/jumping/falling)`);
