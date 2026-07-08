import Foundation

var step = 0
var g = Invaders.__create()

func ivus() -> Int { return Int((g.fleet.get_step_interval() * 1e6).rounded()) }
func padr(_ s: String, _ w: Int) -> String { var o = s; while o.count < w { o += " " }; return o }
func padl(_ v: Int, _ w: Int) -> String { var s = String(v); while s.count < w { s = " " + s }; return s }
func snap(_ label: String) {
    let fl = g.fleet
    let stp = String(format: "%03d", step)
    print("\(stp) \(padr(label, 34)) st=\(padr(g.get_state(), 13)) sc=\(padl(g.get_score(), 4)) wv=\(g.get_wave()) lv=\(g.get_lives()) | " +
          "fl=\(padr(fl.get_state(), 9)) dir=\(padl(fl.get_direction(), 2)) al=\(padl(fl.alive_count(), 2))/\(padl(fl.total(), 2)) " +
          "iv=\(padl(ivus(), 6)) lr=\(padl(fl.lowest_row(), 2)) | pl=\(padr(g.player.get_state(), 12)) pz=\(g.is_paused() ? 1 : 0)")
    step += 1
}
func run(_ n: Int, _ label: String) { for _ in 0..<n { g.tick(1.0/64.0) }; snap("pump x\(n) (\(label))") }

snap("created")
g.start()
snap("start -> playing (fleet 55, iv=600000)")
print("OP  get_current_state_name=\(g.get_current_state_name())")

run(39, "0.61s: fleet wants_to_step")
print("SIG consume_step=\(g.fleet.consume_step() ? "true" : "false") (timer was >= interval)")

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

for i in 3..<55 { g.player_killed_invader(i) }
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

var g2 = Invaders.__create()
g2.start()
for _ in 0..<3 { g2.player_hit(); for _ in 0..<180 { g2.tick(1.0/64.0) } }
print("DEATH after 3 hits: st=\(g2.get_state()) lives=\(g2.get_lives()) player=\(g2.player.get_state())")

var g3 = Invaders.__create()
g3.start()
let d0 = g3.fleet.get_direction()
g3.fleet_reached_edge(); g3.tick(1.0/64.0)
let d1 = g3.fleet.get_direction()
g3.fleet_reached_edge(); g3.tick(1.0/64.0)
let d2 = g3.fleet.get_direction()
print("DIR bounces: start=\(d0) after1=\(d1) after2=\(d2)")
