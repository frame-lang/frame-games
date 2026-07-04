<?php
require_once "asteroids.php";
$GLOBALS['log'] = [];
class Host implements IShipHost {
    public function warp_out() { $GLOBALS['log'][] = "warp_out"; }
    public function warp_in() { $GLOBALS['log'][] = "warp_in"; }
    public function spawn_explosion() { $GLOBALS['log'][] = "spawn_explosion"; }
    public function reset_ship() { $GLOBALS['log'][] = "reset_ship"; }
}
$g = AsteroidsGame::_create(new Host(), 2);
echo "init: " . $g->get_current_state_name() . " lives " . $g->get_lives() . " wave " . $g->get_wave() . " diff " . $g->get_difficulty() . "\n";
$g->start();
echo "start: " . $g->get_current_state_name() . " count " . $g->field->count() . " alive " . $g->field->alive_count() . "\n";
$court = $g->last_court_size;
for ($i=0;$i<3;$i++) $g->tick(0.016, $court);
$before = $g->get_score(); $g->bullet_hit_asteroid(0);
echo "split0: score $before -> " . $g->get_score() . " count " . $g->field->count() . " alive " . $g->field->alive_count() . "\n";
$g->ship_hyperspace();
for ($i=0;$i<30;$i++) $g->tick(0.016, $court);
echo "hyper: ship " . $g->ship->get_current_state_name() . " warps " . $g->ship->get_hyperspaces_remaining() . " host " . implode(",", $GLOBALS['log']) . "\n";
$g->pause(); $p = $g->is_paused() ? "true" : "false"; $g->resume();
echo "pause/resume: $p -> " . ($g->is_paused() ? "true" : "false") . "\n";
echo "PHP SMOKE OK\n";
