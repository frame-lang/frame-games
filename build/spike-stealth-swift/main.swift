// Stealth cross-language oracle — Swift driver. Mirrors run-oracle.mjs.
import Foundation

let DT = 1.0 / 64.0
var step = 0
var g = Stealth.__create()
let FAR = Vector2(500, 500)
var pos1 = FAR, pos2 = FAR, pos3 = FAR

func P(_ x: Double, _ y: Double) -> Vector2 { return Vector2(x, y) }
func pad(_ s: String, _ w: Int) -> String { var o = s; while o.count < w { o += " " }; return o }
func flags(_ gd: Guard) -> String {
    return "\(gd.is_aware() ? 1 : 0)\(gd.is_alerted() ? 1 : 0)\(gd.should_move() ? 1 : 0)"
}
func gcol(_ gd: Guard) -> String {
    let t = gd.get_target()
    return "\(gd.get_state())/\(flags(gd)) tgt=(\(Int(t.x.rounded())),\(Int(t.y.rounded())))"
}
func snapOf(_ m: Stealth, _ label: String, _ tag: String) {
    let tks = Int((m.get_elapsed() * 64).rounded())
    print("\(tag)\(String(format: "%03d", step)) \(pad(label, 38)) st=\(pad(m.get_state(), 8)) " +
          "t=\(String(format: "%4d", tks)) by=\(String(format: "%2d", m.get_caught_by())) | " +
          "g1=\(pad(gcol(m.guard1), 28)) | g2=\(pad(gcol(m.guard2), 28)) | g3=\(pad(gcol(m.guard3), 28))")
    step += 1
}
func snap(_ label: String) { snapOf(g, label, "") }
func pump(_ n: Int) { for _ in 0..<n { g.tick(DT, pos1, pos2, pos3) } }
func run(_ n: Int, _ label: String) { pump(n); snap("pump x\(n) (\(label))") }

let P1 = [P(0, 0), P(64, 0), P(64, 64)]
let P2 = [P(0, 0), P(96, 0)]
let P3 = [P(0, 0), P(96, 96)]

snap("created (guards idle)")
g.start(P1, P2, P3)
snap("start -> playing, guards patrol wp0")
print("OP  get_current_state_name=\(g.get_current_state_name())")

run(32, "0.5s: nobody arrives (FAR)")
pos1 = P(1, 1); run(1, "g1 arrives wp0 -> tgt wp1")
pos1 = P(63, 1); run(1, "g1 arrives wp1 -> tgt wp2")
pos1 = P(63, 63); run(1, "g1 arrives wp2 -> WRAP tgt wp0")
pos1 = FAR

g.guard1.hear_sound(P(50, 50))
g.guard2.hear_sound(P(10, 90))
snap("g1+g2 hear_sound -> investigating")
run(95, "1.484s: both still investigating")
run(1, "tick 96 = 1.5s: both pop$ -> patrol")

g.guard3.spot_player(P(80, 80))
snap("g3 spotted (patrolling->alerted)")
g.guard3.hear_sound(P(5, 5))
snap("g3 hear_sound while alerted: NO-OP")

run(200, "3.125s chasing (far, no arrive)")
g.guard3.spot_player(P(80, 80))
snap("re-spot at 3.125s: chase timer RESET")
run(200, "3.125s more: still alerted (reset)")
run(56, "chase clock hits 4.0s -> searching")
pos3 = P(90, 90); run(192, "3.0s search over -> NEAREST wp1")
pos3 = FAR

g.guard1.hear_sound(P(50, 50))
snap("g1 investigating again (push #2)")
g.guard1.spot_player(P(30, 30))
snap("spot DURING investigate -> alerted")
pos1 = P(29, 29); run(1, "g1 arrives last_known -> searching")
pos1 = P(1, 1); run(192, "3.0s search over -> patrolling")
g.guard1.hear_sound(P(40, 40))
snap("g1 push #3 (orphan below on stack)")
run(96, "1.5s: pop$ is LIFO -> patrolling")
pos1 = FAR

g.guard2.hear_sound(P(10, 90))
snap("g2 investigating (timer at 0)")
g.pause()
snap("pause during playing (push)")
run(192, "3.0s paused: g2 timer FROZEN")
g.resume()
snap("resume (pop -> playing)")
run(96, "1.5s after resume: g2 pops now")

g.guard_caught_player(1)
snap("g2 touches player -> caught")

g.restart()
snap("restart -> attract (counters reset)")

let esc = Stealth.__create()
esc.start(P1, P2, P3)
for _ in 0..<64 { esc.tick(DT, FAR, FAR, FAR) }
esc.player_at_exit()
print("ESC escape path: st=\(esc.get_state()) by=\(esc.get_caught_by()) t=\(Int((esc.get_elapsed() * 64).rounded()))")

g.start(P2, P3, P1)
snap("Q: start after restart: init DROPPED")

step = 0
let s = Stealth.__create()
s.start(P1, P2, P3)
for _ in 0..<32 { s.tick(DT, P(1, 1), FAR, FAR) }
s.guard1.hear_sound(P(50, 50))
s.guard2.spot_player(P(80, 80))
for _ in 0..<32 { s.tick(DT, FAR, FAR, FAR) }
snapOf(s, "SAVE POINT (push live, alerted, mid)", "S")
let blob = s.save_state()
let r = Stealth.__create()
r.restore_state(blob)
snapOf(r, "restored copy, same tick", "S")
step -= 1
let plan: [(Int, String)] = [(64, "invest pops on both"), (224, "chase times out on both"), (192, "search resumes patrol on both")]
for (n, label) in plan {
    for _ in 0..<n { s.tick(DT, FAR, FAR, FAR) }
    for _ in 0..<n { r.tick(DT, FAR, FAR, FAR) }
    snapOf(s, "orig  +\(n) (\(label))", "S")
    step -= 1
    snapOf(r, "rest  +\(n) (\(label))", "S")
}
s.pause()
let blob2 = s.save_state()
let r2 = Stealth.__create()
r2.restore_state(blob2)
r2.resume()
print("SP  paused save -> restore -> resume: st=\(r2.get_state()) t=\(Int((r2.get_elapsed() * 64).rounded()))")
