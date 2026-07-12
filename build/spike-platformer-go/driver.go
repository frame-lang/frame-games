package main

import (
	"fmt"
	"math"
	"strings"
)

const DT = 1.0 / 64.0

var step = 0
var g *Platformer

func mU(x float64) int64 { return int64(math.Round(x * 1000)) }
func bU(x bool) int {
	if x {
		return 1
	}
	return 0
}
func padr(s string, w int) string {
	if len(s) < w {
		return s + strings.Repeat(" ", w-len(s))
	}
	return s
}
func lpad(o interface{}, w int) string {
	s := fmt.Sprintf("%v", o)
	if len(s) < w {
		return strings.Repeat(" ", w-len(s)) + s
	}
	return s
}
func snap(label string) {
	fmt.Printf("%03d %s st=%s loco=%s form=%s vx=%s face=%s gnd=%d air=%d jimp=%d hbox=%s shoot=%d paused=%d\n",
		step, padr(label, 40), padr(g.Get_current_state_name(), 7), padr(g.Locomotion_state(), 8), padr(g.Form(), 5),
		lpad(mU(g.Wants_velocity_x()), 7), lpad(g.Facing(), 2),
		bU(g.Is_grounded()), bU(g.Is_in_air()), bU(g.Wants_jump_impulse()),
		lpad(g.Hit_box_height(), 2), bU(g.Can_shoot()), bU(g.Is_paused()))
	step++
}
func run(n int, label string) {
	for i := 0; i < n; i++ {
		g.Tick(DT)
	}
	snap(fmt.Sprintf("pump x%d (%s)", n, label))
}

func main() {
	g = CreatePlatformer()
	snap("created (Playing / idle / small)")
	fmt.Printf("OP  get_current_state_name=%s\n", g.Get_current_state_name())

	g.Press_right(); snap("press_right -> walking, face+1")
	g.Press_sprint(); snap("press_sprint -> running (vx 260)")
	g.Release_sprint(); snap("release_sprint -> walking (vx 140)")
	g.Press_left(); snap("press_left -> face-1, vx -140")
	g.Release_horizontal(); snap("release_horizontal -> idle")

	g.Press_jump(); snap("press_jump -> jumping, jimp=1")
	g.Consume_jump_impulse(); snap("consume_jump_impulse -> jimp=0")
	g.Press_right(); snap("press_right in air -> vx 180 (air_speed)")
	run(22, "0.34s held: still jumping")
	run(1, "tick 23 (0.35s) -> falling")

	g.Ground_contact(); snap("ground_contact -> landing")
	run(5, "0.078s: still landing")
	run(1, "tick 6 (0.08s): input_x!=0 -> walking")
	g.Release_horizontal(); snap("release_horizontal -> idle")

	g.Press_jump(); snap("press_jump -> jumping (fresh)")
	g.Release_jump(); snap("release_jump -> timer frozen")
	run(40, "0.625s released: STILL jumping (no auto-fall)")
	g.Ground_contact(); snap("ground_contact -> landing (input_x=0)")
	run(6, "0.08s: input_x==0 -> idle")

	g.Left_ground(); snap("left_ground -> falling (walked off)")
	g.Ground_contact(); snap("ground_contact -> landing")
	run(6, "recover -> idle")

	g.Pickup_mushroom(); snap("pickup_mushroom -> big (hbox 48)")
	g.Pickup_flower(); snap("pickup_flower -> fiery (can_shoot 1)")
	g.Take_damage(); snap("take_damage -> big [ret-then-transition]")
	g.Take_damage(); snap("take_damage -> small (hbox 24)")
	g.Take_damage(); snap("take_damage in small -> no transition")
	g.Pickup_flower(); snap("pickup_flower from small -> fiery")

	fmt.Printf("RET take_damage(fiery)=%d form_now=%s (expect 1 / big)\n", bU(g.Take_damage()), g.Form())
	fmt.Printf("RET take_damage(big)=%d form_now=%s (expect 1 / small)\n", bU(g.Take_damage()), g.Form())
	fmt.Printf("RET take_damage(small)=%d form_now=%s (expect 0 / small)\n", bU(g.Take_damage()), g.Form())

	g.Pickup_mushroom(); g.Press_right(); snap("re-arm: big + walking before pause")
	g.Pause(); snap("pause -> Paused (push), paused=1")
	run(64, "1.0s paused: locomotion frozen")
	g.Resume(); snap("resume -> Playing (pop), paused=0")

	g2 := CreatePlatformer()
	g2.Press_right(); g2.Press_sprint()
	locoBefore := g2.Locomotion_state()
	g2.Pickup_mushroom(); g2.Pickup_flower()
	locoAfter := g2.Locomotion_state()
	fmt.Printf("ORTHO loco stable across powerups: before=%s after=%s form=%s (expect running/running/fiery)\n", locoBefore, locoAfter, g2.Form())

	g3 := CreatePlatformer()
	g3.Press_jump()
	for i := 0; i < 10; i++ {
		g3.Tick(DT)
	}
	g3.Pause()
	for i := 0; i < 128; i++ {
		g3.Tick(DT)
	}
	g3.Resume()
	locoResumed := g3.Locomotion_state()
	for i := 0; i < 12; i++ {
		g3.Tick(DT)
	}
	stillJumping := g3.Locomotion_state()
	g3.Tick(DT)
	nowFalling := g3.Locomotion_state()
	fmt.Printf("PAUSE ticks dropped: resumed=%s at22=%s at23=%s (expect jumping/jumping/falling)\n", locoResumed, stillJumping, nowFalling)
}
