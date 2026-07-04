package main

import "fmt"

var g *Shooter
var step, wavesBuilt, ef, bsingle, bspread, bspray int

const dtv = 1.0 / 64.0

func pad(s string, w int) string { for len(s) < w { s += " " }; return s }

func buildWave() {
    wavesBuilt++
    if wavesBuilt == 1 {
        g.Add_enemy(CreateEnemy(0, 2, 0.0, 100))
        g.Add_enemy(CreateEnemy(1, 3, 0.75, 150))
    } else {
        g.Add_enemy(CreateEnemy(wavesBuilt%3, 1, 0.0, 10))
        g.Add_enemy(CreateEnemy((wavesBuilt+1)%3, 1, 0.0, 10))
    }
}

func pump(n int) {
    for i := 0; i < n; i++ {
        g.Tick(dtv)
        if g.Should_spawn_wave() { g.Consume_wave(); buildWave() }
        if g.Should_spawn_boss() { g.Consume_boss_spawn() }
        for e := 0; e < g.Enemy_count(); e++ {
            en := g.enemies[e]
            if en.Wants_to_fire() { en.Consume_fire(); ef++ }
        }
        if g.boss.Wants_to_fire_single() { g.boss.Consume_fire(); bsingle++ }
        if g.boss.Wants_to_fire_spread() { g.boss.Consume_fire(); bspread++ }
        if g.boss.Wants_to_fire_spray()  { g.boss.Consume_fire(); bspray++ }
        g.Clear_dead_enemies()
    }
}

func snap(label string) {
    e0, e1 := "-", "-"
    if g.Enemy_count() > 0 { e0 = g.enemies[0].Get_state() }
    if g.Enemy_count() > 1 { e1 = g.enemies[1].Get_state() }
    fmt.Printf("%03d %s st=%s score=%4d lives=%d n=%d e0=%s e1=%s boss=%s bhp=%2d pl=%s fire[e=%d s=%d d=%d y=%d] waves=%d\n",
        step, pad(label, 30), pad(g.Get_state(), 10), g.Get_score(), g.Get_lives(), g.Enemy_count(),
        pad(e0, 8), pad(e1, 8), pad(g.boss.Get_state(), 11), g.boss.Get_hp(), pad(g.player.Get_state(), 12),
        ef, bsingle, bspread, bspray, wavesBuilt)
    step++
}

func run(n int, label string) { pump(n); snap(fmt.Sprintf("pump x%d (%s)", n, label)) }

func main() {
    g = CreateShooter()
    snap("created"); g.Start(); snap("start -> playing")
    run(129, "2.0s+: wave 1 spawns"); run(32, "0.5s: spawning -> active")
    g.Enemy_hit(0, 1); snap("e0 hit 1/2 (still active)")
    g.Enemy_hit(0, 1); snap("e0 hit 2/2 -> dying, +100")
    run(26, "0.4s: e0 gone + CLEANED UP"); run(23, "e1 fire #1 (rate 0.75)"); run(48, "e1 fire #2")
    g.Player_hit(); snap("player hit -> exploding")
    g.Player_hit(); snap("player hit while exploding (no-op)")
    run(64, "1.0s: lives-1 -> invulnerable")
    g.Player_hit(); snap("player hit while invuln (no-op)")
    g.Pause(); snap("pause during PLAYING (push)")
    run(64, "1.0s paused: everything frozen")
    g.Resume(); snap("resume (pop -> playing)")
    run(128, "2.0s: invuln over + wave 2")
    g.Enemy_hit(0, 99); snap("kill the old shooter e0 (+150)")
    run(600, "rush: waves 3..6 spawn+decay"); run(600, "rush: waves 7..10 -> BOSS mid-pump")
    snap("boss_fight (entered during rush)")
    run(116, "boss p1: idle(1.8s) -> firing"); run(26, "p1 firing 0.4s -> idle (1 shot)")
    g.Boss_hit(10); g.Boss_hit(10); g.Boss_hit(10); snap("boss 90->60 (>59.4: still P1)")
    g.Boss_hit(10); snap("boss 60->50 <=59.4 -> PHASE 2")
    g.Pause(); snap("pause during BOSS FIGHT (push)")
    run(64, "1.0s paused: boss frozen")
    g.Resume(); snap("resume (pop -> boss_fight)")
    run(84, "p2: idle(1.3s) -> spread"); run(33, "p2 spread 0.5s -> idle (1 shot)")
    g.Boss_hit(21); snap("boss 50->29 <=29.7 -> PHASE 3")
    run(39, "p3: idle(0.6s) -> spray"); run(52, "p3 spray 0.8s (~6 shots @0.12s)")
    g.Boss_hit(29); snap("boss 29->0 in P3 -> DYING")
    run(200, "boss dying -> gone -> VICTORY")
    snap("final")

    g2 := CreateShooter()
    g2.Start()
    for w := 0; w < 10; w++ {
        for i := 0; i < 129; i++ { g2.Tick(dtv) }
        if g2.Should_spawn_wave() { g2.Consume_wave() }
    }
    for i := 0; i < 65; i++ { g2.Tick(dtv) }
    fmt.Printf("Q00 quirk: state=%s boss=%s\n", g2.Get_state(), g2.boss.Get_state())
    g2.Boss_hit(90)
    fmt.Printf("Q01 quirk: one 90-dmg hit in P1 -> boss=%s hp=%d (phase two, not dying)\n", g2.boss.Get_state(), g2.boss.Get_hp())
    g2.Boss_hit(1)
    fmt.Printf("Q02 quirk: 1-dmg hit in P2 at 0hp -> boss=%s hp=%d (phase three)\n", g2.boss.Get_state(), g2.boss.Get_hp())
    g2.Boss_hit(1)
    fmt.Printf("Q03 quirk: 1-dmg hit in P3 -> boss=%s (finally dying)\n", g2.boss.Get_state())
}
