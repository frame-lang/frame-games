// The Pong cross-language oracle — JS side.
//
// Same contract as the other games' oracles: a canonical scenario against the
// JS baseline, one line per step; the committed output (expected-trace.txt) is
// the byte-exact behavioral contract for every other language port.
//
// What this scenario exercises that the earlier seven games didn't:
//   - LABELED TRANSITIONS: $PointScored's enter handler fires
//     `-> "left wins" $GameOver` / `-> "next point" $Serving` — the transition
//     carries a string label (diagram/debug annotation). First game to use it.
//   - A TRANSITION FROM AN ENTER HANDLER: $PointScored is a pass-through state
//     whose $>() immediately re-transitions based on the domain (serve flip +
//     win check via an if / else-if / else chain). The machine advances two
//     compartments on one event (InPlay -> PointScored -> Serving/GameOver).
//   - Two operations, one reading the domain (get_winning_score).
//
// All scores/directions are integers; is_playing is 1/0; winner is a padded
// string. Every query (score_left/right, serve_direction, is_playing, winner)
// is handled in EVERY state, so no unhandled-default divergence.
//
// Usage: node games/pong/oracle/run-oracle.mjs > games/pong/oracle/expected-trace.txt
import { Pong } from "./pong";

let step = 0;
const g = Pong._create();

const b = (x) => (x ? 1 : 0);
function pad(s, w) { s = String(s); while (s.length < w) s += " "; return s; }
function lpad(s, w) { s = String(s); while (s.length < w) s = " " + s; return s; }
function snap(label) {
  console.log(
    `${String(step).padStart(3, "0")} ${pad(label, 38)} ` +
      `st=${pad(g.get_current_state_name(), 12)} sl=${lpad(g.get_score_left(), 2)} sr=${lpad(g.get_score_right(), 2)} ` +
      `serve=${lpad(g.get_serve_direction(), 2)} play=${b(g.is_playing())} winner=${pad(g.get_winner(), 6)}`,
  );
  step++;
}
// score for the right player: launch, then ball off the left edge.
function pointRight() { g.launch(); g.ball_out_left(); }
// score for the left player: launch, then ball off the right edge.
function pointLeft() { g.launch(); g.ball_out_right(); }

// ---- the canonical scenario ----
snap("created (AttractMode / 0-0)");
console.log(`OP  get_current_state_name=${g.get_current_state_name()} get_winning_score=${g.get_winning_score()}`);

g.start();
snap("start -> Serving");

// pause/resume from $Serving (push -> Paused -> pop back to Serving)
g.pause();
snap("pause during Serving (push)");
g.resume();
snap("resume (pop -> Serving)");

g.launch();
snap("launch -> InPlay (playing)");

// pause/resume from $InPlay
g.pause();
snap("pause during InPlay (push)");
g.resume();
snap("resume (pop -> InPlay)");

// right scores: InPlay -> PointScored -> Serving [next point], serve flips -1
g.ball_out_left();
snap("ball_out_left -> right+1, serve -1");

// left scores: -> Serving [next point], serve flips +1
pointLeft();
snap("pointLeft -> left+1, serve +1");

// drive right to the winning score (11): currently sr=1, need 10 more
for (let i = 0; i < 9; i++) pointRight();
snap("right at 10 (one short of 11)");
pointRight();
snap("right scores 11 -> GameOver [right wins]");
console.log(`WIN winner=${g.get_winner()} playing=${b(g.is_playing())} sl=${g.get_score_left()} sr=${g.get_score_right()}`);

// restart resets via $AttractMode $>()
g.restart();
snap("restart -> AttractMode (reset)");

// --- secondary: a left-side win from a clean game (serve/win-branch mirror) ---
const g2 = Pong._create();
g2.start();
for (let i = 0; i < 11; i++) pointLeftOn(g2);
console.log(`MIRROR left win: st=${g2.get_current_state_name()} winner=${g2.get_winner()} sl=${g2.get_score_left()} serve=${g2.get_serve_direction()}`);

function pointLeftOn(x) { x.launch(); x.ball_out_right(); }
