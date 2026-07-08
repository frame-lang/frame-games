<?php
require_once "breakout.php";
const DT = 1.0 / 64.0;
$step = 0;
$g = null;
function mU($x) { return (int)round($x * 1000); }
function padr($s, $w) { $s = (string)$s; return strlen($s) < $w ? $s . str_repeat(" ", $w - strlen($s)) : $s; }
function padl($s, $w) { $s = (string)$s; return strlen($s) < $w ? str_repeat(" ", $w - strlen($s)) . $s : $s; }
function snap($label) {
    global $g, $step;
    $rp = $g->get_state() == "playing" ? padl(mU($g->ball_respawn_progress()), 4) : padl("-", 4);
    printf("%03d %s st=%s sc=%s lv=%d lvl=%d br=%s | ball=%s vx=%s vy=%s rp=%s\n",
        $step, padr($label, 34), padr($g->get_state(), 11), padl($g->get_score(), 4), $g->get_lives(), $g->get_level(),
        padl($g->bricks_remaining(), 2), padr($g->ball_state(), 9), padl(mU($g->ball_vx()), 6), padl(mU($g->ball_vy()), 6), $rp);
    $step++;
}
function run($n, $label) { global $g; for ($i = 0; $i < $n; $i++) $g->tick(DT); snap("pump x$n ($label)"); }

$g = Breakout::_create();
snap("created");
$g->start();
snap("start -> playing, ball attached");
printf("OP  get_current_state_name=%s\n", $g->get_current_state_name());
$g->launch_ball(3.5, -4.25);
snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]");
$g->wall_bounce_x();
snap("wall_bounce_x -> vx negated");
$g->wall_bounce_y();
snap("wall_bounce_y -> vy negated");
$g->paddle_hit(2.75, -5.5);
snap("paddle_hit -> set_velocity(2.75,-5.5)");
$g->brick_hit(0);
snap("brick_hit(0): +10, vy flip, broken");
$g->brick_hit(0); $g->brick_hit(999); $g->brick_hit(-1);
snap("brick_hit dead/oob: NO score change");
$g->brick_hit(1); $g->brick_hit(2);
snap("brick_hit(1,2): +20");
$g->pause();
snap("pause during PLAYING (push)");
run(64, "1.0s paused: ball frozen");
$g->resume();
snap("resume (pop -> playing)");
$g->ball_fell_off();
snap("ball_fell_off -> lives-1, ball lost");
run(64, "1.0s: respawn progress ~0.5");
run(63, "just before 2.0s: still lost");
run(1, "tick 2.0s: ball -> attached");
$g->launch_ball(3.5, -4.25);
snap("re-launch (fresh in_flight)");
for ($i = 3; $i < 40; $i++) $g->brick_hit($i);
snap("cleared wall -> level_clear (lvl 2)");
$g->start();
snap("start -> playing, fresh wall of 40");
$g->ball_fell_off();
snap("fell off -> lives 1");
$g->ball_fell_off();
snap("fell off -> lives 0 -> game_over");
$g->restart();
snap("restart -> attract (reset)");

$g2 = Breakout::_create();
$g2->start();
$g2->launch_ball(1.0, -1.0);
$g2->ball_fell_off();
for ($i = 0; $i < 32; $i++) $g2->tick(DT);
$rp_before = (int)round($g2->ball_respawn_progress() * 1000);
$g2->pause();
for ($i = 0; $i < 128; $i++) $g2->tick(DT);
$g2->resume();
$rp_after = (int)round($g2->ball_respawn_progress() * 1000);
printf("PAUSE respawn frozen: before=%d after=%d ball=%s (paused ticks must not advance the ball)\n", $rp_before, $rp_after, $g2->ball_state());

$g3 = Breakout::_create();
$g3->start();
printf("BRICK is_broken: fresh0=%s oobNeg=%s oobBig=%s (expect false, true, true)\n",
    $g3->is_brick_broken(0) ? "true" : "false", $g3->is_brick_broken(-1) ? "true" : "false", $g3->is_brick_broken(999) ? "true" : "false");
