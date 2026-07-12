package main

import (
	"fmt"
	"strings"
)

var step = 0
var g *Pong

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
	fmt.Printf("%03d %s st=%s sl=%s sr=%s serve=%s play=%d winner=%s\n",
		step, padr(label, 38), padr(g.Get_current_state_name(), 12), lpad(g.Get_score_left(), 2), lpad(g.Get_score_right(), 2),
		lpad(g.Get_serve_direction(), 2), bU(g.Is_playing()), padr(g.Get_winner(), 6))
	step++
}
func pointRight(x *Pong) { x.Launch(); x.Ball_out_left() }
func pointLeft(x *Pong)  { x.Launch(); x.Ball_out_right() }

func main() {
	g = CreatePong()
	snap("created (AttractMode / 0-0)")
	fmt.Printf("OP  get_current_state_name=%s get_winning_score=%d\n", g.Get_current_state_name(), g.Get_winning_score())

	g.Start(); snap("start -> Serving")
	g.Pause(); snap("pause during Serving (push)")
	g.Resume(); snap("resume (pop -> Serving)")
	g.Launch(); snap("launch -> InPlay (playing)")
	g.Pause(); snap("pause during InPlay (push)")
	g.Resume(); snap("resume (pop -> InPlay)")
	g.Ball_out_left(); snap("ball_out_left -> right+1, serve -1")
	pointLeft(g); snap("pointLeft -> left+1, serve +1")
	for i := 0; i < 9; i++ {
		pointRight(g)
	}
	snap("right at 10 (one short of 11)")
	pointRight(g); snap("right scores 11 -> GameOver [right wins]")
	fmt.Printf("WIN winner=%s playing=%d sl=%d sr=%d\n", g.Get_winner(), bU(g.Is_playing()), g.Get_score_left(), g.Get_score_right())
	g.Restart(); snap("restart -> AttractMode (reset)")

	g2 := CreatePong()
	g2.Start()
	for i := 0; i < 11; i++ {
		pointLeft(g2)
	}
	fmt.Printf("MIRROR left win: st=%s winner=%s sl=%d serve=%d\n", g2.Get_current_state_name(), g2.Get_winner(), g2.Get_score_left(), g2.Get_serve_direction())
}
