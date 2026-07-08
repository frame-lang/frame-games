package main

import ("fmt"; "math"; "strings")

const DT = 1.0 / 64.0
var step = 0
var g *Breakout
func mU(x float64) int64 { return int64(math.Round(x * 1000)) }
func padr(s string, w int) string { if len(s) < w { return s + strings.Repeat(" ", w-len(s)) }; return s }
func padl(o interface{}, w int) string { s := fmt.Sprintf("%v", o); if len(s) < w { return strings.Repeat(" ", w-len(s)) + s }; return s }
func snap(label string) {
	rp := padl("-", 4)
	if g.Get_state() == "playing" { rp = padl(mU(g.Ball_respawn_progress()), 4) }
	fmt.Printf("%03d %s st=%s sc=%s lv=%d lvl=%d br=%s | ball=%s vx=%s vy=%s rp=%s\n",
		step, padr(label,34), padr(g.Get_state(),11), padl(g.Get_score(),4), g.Get_lives(), g.Get_level(),
		padl(g.Bricks_remaining(),2), padr(g.Ball_state(),9), padl(mU(g.Ball_vx()),6), padl(mU(g.Ball_vy()),6), rp)
	step++
}
func run(n int, label string) { for i:=0;i<n;i++ { g.Tick(DT) }; snap(fmt.Sprintf("pump x%d (%s)",n,label)) }
func main() {
	g = CreateBreakout()
	snap("created"); g.Start(); snap("start -> playing, ball attached")
	fmt.Println("OP  get_current_state_name=" + g.Get_current_state_name())
	g.Launch_ball(3.5, -4.25); snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]")
	g.Wall_bounce_x(); snap("wall_bounce_x -> vx negated")
	g.Wall_bounce_y(); snap("wall_bounce_y -> vy negated")
	g.Paddle_hit(2.75, -5.5); snap("paddle_hit -> set_velocity(2.75,-5.5)")
	g.Brick_hit(0); snap("brick_hit(0): +10, vy flip, broken")
	g.Brick_hit(0); g.Brick_hit(999); g.Brick_hit(-1); snap("brick_hit dead/oob: NO score change")
	g.Brick_hit(1); g.Brick_hit(2); snap("brick_hit(1,2): +20")
	g.Pause(); snap("pause during PLAYING (push)"); run(64, "1.0s paused: ball frozen"); g.Resume(); snap("resume (pop -> playing)")
	g.Ball_fell_off(); snap("ball_fell_off -> lives-1, ball lost")
	run(64, "1.0s: respawn progress ~0.5"); run(63, "just before 2.0s: still lost"); run(1, "tick 2.0s: ball -> attached")
	g.Launch_ball(3.5, -4.25); snap("re-launch (fresh in_flight)")
	for i:=3;i<40;i++ { g.Brick_hit(i) }; snap("cleared wall -> level_clear (lvl 2)")
	g.Start(); snap("start -> playing, fresh wall of 40")
	g.Ball_fell_off(); snap("fell off -> lives 1"); g.Ball_fell_off(); snap("fell off -> lives 0 -> game_over")
	g.Restart(); snap("restart -> attract (reset)")
	g2 := CreateBreakout(); g2.Start(); g2.Launch_ball(1.0,-1.0); g2.Ball_fell_off()
	for i:=0;i<32;i++ { g2.Tick(DT) }; rpb := mU(g2.Ball_respawn_progress()); g2.Pause()
	for i:=0;i<128;i++ { g2.Tick(DT) }; g2.Resume(); rpa := mU(g2.Ball_respawn_progress())
	fmt.Printf("PAUSE respawn frozen: before=%d after=%d ball=%s (paused ticks must not advance the ball)\n", rpb, rpa, g2.Ball_state())
	g3 := CreateBreakout(); g3.Start()
	fmt.Printf("BRICK is_broken: fresh0=%v oobNeg=%v oobBig=%v (expect false, true, true)\n", g3.Is_brick_broken(0), g3.Is_brick_broken(-1), g3.Is_brick_broken(999))
}
