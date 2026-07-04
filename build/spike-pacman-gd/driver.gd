# Pac-Man cross-language oracle — GDScript driver. Mirrors run-oracle.mjs
# step-for-step; trace lines must byte-match expected-trace.txt (the godot
# banner is filtered out by the harness before diffing).
extends SceneTree

const DT := 1.0 / 64.0
var step_n := 0
var g

func pad(s: String, w: int) -> String:
    return s.rpad(w) if s.length() < w else s

func snap(label: String) -> void:
    var gs := ["-", "-", "-", "-"]
    var flags := ["--", "--", "--", "--"]
    var n: int = g.ghost_count()
    for i in range(n):
        gs[i] = g.ghost_state(i)
        var d := "D" if g.ghost_is_dangerous(i) else "."
        var e := "E" if g.ghost_is_edible(i) else "."
        flags[i] = d + e
    print("%03d %s phase=%s fright=%7.3f score=%4d g=[%s %s %s %s] f=[%s %s %s %s]" % [
        step_n, pad(label, 28), pad(g.get_phase(), 10),
        g.frighten_seconds_left(), g.get_score(),
        pad(gs[0], 10), pad(gs[1], 10), pad(gs[2], 10), pad(gs[3], 10),
        flags[0], flags[1], flags[2], flags[3]])
    step_n += 1

func tick(n: int, label: String) -> void:
    for i in range(n):
        g.tick(DT)
    snap("tick x%d (%s)" % [n, label])

func _init() -> void:
    var P = load("res://pacman.gd")
    g = P._create()
    var names := ["blinky", "pinky", "inky", "clyde"]
    var corners := [Vector2(680, 40), Vector2(40, 40), Vector2(680, 440), Vector2(40, 440)]

    snap("created")
    for i in range(4):
        g.add_ghost(P.Ghost._create(names[i], corners[i], i))
    snap("add_ghost x4")
    g.start()
    snap("start")

    tick(64, "1.0s: pen not due")
    tick(80, "2.25s: 1st release")
    tick(128, "4.25s: 2nd release")
    tick(128, "6.25s: 3rd release")
    tick(64, "7.25s: scatter(7s) over")

    g.power_pellet_picked_up()
    snap("pellet during CHASE (push)")
    tick(64, "1.0s frightened")
    g.ghost_caught(0)
    snap("caught blinky (+200)")
    g.ghost_caught(0)
    snap("caught blinky again (no-op)")
    g.ghost_caught(1)
    snap("caught pinky (+200)")
    tick(64, "2.0s frightened")
    g.ghost_arrived_at_pen(0)
    snap("blinky arrived at pen")
    tick(256, "6.0s: frighten expires")
    tick(64, "chase resumed 1.0s")

    g.power_pellet_picked_up()
    snap("pellet during CHASE #2 (push)")
    g.power_pellet_picked_up()
    snap("pellet WHILE frightened (re-enter)")
    tick(320, "5.0s of re-frighten")
    tick(96, "6.5s total: expires again")

    tick(1152, "chase(20s) over -> scatter")
    g.power_pellet_picked_up()
    snap("pellet during SCATTER (push)")
    tick(416, "6.5s: expires -> scatter")
    tick(320, "scatter(5s) over -> chase")

    snap("final")
    quit()
