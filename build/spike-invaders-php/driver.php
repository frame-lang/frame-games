<?php
require_once "invaders.php";

const DT = 1.0 / 64.0;
$step = 0;
$g = null;

function ivus() { global $g; return (int)round($g->fleet->get_step_interval() * 1e6); }
function padr($s, $w) { $s = (string)$s; return strlen($s) < $w ? $s . str_repeat(" ", $w - strlen($s)) : $s; }
function padl($s, $w) { $s = (string)$s; return strlen($s) < $w ? str_repeat(" ", $w - strlen($s)) . $s : $s; }
function snap($label) {
    global $g, $step;
    $fl = $g->fleet;
    printf("%03d %s st=%s sc=%s wv=%d lv=%d | fl=%s dir=%s al=%s/%s iv=%s lr=%s | pl=%s pz=%d\n",
        $step, padr($label, 34), padr($g->get_state(), 13), padl($g->get_score(), 4), $g->get_wave(), $g->get_lives(),
        padr($fl->get_state(), 9), padl($fl->get_direction(), 2), padl($fl->alive_count(), 2), padl($fl->total(), 2),
        padl(ivus(), 6), padl($fl->lowest_row(), 2), padr($g->player->get_state(), 12), $g->is_paused() ? 1 : 0);
    $step++;
}
function run($n, $label) { global $g; for ($i = 0; $i < $n; $i++) $g->tick(DT); snap("pump x$n ($label)"); }

$g = Invaders::_create();
snap("created");
$g->start();
snap("start -> playing (fleet 55, iv=600000)");
printf("OP  get_current_state_name=%s\n", $g->get_current_state_name());

run(39, "0.61s: fleet wants_to_step");
printf("SIG consume_step=%s (timer was >= interval)\n", $g->fleet->consume_step() ? "true" : "false");

$g->player_killed_invader(0);
snap("kill idx0 (+10, pace up)");
$g->player_killed_invader(1);
$g->player_killed_invader(2);
snap("kill idx1,2 (+20 more)");
$g->player_killed_invader(1);
$g->player_killed_invader(999);
$g->player_killed_invader(-1);
snap("kill dead/oob idx: NO score change");

$g->fleet_reached_edge();
snap("fleet_reached_edge -> stepping, dir flip");
run(1, "one tick: stepping -> marching");

$g->pause();
snap("pause during PLAYING (push)");
run(64, "1.0s paused: fleet+player frozen");
$g->resume();
snap("resume (pop -> playing)");

for ($i = 3; $i < 55; $i++) $g->player_killed_invader($i);
snap("cleared fleet -> wave_complete");

$g->pause();
snap("pause during WAVE_COMPLETE (push)");
run(64, "1.0s paused: wave timer frozen");
$g->resume();
snap("resume (pop -> wave_complete)");

run(129, "2.0s: wave 2 begins, fleet reset");

$g->player_hit();
snap("player_hit -> player_dying");
$g->player_hit();
snap("player_hit while exploding: NO-OP");

$g->pause();
snap("pause during PLAYER_DYING (push)");
run(64, "1.0s paused: explosion timer frozen");
$g->resume();
snap("resume (pop -> player_dying)");

run(77, "1.2s: lives-1, invuln, -> playing");
run(96, "1.5s: invuln over -> alive");

$g->fleet_reached_bottom();
snap("fleet_reached_bottom -> game_over");
$g->restart();
snap("restart -> attract (reset)");

$g2 = Invaders::_create();
$g2->start();
for ($life = 0; $life < 3; $life++) { $g2->player_hit(); for ($i = 0; $i < 180; $i++) $g2->tick(DT); }
printf("DEATH after 3 hits: st=%s lives=%d player=%s\n", $g2->get_state(), $g2->get_lives(), $g2->player->get_state());

$g3 = Invaders::_create();
$g3->start();
$d0 = $g3->fleet->get_direction();
$g3->fleet_reached_edge(); $g3->tick(DT);
$d1 = $g3->fleet->get_direction();
$g3->fleet_reached_edge(); $g3->tick(DT);
$d2 = $g3->fleet->get_direction();
printf("DIR bounces: start=%d after1=%d after2=%d\n", $d0, $d1, $d2);
