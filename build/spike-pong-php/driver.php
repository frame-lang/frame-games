<?php
require_once "pong.php";
$step = 0;
$g = null;
function bU($x) { return $x ? 1 : 0; }
function padr($s, $w) { $s = (string)$s; return strlen($s) < $w ? $s . str_repeat(" ", $w - strlen($s)) : $s; }
function padl($s, $w) { $s = (string)$s; return strlen($s) < $w ? str_repeat(" ", $w - strlen($s)) . $s : $s; }
function snap($label) {
    global $g, $step;
    printf("%03d %s st=%s sl=%s sr=%s serve=%s play=%d winner=%s\n",
        $step, padr($label, 38), padr($g->get_current_state_name(), 12), padl($g->get_score_left(), 2), padl($g->get_score_right(), 2),
        padl($g->get_serve_direction(), 2), bU($g->is_playing()), padr($g->get_winner(), 6));
    $step++;
}
function point_right($x = null) { global $g; $x = $x ?: $g; $x->launch(); $x->ball_out_left(); }
function point_left($x = null) { global $g; $x = $x ?: $g; $x->launch(); $x->ball_out_right(); }

$g = Pong::_create();
snap("created (AttractMode / 0-0)");
printf("OP  get_current_state_name=%s get_winning_score=%d\n", $g->get_current_state_name(), $g->get_winning_score());

$g->start(); snap("start -> Serving");
$g->pause(); snap("pause during Serving (push)");
$g->resume(); snap("resume (pop -> Serving)");
$g->launch(); snap("launch -> InPlay (playing)");
$g->pause(); snap("pause during InPlay (push)");
$g->resume(); snap("resume (pop -> InPlay)");
$g->ball_out_left(); snap("ball_out_left -> right+1, serve -1");
point_left(); snap("pointLeft -> left+1, serve +1");
for ($i = 0; $i < 9; $i++) point_right();
snap("right at 10 (one short of 11)");
point_right(); snap("right scores 11 -> GameOver [right wins]");
printf("WIN winner=%s playing=%d sl=%d sr=%d\n", $g->get_winner(), bU($g->is_playing()), $g->get_score_left(), $g->get_score_right());
$g->restart(); snap("restart -> AttractMode (reset)");

$g2 = Pong::_create();
$g2->start();
for ($i = 0; $i < 11; $i++) point_left($g2);
printf("MIRROR left win: st=%s winner=%s sl=%d serve=%d\n", $g2->get_current_state_name(), $g2->get_winner(), $g2->get_score_left(), $g2->get_serve_direction());
