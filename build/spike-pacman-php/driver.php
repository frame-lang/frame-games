<?php
// Pac-Man cross-language oracle — PHP driver. Mirrors run-oracle.mjs
// step-for-step; output must byte-match expected-trace.txt.
require_once "pacman.php";

const DT = 1.0 / 64.0;
$g = GhostGame::_create();
$step = 0;
$names = ["blinky", "pinky", "inky", "clyde"];
$corners = [["x" => 680, "y" => 40], ["x" => 40, "y" => 40], ["x" => 680, "y" => 440], ["x" => 40, "y" => 440]];

function pad($s, $w) { return str_pad($s, max(strlen($s), $w)); }

function snap($label) {
    global $g, $step;
    $gs = ["-", "-", "-", "-"];
    $flags = ["--", "--", "--", "--"];
    $n = $g->ghost_count();
    for ($i = 0; $i < $n; $i++) {
        $gs[$i] = $g->ghost_state($i);
        $flags[$i] = ($g->ghost_is_dangerous($i) ? "D" : ".") . ($g->ghost_is_edible($i) ? "E" : ".");
    }
    printf("%03d %s phase=%s fright=%7.3f score=%4d g=[%s %s %s %s] f=[%s %s %s %s]\n",
        $step, pad($label, 28), pad($g->get_phase(), 10),
        $g->frighten_seconds_left(), $g->get_score(),
        pad($gs[0], 10), pad($gs[1], 10), pad($gs[2], 10), pad($gs[3], 10),
        $flags[0], $flags[1], $flags[2], $flags[3]);
    $step++;
}

function tick_n($n, $label) {
    global $g;
    for ($i = 0; $i < $n; $i++) { $g->tick(DT); }
    snap("tick x{$n} ({$label})");
}

snap("created");
for ($i = 0; $i < 4; $i++) { $g->add_ghost(Ghost::_create($names[$i], $corners[$i], $i)); }
snap("add_ghost x4");
$g->start();
snap("start");

tick_n(64, "1.0s: pen not due");
tick_n(80, "2.25s: 1st release");
tick_n(128, "4.25s: 2nd release");
tick_n(128, "6.25s: 3rd release");
tick_n(64, "7.25s: scatter(7s) over");

$g->power_pellet_picked_up();
snap("pellet during CHASE (push)");
tick_n(64, "1.0s frightened");
$g->ghost_caught(0);
snap("caught blinky (+200)");
$g->ghost_caught(0);
snap("caught blinky again (no-op)");
$g->ghost_caught(1);
snap("caught pinky (+200)");
tick_n(64, "2.0s frightened");
$g->ghost_arrived_at_pen(0);
snap("blinky arrived at pen");
tick_n(256, "6.0s: frighten expires");
tick_n(64, "chase resumed 1.0s");

$g->power_pellet_picked_up();
snap("pellet during CHASE #2 (push)");
$g->power_pellet_picked_up();
snap("pellet WHILE frightened (re-enter)");
tick_n(320, "5.0s of re-frighten");
tick_n(96, "6.5s total: expires again");

tick_n(1152, "chase(20s) over -> scatter");
$g->power_pellet_picked_up();
snap("pellet during SCATTER (push)");
tick_n(416, "6.5s: expires -> scatter");
tick_n(320, "scatter(5s) over -> chase");

snap("final");
