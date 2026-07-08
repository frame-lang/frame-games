extends SceneTree

const DT := 1.0 / 64.0
var step_n := 0
var g

func padr(s: String, w: int) -> String: return s.rpad(w) if s.length() < w else s
func padl(s: String, w: int) -> String: return s.lpad(w) if s.length() < w else s
func ivus() -> int: return roundi(g.fleet.get_step_interval() * 1e6)
func snap(label: String) -> void:
    var fl = g.fleet
    print("%03d %s st=%s sc=%s wv=%d lv=%d | fl=%s dir=%s al=%s/%s iv=%s lr=%s | pl=%s pz=%d" % [
        step_n, padr(label, 34), padr(g.get_state(), 13), padl(str(g.get_score()), 4), g.get_wave(), g.get_lives(),
        padr(fl.get_state(), 9), padl(str(fl.get_direction()), 2), padl(str(fl.alive_count()), 2), padl(str(fl.total()), 2),
        padl(str(ivus()), 6), padl(str(fl.lowest_row()), 2), padr(g.player.get_state(), 12), 1 if g.is_paused() else 0])
    step_n += 1
func run(n: int, label: String) -> void:
    for i in range(n): g.tick(DT)
    snap("pump x%d (%s)" % [n, label])

func _initialize() -> void:
    var P = load("res://invaders.gd")
    g = P._create()
    snap("created")
    g.start()
    snap("start -> playing (fleet 55, iv=600000)")
    print("OP  get_current_state_name=%s" % g.get_current_state_name())

    run(39, "0.61s: fleet wants_to_step")
    print("SIG consume_step=%s (timer was >= interval)" % ("true" if g.fleet.consume_step() else "false"))

    g.player_killed_invader(0)
    snap("kill idx0 (+10, pace up)")
    g.player_killed_invader(1)
    g.player_killed_invader(2)
    snap("kill idx1,2 (+20 more)")
    g.player_killed_invader(1)
    g.player_killed_invader(999)
    g.player_killed_invader(-1)
    snap("kill dead/oob idx: NO score change")

    g.fleet_reached_edge()
    snap("fleet_reached_edge -> stepping, dir flip")
    run(1, "one tick: stepping -> marching")

    g.pause()
    snap("pause during PLAYING (push)")
    run(64, "1.0s paused: fleet+player frozen")
    g.resume()
    snap("resume (pop -> playing)")

    for i in range(3, 55): g.player_killed_invader(i)
    snap("cleared fleet -> wave_complete")

    g.pause()
    snap("pause during WAVE_COMPLETE (push)")
    run(64, "1.0s paused: wave timer frozen")
    g.resume()
    snap("resume (pop -> wave_complete)")

    run(129, "2.0s: wave 2 begins, fleet reset")

    g.player_hit()
    snap("player_hit -> player_dying")
    g.player_hit()
    snap("player_hit while exploding: NO-OP")

    g.pause()
    snap("pause during PLAYER_DYING (push)")
    run(64, "1.0s paused: explosion timer frozen")
    g.resume()
    snap("resume (pop -> player_dying)")

    run(77, "1.2s: lives-1, invuln, -> playing")
    run(96, "1.5s: invuln over -> alive")

    g.fleet_reached_bottom()
    snap("fleet_reached_bottom -> game_over")
    g.restart()
    snap("restart -> attract (reset)")

    var g2 = P._create()
    g2.start()
    for life in range(3):
        g2.player_hit()
        for i in range(180): g2.tick(DT)
    print("DEATH after 3 hits: st=%s lives=%d player=%s" % [g2.get_state(), g2.get_lives(), g2.player.get_state()])

    var g3 = P._create()
    g3.start()
    var d0 = g3.fleet.get_direction()
    g3.fleet_reached_edge(); g3.tick(DT)
    var d1 = g3.fleet.get_direction()
    g3.fleet_reached_edge(); g3.tick(DT)
    var d2 = g3.fleet.get_direction()
    print("DIR bounces: start=%d after1=%d after2=%d" % [d0, d1, d2])
    quit()
