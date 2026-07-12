<?php
require_once "platformer.php";
const DT = 1.0 / 64.0;
$step = 0;
$g = null;
function mU($x) { return (int)round($x * 1000); }
function bU($x) { return $x ? 1 : 0; }
function padr($s, $w) { $s = (string)$s; return strlen($s) < $w ? $s . str_repeat(" ", $w - strlen($s)) : $s; }
function padl($s, $w) { $s = (string)$s; return strlen($s) < $w ? str_repeat(" ", $w - strlen($s)) . $s : $s; }
function snap($label) {
    global $g, $step;
    printf("%03d %s st=%s loco=%s form=%s vx=%s face=%s gnd=%d air=%d jimp=%d hbox=%s shoot=%d paused=%d\n",
        $step, padr($label, 40), padr($g->get_current_state_name(), 7), padr($g->locomotion_state(), 8), padr($g->form(), 5),
        padl(mU($g->wants_velocity_x()), 7), padl($g->facing(), 2),
        bU($g->is_grounded()), bU($g->is_in_air()), bU($g->wants_jump_impulse()),
        padl($g->hit_box_height(), 2), bU($g->can_shoot()), bU($g->is_paused()));
    $step++;
}
function run($n, $label) { global $g; for ($i = 0; $i < $n; $i++) $g->tick(DT); snap("pump x$n ($label)"); }

$g = Platformer::_create();
snap("created (Playing / idle / small)");
printf("OP  get_current_state_name=%s\n", $g->get_current_state_name());

$g->press_right();
snap("press_right -> walking, face+1");
$g->press_sprint();
snap("press_sprint -> running (vx 260)");
$g->release_sprint();
snap("release_sprint -> walking (vx 140)");
$g->press_left();
snap("press_left -> face-1, vx -140");
$g->release_horizontal();
snap("release_horizontal -> idle");

$g->press_jump();
snap("press_jump -> jumping, jimp=1");
$g->consume_jump_impulse();
snap("consume_jump_impulse -> jimp=0");
$g->press_right();
snap("press_right in air -> vx 180 (air_speed)");
run(22, "0.34s held: still jumping");
run(1, "tick 23 (0.35s) -> falling");

$g->ground_contact();
snap("ground_contact -> landing");
run(5, "0.078s: still landing");
run(1, "tick 6 (0.08s): input_x!=0 -> walking");
$g->release_horizontal();
snap("release_horizontal -> idle");

$g->press_jump();
snap("press_jump -> jumping (fresh)");
$g->release_jump();
snap("release_jump -> timer frozen");
run(40, "0.625s released: STILL jumping (no auto-fall)");
$g->ground_contact();
snap("ground_contact -> landing (input_x=0)");
run(6, "0.08s: input_x==0 -> idle");

$g->left_ground();
snap("left_ground -> falling (walked off)");
$g->ground_contact();
snap("ground_contact -> landing");
run(6, "recover -> idle");

$g->pickup_mushroom();
snap("pickup_mushroom -> big (hbox 48)");
$g->pickup_flower();
snap("pickup_flower -> fiery (can_shoot 1)");
$g->take_damage();
snap("take_damage -> big [ret-then-transition]");
$g->take_damage();
snap("take_damage -> small (hbox 24)");
$g->take_damage();
snap("take_damage in small -> no transition");
$g->pickup_flower();
snap("pickup_flower from small -> fiery");

printf("RET take_damage(fiery)=%d form_now=%s (expect 1 / big)\n", bU($g->take_damage()), $g->form());
printf("RET take_damage(big)=%d form_now=%s (expect 1 / small)\n", bU($g->take_damage()), $g->form());
printf("RET take_damage(small)=%d form_now=%s (expect 0 / small)\n", bU($g->take_damage()), $g->form());

$g->pickup_mushroom();
$g->press_right();
snap("re-arm: big + walking before pause");
$g->pause();
snap("pause -> Paused (push), paused=1");
run(64, "1.0s paused: locomotion frozen");
$g->resume();
snap("resume -> Playing (pop), paused=0");

$g2 = Platformer::_create();
$g2->press_right();
$g2->press_sprint();
$loco_before = $g2->locomotion_state();
$g2->pickup_mushroom();
$g2->pickup_flower();
$loco_after = $g2->locomotion_state();
printf("ORTHO loco stable across powerups: before=%s after=%s form=%s (expect running/running/fiery)\n", $loco_before, $loco_after, $g2->form());

$g3 = Platformer::_create();
$g3->press_jump();
for ($i = 0; $i < 10; $i++) $g3->tick(DT);
$g3->pause();
for ($i = 0; $i < 128; $i++) $g3->tick(DT);
$g3->resume();
$loco_resumed = $g3->locomotion_state();
for ($i = 0; $i < 12; $i++) $g3->tick(DT);
$still_jumping = $g3->locomotion_state();
$g3->tick(DT);
$now_falling = $g3->locomotion_state();
printf("PAUSE ticks dropped: resumed=%s at22=%s at23=%s (expect jumping/jumping/falling)\n", $loco_resumed, $still_jumping, $now_falling);
