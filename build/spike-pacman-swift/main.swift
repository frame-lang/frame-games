// Pac-Man cross-language oracle — Swift driver. Mirrors run-oracle.mjs
// step-for-step; output must byte-match expected-trace.txt.
let DT = 1.0 / 64.0
var step = 0
let g = GhostGame.__create()

func pad(_ s: String, _ w: Int) -> String {
    var out = s
    while out.count < w { out += " " }
    return out
}

func f3(_ v: Double) -> String {
    let s = String(format: "%7.3f", v)
    return s
}

func snap(_ label: String) {
    var gs = ["-", "-", "-", "-"]
    var flags = ["--", "--", "--", "--"]
    let n = g.ghost_count()
    for i in 0..<n {
        gs[i] = g.ghost_state(i)
        flags[i] = (g.ghost_is_dangerous(i) ? "D" : ".") + (g.ghost_is_edible(i) ? "E" : ".")
    }
    let stepStr = String(format: "%03d", step)
    let scoreStr = String(format: "%4d", g.get_score())
    print("\(stepStr) \(pad(label, 28)) phase=\(pad(g.get_phase(), 10)) fright=\(f3(g.frighten_seconds_left())) score=\(scoreStr) g=[\(pad(gs[0], 10)) \(pad(gs[1], 10)) \(pad(gs[2], 10)) \(pad(gs[3], 10))] f=[\(flags[0]) \(flags[1]) \(flags[2]) \(flags[3])]")
    step += 1
}

func tick(_ n: Int, _ label: String) {
    for _ in 0..<n { g.tick(DT) }
    snap("tick x\(n) (\(label))")
}

let names = ["blinky", "pinky", "inky", "clyde"]
let corners = [Vector2(680, 40), Vector2(40, 40), Vector2(680, 440), Vector2(40, 440)]

snap("created")
for i in 0..<4 { g.add_ghost(Ghost.__create(names[i], corners[i], i)) }
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
