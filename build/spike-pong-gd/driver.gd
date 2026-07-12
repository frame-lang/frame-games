extends SceneTree
var step_n := 0
var g
func padr(s: String, w: int) -> String: return s.rpad(w) if s.length() < w else s
func padl(s: String, w: int) -> String: return s.lpad(w) if s.length() < w else s
func bU(x: bool) -> int: return 1 if x else 0
func snap(label: String) -> void:
    print("%03d %s st=%s sl=%s sr=%s serve=%s play=%d winner=%s" % [
        step_n, padr(label, 38), padr(g.get_current_state_name(), 12), padl(str(g.get_score_left()), 2), padl(str(g.get_score_right()), 2),
        padl(str(g.get_serve_direction()), 2), bU(g.is_playing()), padr(g.get_winner(), 6)])
    step_n += 1
func point_right(x) -> void: x.launch(); x.ball_out_left()
func point_left(x) -> void: x.launch(); x.ball_out_right()
func _initialize() -> void:
    var P = load("res://pong.gd")
    g = P._create()
    snap("created (AttractMode / 0-0)")
    print("OP  get_current_state_name=%s get_winning_score=%d" % [g.get_current_state_name(), g.get_winning_score()])

    g.start(); snap("start -> Serving")
    g.pause(); snap("pause during Serving (push)")
    g.resume(); snap("resume (pop -> Serving)")
    g.launch(); snap("launch -> InPlay (playing)")
    g.pause(); snap("pause during InPlay (push)")
    g.resume(); snap("resume (pop -> InPlay)")
    g.ball_out_left(); snap("ball_out_left -> right+1, serve -1")
    point_left(g); snap("pointLeft -> left+1, serve +1")
    for i in range(9): point_right(g)
    snap("right at 10 (one short of 11)")
    point_right(g); snap("right scores 11 -> GameOver [right wins]")
    print("WIN winner=%s playing=%d sl=%d sr=%d" % [g.get_winner(), bU(g.is_playing()), g.get_score_left(), g.get_score_right()])
    g.restart(); snap("restart -> AttractMode (reset)")

    var g2 = P._create()
    g2.start()
    for i in range(11): point_left(g2)
    print("MIRROR left win: st=%s winner=%s sl=%d serve=%d" % [g2.get_current_state_name(), g2.get_winner(), g2.get_score_left(), g2.get_serve_direction()])
    quit()
