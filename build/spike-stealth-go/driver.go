// Stealth cross-language oracle — Go driver. Mirrors run-oracle.mjs.
package main

import (
	"fmt"
	"math"
	"strings"
)

const DT = 1.0 / 64.0

var step = 0
var g *Stealth
var FAR = Vector2{500, 500}
var pos1, pos2, pos3 Vector2

func P(x, y float64) Vector2 { return Vector2{x, y} }
func pad(s string, w int) string {
	if len(s) < w {
		return s + strings.Repeat(" ", w-len(s))
	}
	return s
}
func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}
func flags(gd *Guard) string {
	return fmt.Sprintf("%d%d%d", b2i(gd.Is_aware()), b2i(gd.Is_alerted()), b2i(gd.Should_move()))
}
func gcol(gd *Guard) string {
	t := gd.Get_target()
	return fmt.Sprintf("%s/%s tgt=(%d,%d)", gd.Get_state(), flags(gd), int64(math.Round(t.X)), int64(math.Round(t.Y)))
}
func snapOf(m *Stealth, label, tag string) {
	fmt.Printf("%s%03d %s st=%s t=%4d by=%2d | g1=%s | g2=%s | g3=%s\n",
		tag, step, pad(label, 38), pad(m.Get_state(), 8),
		int64(math.Round(m.Get_elapsed()*64)), m.Get_caught_by(),
		pad(gcol(m.guard1), 28), pad(gcol(m.guard2), 28), pad(gcol(m.guard3), 28))
	step++
}
func snap(label string) { snapOf(g, label, "") }
func pump(n int) {
	for i := 0; i < n; i++ {
		g.Tick(DT, pos1, pos2, pos3)
	}
}
func run(n int, label string) { pump(n); snap(fmt.Sprintf("pump x%d (%s)", n, label)) }

func main() {
	P1 := []Vector2{P(0, 0), P(64, 0), P(64, 64)}
	P2 := []Vector2{P(0, 0), P(96, 0)}
	P3 := []Vector2{P(0, 0), P(96, 96)}
	pos1, pos2, pos3 = FAR, FAR, FAR
	g = NewStealth()

	snap("created (guards idle)")
	g.Start(P1, P2, P3)
	snap("start -> playing, guards patrol wp0")
	fmt.Println("OP  get_current_state_name=" + g.Get_current_state_name())

	run(32, "0.5s: nobody arrives (FAR)")
	pos1 = P(1, 1)
	run(1, "g1 arrives wp0 -> tgt wp1")
	pos1 = P(63, 1)
	run(1, "g1 arrives wp1 -> tgt wp2")
	pos1 = P(63, 63)
	run(1, "g1 arrives wp2 -> WRAP tgt wp0")
	pos1 = FAR

	g.guard1.Hear_sound(P(50, 50))
	g.guard2.Hear_sound(P(10, 90))
	snap("g1+g2 hear_sound -> investigating")
	run(95, "1.484s: both still investigating")
	run(1, "tick 96 = 1.5s: both pop$ -> patrol")

	g.guard3.Spot_player(P(80, 80))
	snap("g3 spotted (patrolling->alerted)")
	g.guard3.Hear_sound(P(5, 5))
	snap("g3 hear_sound while alerted: NO-OP")

	run(200, "3.125s chasing (far, no arrive)")
	g.guard3.Spot_player(P(80, 80))
	snap("re-spot at 3.125s: chase timer RESET")
	run(200, "3.125s more: still alerted (reset)")
	run(56, "chase clock hits 4.0s -> searching")
	pos3 = P(90, 90)
	run(192, "3.0s search over -> NEAREST wp1")
	pos3 = FAR

	g.guard1.Hear_sound(P(50, 50))
	snap("g1 investigating again (push #2)")
	g.guard1.Spot_player(P(30, 30))
	snap("spot DURING investigate -> alerted")
	pos1 = P(29, 29)
	run(1, "g1 arrives last_known -> searching")
	pos1 = P(1, 1)
	run(192, "3.0s search over -> patrolling")
	g.guard1.Hear_sound(P(40, 40))
	snap("g1 push #3 (orphan below on stack)")
	run(96, "1.5s: pop$ is LIFO -> patrolling")
	pos1 = FAR

	g.guard2.Hear_sound(P(10, 90))
	snap("g2 investigating (timer at 0)")
	g.Pause()
	snap("pause during playing (push)")
	run(192, "3.0s paused: g2 timer FROZEN")
	g.Resume()
	snap("resume (pop -> playing)")
	run(96, "1.5s after resume: g2 pops now")

	g.Guard_caught_player(1)
	snap("g2 touches player -> caught")

	g.Restart()
	snap("restart -> attract (counters reset)")

	esc := NewStealth()
	esc.Start(P1, P2, P3)
	for i := 0; i < 64; i++ {
		esc.Tick(DT, FAR, FAR, FAR)
	}
	esc.Player_at_exit()
	fmt.Printf("ESC escape path: st=%s by=%d t=%d\n", esc.Get_state(), esc.Get_caught_by(), int64(math.Round(esc.Get_elapsed()*64)))

	g.Start(P2, P3, P1)
	snap("Q: start after restart: init DROPPED")

	step = 0
	s := NewStealth()
	s.Start(P1, P2, P3)
	for i := 0; i < 32; i++ {
		s.Tick(DT, P(1, 1), FAR, FAR)
	}
	s.guard1.Hear_sound(P(50, 50))
	s.guard2.Spot_player(P(80, 80))
	for i := 0; i < 32; i++ {
		s.Tick(DT, FAR, FAR, FAR)
	}
	snapOf(s, "SAVE POINT (push live, alerted, mid)", "S")
	blob := s.Save_state()
	r := NewStealth()
	r.Restore_state(blob)
	snapOf(r, "restored copy, same tick", "S")
	step--
	ns := []int{64, 224, 192}
	labels := []string{"invest pops on both", "chase times out on both", "search resumes patrol on both"}
	for k := 0; k < 3; k++ {
		for i := 0; i < ns[k]; i++ {
			s.Tick(DT, FAR, FAR, FAR)
		}
		for i := 0; i < ns[k]; i++ {
			r.Tick(DT, FAR, FAR, FAR)
		}
		snapOf(s, fmt.Sprintf("orig  +%d (%s)", ns[k], labels[k]), "S")
		step--
		snapOf(r, fmt.Sprintf("rest  +%d (%s)", ns[k], labels[k]), "S")
	}
	s.Pause()
	blob2 := s.Save_state()
	r2 := NewStealth()
	r2.Restore_state(blob2)
	r2.Resume()
	fmt.Printf("SP  paused save -> restore -> resume: st=%s t=%d\n", r2.Get_state(), int64(math.Round(r2.Get_elapsed()*64)))
}
