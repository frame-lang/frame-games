extends SceneTree
const DT := 1.0 / 64.0
var step_n := 0
var g
func padr(s: String, w: int) -> String: return s.rpad(w) if s.length() < w else s
func padl(s: String, w: int) -> String: return s.lpad(w) if s.length() < w else s
func mU(x: float) -> int: return roundi(x * 1000)
func snap(label: String) -> void:
    var rp := padl(str(mU(g.ball_respawn_progress())), 4) if g.get_state() == "playing" else padl("-", 4)
    print("%03d %s st=%s sc=%s lv=%d lvl=%d br=%s | ball=%s vx=%s vy=%s rp=%s" % [
        step_n, padr(label, 34), padr(g.get_state(), 11), padl(str(g.get_score()), 4), g.get_lives(), g.get_level(),
        padl(str(g.bricks_remaining()), 2), padr(g.ball_state(), 9), padl(str(mU(g.ball_vx())), 6), padl(str(mU(g.ball_vy())), 6), rp])
    step_n += 1
func run(n: int, label: String) -> void:
    for i in range(n): g.tick(DT)
    snap("pump x%d (%s)" % [n, label])
func _initialize() -> void:
    var P = load("res://breakout.gd")
    g = P._create()
    snap("created"); g.start(); snap("start -> playing, ball attached")
    print("OP  get_current_state_name=%s" % g.get_current_state_name())
    g.launch_ball(3.5, -4.25); snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]")
    g.wall_bounce_x(); snap("wall_bounce_x -> vx negated")
    g.wall_bounce_y(); snap("wall_bounce_y -> vy negated")
    g.paddle_hit(2.75, -5.5); snap("paddle_hit -> set_velocity(2.75,-5.5)")
    g.brick_hit(0); snap("brick_hit(0): +10, vy flip, broken")
    g.brick_hit(0); g.brick_hit(999); g.brick_hit(-1); snap("brick_hit dead/oob: NO score change")
    g.brick_hit(1); g.brick_hit(2); snap("brick_hit(1,2): +20")
    g.pause(); snap("pause during PLAYING (push)"); run(64, "1.0s paused: ball frozen"); g.resume(); snap("resume (pop -> playing)")
    g.ball_fell_off(); snap("ball_fell_off -> lives-1, ball lost")
    run(64, "1.0s: respawn progress ~0.5"); run(63, "just before 2.0s: still lost"); run(1, "tick 2.0s: ball -> attached")
    g.launch_ball(3.5, -4.25); snap("re-launch (fresh in_flight)")
    for i in range(3, 40): g.brick_hit(i)
    snap("cleared wall -> level_clear (lvl 2)")
    g.start(); snap("start -> playing, fresh wall of 40")
    g.ball_fell_off(); snap("fell off -> lives 1"); g.ball_fell_off(); snap("fell off -> lives 0 -> game_over")
    g.restart(); snap("restart -> attract (reset)")
    var g2 = P._create(); g2.start(); g2.launch_ball(1.0, -1.0); g2.ball_fell_off()
    for i in range(32): g2.tick(DT)
    var rpb := roundi(g2.ball_respawn_progress() * 1000); g2.pause()
    for i in range(128): g2.tick(DT)
    g2.resume(); var rpa := roundi(g2.ball_respawn_progress() * 1000)
    print("PAUSE respawn frozen: before=%d after=%d ball=%s (paused ticks must not advance the ball)" % [rpb, rpa, g2.ball_state()])
    var g3 = P._create(); g3.start()
    print("BRICK is_broken: fresh0=%s oobNeg=%s oobBig=%s (expect false, true, true)" % [str(g3.is_brick_broken(0)).to_lower(), str(g3.is_brick_broken(-1)).to_lower(), str(g3.is_brick_broken(999)).to_lower()])
    quit()
