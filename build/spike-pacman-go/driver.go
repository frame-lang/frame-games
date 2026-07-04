// Pac-Man cross-language oracle — Go driver. Mirrors run-oracle.mjs
// step-for-step; output must byte-match expected-trace.txt.
package main

import "fmt"

var g *GhostGame
var step = 0

const dtv = 1.0 / 64.0

func pad(s string, w int) string {
    for len(s) < w {
        s += " "
    }
    return s
}

func snap(label string) {
    gs := []string{"-", "-", "-", "-"}
    flags := []string{"--", "--", "--", "--"}
    n := g.Ghost_count()
    for i := 0; i < n; i++ {
        gs[i] = g.Ghost_state(i)
        d, e := ".", "."
        if g.Ghost_is_dangerous(i) {
            d = "D"
        }
        if g.Ghost_is_edible(i) {
            e = "E"
        }
        flags[i] = d + e
    }
    fmt.Printf("%03d %s phase=%s fright=%7.3f score=%4d g=[%s %s %s %s] f=[%s %s %s %s]\n",
        step, pad(label, 28), pad(g.Get_phase(), 10),
        g.Frighten_seconds_left(), g.Get_score(),
        pad(gs[0], 10), pad(gs[1], 10), pad(gs[2], 10), pad(gs[3], 10),
        flags[0], flags[1], flags[2], flags[3])
    step++
}

func tickN(n int, label string) {
    for i := 0; i < n; i++ {
        g.Tick(dtv)
    }
    snap(fmt.Sprintf("tick x%d (%s)", n, label))
}

func main() {
    g = CreateGhostGame()
    names := []string{"blinky", "pinky", "inky", "clyde"}
    corners := []Vector2{{680, 40}, {40, 40}, {680, 440}, {40, 440}}

    snap("created")
    for i := 0; i < 4; i++ {
        g.Add_ghost(CreateGhost(names[i], corners[i], i))
    }
    snap("add_ghost x4")
    g.Start()
    snap("start")

    tickN(64, "1.0s: pen not due")
    tickN(80, "2.25s: 1st release")
    tickN(128, "4.25s: 2nd release")
    tickN(128, "6.25s: 3rd release")
    tickN(64, "7.25s: scatter(7s) over")

    g.Power_pellet_picked_up()
    snap("pellet during CHASE (push)")
    tickN(64, "1.0s frightened")
    g.Ghost_caught(0)
    snap("caught blinky (+200)")
    g.Ghost_caught(0)
    snap("caught blinky again (no-op)")
    g.Ghost_caught(1)
    snap("caught pinky (+200)")
    tickN(64, "2.0s frightened")
    g.Ghost_arrived_at_pen(0)
    snap("blinky arrived at pen")
    tickN(256, "6.0s: frighten expires")
    tickN(64, "chase resumed 1.0s")

    g.Power_pellet_picked_up()
    snap("pellet during CHASE #2 (push)")
    g.Power_pellet_picked_up()
    snap("pellet WHILE frightened (re-enter)")
    tickN(320, "5.0s of re-frighten")
    tickN(96, "6.5s total: expires again")

    tickN(1152, "chase(20s) over -> scatter")
    g.Power_pellet_picked_up()
    snap("pellet during SCATTER (push)")
    tickN(416, "6.5s: expires -> scatter")
    tickN(320, "scatter(5s) over -> chase")

    snap("final")
}
