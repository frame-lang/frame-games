<?php
// Stealth cross-language oracle — PHP driver. Mirrors Driver.cs / run-oracle.mjs.
require_once "stealth.php";

const DT = 1.0 / 64.0;
$step = 0;
$g = null;

function P($x, $y) { return ["x" => (float)$x, "y" => (float)$y]; }
$FAR = P(500, 500);
$pos1 = $FAR; $pos2 = $FAR; $pos3 = $FAR;

function flags($gd) {
    return ($gd->is_aware() ? "1" : "0") . ($gd->is_alerted() ? "1" : "0") . ($gd->should_move() ? "1" : "0");
}
function gcol($gd) {
    $t = $gd->get_target();
    $x = (int)round($t["x"]);
    $y = (int)round($t["y"]);
    return $gd->get_state() . "/" . flags($gd) . " tgt=(" . $x . "," . $y . ")";
}
function padr($s, $w) { return str_pad($s, max(strlen($s), $w)); }
function padl($s, $w) { return str_pad($s, max(strlen($s), $w), " ", STR_PAD_LEFT); }

function snapOf($m, $label, $tag) {
    global $step;
    $t = padl((string)((int)round($m->get_elapsed() * 64)), 4);
    $by = padl((string)$m->get_caught_by(), 2);
    echo $tag . str_pad((string)$step, 3, "0", STR_PAD_LEFT) . " " . padr($label, 38) .
        " st=" . padr($m->get_state(), 8) .
        " t=" . $t . " by=" . $by . " | " .
        "g1=" . padr(gcol($m->guard1), 28) . " | " .
        "g2=" . padr(gcol($m->guard2), 28) . " | " .
        "g3=" . padr(gcol($m->guard3), 28) . "\n";
    $step++;
}
function snap($label) { global $g; snapOf($g, $label, ""); }
function pump($n) { global $g, $pos1, $pos2, $pos3; for ($i = 0; $i < $n; $i++) $g->tick(DT, $pos1, $pos2, $pos3); }
function run_n($n, $label) { pump($n); snap("pump x{$n} ({$label})"); }

$P1 = [P(0, 0), P(64, 0), P(64, 64)];
$P2 = [P(0, 0), P(96, 0)];
$P3 = [P(0, 0), P(96, 96)];
$pos1 = $FAR; $pos2 = $FAR; $pos3 = $FAR;
$g = Stealth::_create();

snap("created (guards idle)");
$g->start($P1, $P2, $P3);
snap("start -> playing, guards patrol wp0");
echo "OP  get_current_state_name=" . $g->get_current_state_name() . "\n";

run_n(32, "0.5s: nobody arrives (FAR)");

$pos1 = P(1, 1);
run_n(1, "g1 arrives wp0 -> tgt wp1");
$pos1 = P(63, 1);
run_n(1, "g1 arrives wp1 -> tgt wp2");
$pos1 = P(63, 63);
run_n(1, "g1 arrives wp2 -> WRAP tgt wp0");
$pos1 = $FAR;

$g->guard1->hear_sound(P(50, 50));
$g->guard2->hear_sound(P(10, 90));
snap("g1+g2 hear_sound -> investigating");
run_n(95, "1.484s: both still investigating");
run_n(1, "tick 96 = 1.5s: both pop$ -> patrol");

$g->guard3->spot_player(P(80, 80));
snap("g3 spotted (patrolling->alerted)");
$g->guard3->hear_sound(P(5, 5));
snap("g3 hear_sound while alerted: NO-OP");

run_n(200, "3.125s chasing (far, no arrive)");
$g->guard3->spot_player(P(80, 80));
snap("re-spot at 3.125s: chase timer RESET");
run_n(200, "3.125s more: still alerted (reset)");
run_n(56, "chase clock hits 4.0s -> searching");
$pos3 = P(90, 90);
run_n(192, "3.0s search over -> NEAREST wp1");
$pos3 = $FAR;

$g->guard1->hear_sound(P(50, 50));
snap("g1 investigating again (push #2)");
$g->guard1->spot_player(P(30, 30));
snap("spot DURING investigate -> alerted");
$pos1 = P(29, 29);
run_n(1, "g1 arrives last_known -> searching");
$pos1 = P(1, 1);
run_n(192, "3.0s search over -> patrolling");
$g->guard1->hear_sound(P(40, 40));
snap("g1 push #3 (orphan below on stack)");
run_n(96, "1.5s: pop$ is LIFO -> patrolling");
$pos1 = $FAR;

$g->guard2->hear_sound(P(10, 90));
snap("g2 investigating (timer at 0)");
$g->pause();
snap("pause during playing (push)");
run_n(192, "3.0s paused: g2 timer FROZEN");
$g->resume();
snap("resume (pop -> playing)");
run_n(96, "1.5s after resume: g2 pops now");

$g->guard_caught_player(1);
snap("g2 touches player -> caught");

$g->restart();
snap("restart -> attract (counters reset)");

$esc = Stealth::_create();
$esc->start($P1, $P2, $P3);
for ($i = 0; $i < 64; $i++) $esc->tick(DT, $FAR, $FAR, $FAR);
$esc->player_at_exit();
echo "ESC escape path: st=" . $esc->get_state() . " by=" . $esc->get_caught_by() . " t=" . ((int)round($esc->get_elapsed() * 64)) . "\n";

$g->start($P2, $P3, $P1);
snap("Q: start after restart: init DROPPED");

// ---- S-section: save/restore lockstep continuation ----
$step = 0;
$s = Stealth::_create();
$s->start($P1, $P2, $P3);
for ($i = 0; $i < 32; $i++) $s->tick(DT, P(1, 1), $FAR, $FAR);
$s->guard1->hear_sound(P(50, 50));
$s->guard2->spot_player(P(80, 80));
for ($i = 0; $i < 32; $i++) $s->tick(DT, $FAR, $FAR, $FAR);
snapOf($s, "SAVE POINT (push live, alerted, mid)", "S");
$blob = $s->save_state();
$r = Stealth::_create();
$r->restore_state($blob);
snapOf($r, "restored copy, same tick", "S");
$step--;
$ns = [64, 224, 192];
$labels = ["invest pops on both", "chase times out on both", "search resumes patrol on both"];
for ($k = 0; $k < 3; $k++) {
    for ($i = 0; $i < $ns[$k]; $i++) $s->tick(DT, $FAR, $FAR, $FAR);
    for ($i = 0; $i < $ns[$k]; $i++) $r->tick(DT, $FAR, $FAR, $FAR);
    snapOf($s, "orig  +{$ns[$k]} ({$labels[$k]})", "S");
    $step--;
    snapOf($r, "rest  +{$ns[$k]} ({$labels[$k]})", "S");
}
$s->pause();
$blob2 = $s->save_state();
$r2 = Stealth::_create();
$r2->restore_state($blob2);
$r2->resume();
echo "SP  paused save -> restore -> resume: st=" . $r2->get_state() . " t=" . ((int)round($r2->get_elapsed() * 64)) . "\n";
