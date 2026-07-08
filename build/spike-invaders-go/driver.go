package main

import (
	"fmt"
	"math"
	"strings"
)

const DT = 1.0 / 64.0

var step = 0
var g *Invaders

func ivus() int64 { return int64(math.Round(g.fleet.Get_step_interval() * 1e6)) }
func padr(s string, w int) string { if len(s) < w { return s + strings.Repeat(" ", w-len(s)) }; return s }
func padl(o interface{}, w int) string { s := fmt.Sprintf("%v", o); if len(s) < w { return strings.Repeat(" ", w-len(s)) + s }; return s }
func b2i(b bool) int { if b { return 1 }; return 0 }
func snap(label string) {
	fl := g.fleet
	fmt.Printf("%03d %s st=%s sc=%s wv=%d lv=%d | fl=%s dir=%s al=%s/%s iv=%s lr=%s | pl=%s pz=%d\n",
		step, padr(label, 34), padr(g.Get_state(), 13), padl(g.Get_score(), 4), g.Get_wave(), g.Get_lives(),
		padr(fl.Get_state(), 9), padl(fl.Get_direction(), 2), padl(fl.Alive_count(), 2), padl(fl.Total(), 2),
		padl(ivus(), 6), padl(fl.Lowest_row(), 2), padr(g.player.Get_state(), 12), b2i(g.Is_paused()))
	step++
}
func run(n int, label string) { for i := 0; i < n; i++ { g.Tick(DT) }; snap(fmt.Sprintf("pump x%d (%s)", n, label)) }

func main() {
	g = NewInvaders()
	snap("created")
	g.Start()
	snap("start -> playing (fleet 55, iv=600000)")
	fmt.Println("OP  get_current_state_name=" + g.Get_current_state_name())

	run(39, "0.61s: fleet wants_to_step")
	sig := "false"; if g.fleet.Consume_step() { sig = "true" }
	fmt.Println("SIG consume_step=" + sig + " (timer was >= interval)")

	g.Player_killed_invader(0)
	snap("kill idx0 (+10, pace up)")
	g.Player_killed_invader(1)
	g.Player_killed_invader(2)
	snap("kill idx1,2 (+20 more)")
	g.Player_killed_invader(1)
	g.Player_killed_invader(999)
	g.Player_killed_invader(-1)
	snap("kill dead/oob idx: NO score change")

	g.Fleet_reached_edge()
	snap("fleet_reached_edge -> stepping, dir flip")
	run(1, "one tick: stepping -> marching")

	g.Pause()
	snap("pause during PLAYING (push)")
	run(64, "1.0s paused: fleet+player frozen")
	g.Resume()
	snap("resume (pop -> playing)")

	for i := 3; i < 55; i++ { g.Player_killed_invader(i) }
	snap("cleared fleet -> wave_complete")

	g.Pause()
	snap("pause during WAVE_COMPLETE (push)")
	run(64, "1.0s paused: wave timer frozen")
	g.Resume()
	snap("resume (pop -> wave_complete)")

	run(129, "2.0s: wave 2 begins, fleet reset")

	g.Player_hit()
	snap("player_hit -> player_dying")
	g.Player_hit()
	snap("player_hit while exploding: NO-OP")

	g.Pause()
	snap("pause during PLAYER_DYING (push)")
	run(64, "1.0s paused: explosion timer frozen")
	g.Resume()
	snap("resume (pop -> player_dying)")

	run(77, "1.2s: lives-1, invuln, -> playing")
	run(96, "1.5s: invuln over -> alive")

	g.Fleet_reached_bottom()
	snap("fleet_reached_bottom -> game_over")
	g.Restart()
	snap("restart -> attract (reset)")

	g2 := NewInvaders()
	g2.Start()
	for life := 0; life < 3; life++ { g2.Player_hit(); for i := 0; i < 180; i++ { g2.Tick(DT) } }
	fmt.Printf("DEATH after 3 hits: st=%s lives=%d player=%s\n", g2.Get_state(), g2.Get_lives(), g2.player.Get_state())

	g3 := NewInvaders()
	g3.Start()
	d0 := g3.fleet.Get_direction()
	g3.Fleet_reached_edge(); g3.Tick(DT)
	d1 := g3.fleet.Get_direction()
	g3.Fleet_reached_edge(); g3.Tick(DT)
	d2 := g3.fleet.Get_direction()
	fmt.Printf("DIR bounces: start=%d after1=%d after2=%d\n", d0, d1, d2)
}
