import Foundation

let DT = 1.0 / 64.0
var step = 0
var g = Platformer.__create()

func mU(_ x: Double) -> Int { return Int((x * 1000).rounded()) }
func bU(_ x: Bool) -> Int { return x ? 1 : 0 }
func padr(_ s: String, _ w: Int) -> String { var o = s; while o.count < w { o += " " }; return o }
func padl(_ o: Any, _ w: Int) -> String { var s = "\(o)"; while s.count < w { s = " " + s }; return s }
func st3(_ n: Int) -> String { var s = "\(n)"; while s.count < 3 { s = "0" + s }; return s }

func snap(_ label: String) {
    print("\(st3(step)) \(padr(label,40)) st=\(padr(g.get_current_state_name(),7)) loco=\(padr(g.locomotion_state(),8)) form=\(padr(g.form(),5)) vx=\(padl(mU(g.wants_velocity_x()),7)) face=\(padl(g.facing(),2)) gnd=\(bU(g.is_grounded())) air=\(bU(g.is_in_air())) jimp=\(bU(g.wants_jump_impulse())) hbox=\(padl(g.hit_box_height(),2)) shoot=\(bU(g.can_shoot())) paused=\(bU(g.is_paused()))")
    step += 1
}
func run(_ n: Int, _ label: String) { for _ in 0..<n { g.tick(DT) }; snap("pump x\(n) (\(label))") }

snap("created (Playing / idle / small)")
print("OP  get_current_state_name=\(g.get_current_state_name())")

g.press_right(); snap("press_right -> walking, face+1")
g.press_sprint(); snap("press_sprint -> running (vx 260)")
g.release_sprint(); snap("release_sprint -> walking (vx 140)")
g.press_left(); snap("press_left -> face-1, vx -140")
g.release_horizontal(); snap("release_horizontal -> idle")

g.press_jump(); snap("press_jump -> jumping, jimp=1")
g.consume_jump_impulse(); snap("consume_jump_impulse -> jimp=0")
g.press_right(); snap("press_right in air -> vx 180 (air_speed)")
run(22, "0.34s held: still jumping")
run(1, "tick 23 (0.35s) -> falling")

g.ground_contact(); snap("ground_contact -> landing")
run(5, "0.078s: still landing")
run(1, "tick 6 (0.08s): input_x!=0 -> walking")
g.release_horizontal(); snap("release_horizontal -> idle")

g.press_jump(); snap("press_jump -> jumping (fresh)")
g.release_jump(); snap("release_jump -> timer frozen")
run(40, "0.625s released: STILL jumping (no auto-fall)")
g.ground_contact(); snap("ground_contact -> landing (input_x=0)")
run(6, "0.08s: input_x==0 -> idle")

g.left_ground(); snap("left_ground -> falling (walked off)")
g.ground_contact(); snap("ground_contact -> landing")
run(6, "recover -> idle")

g.pickup_mushroom(); snap("pickup_mushroom -> big (hbox 48)")
g.pickup_flower(); snap("pickup_flower -> fiery (can_shoot 1)")
g.take_damage(); snap("take_damage -> big [ret-then-transition]")
g.take_damage(); snap("take_damage -> small (hbox 24)")
g.take_damage(); snap("take_damage in small -> no transition")
g.pickup_flower(); snap("pickup_flower from small -> fiery")

print("RET take_damage(fiery)=\(bU(g.take_damage())) form_now=\(g.form()) (expect 1 / big)")
print("RET take_damage(big)=\(bU(g.take_damage())) form_now=\(g.form()) (expect 1 / small)")
print("RET take_damage(small)=\(bU(g.take_damage())) form_now=\(g.form()) (expect 0 / small)")

g.pickup_mushroom(); g.press_right(); snap("re-arm: big + walking before pause")
g.pause(); snap("pause -> Paused (push), paused=1")
run(64, "1.0s paused: locomotion frozen")
g.resume(); snap("resume -> Playing (pop), paused=0")

var g2 = Platformer.__create()
g2.press_right(); g2.press_sprint()
let loco_before = g2.locomotion_state()
g2.pickup_mushroom(); g2.pickup_flower()
let loco_after = g2.locomotion_state()
print("ORTHO loco stable across powerups: before=\(loco_before) after=\(loco_after) form=\(g2.form()) (expect running/running/fiery)")

var g3 = Platformer.__create()
g3.press_jump()
for _ in 0..<10 { g3.tick(DT) }
g3.pause()
for _ in 0..<128 { g3.tick(DT) }
g3.resume()
let loco_resumed = g3.locomotion_state()
for _ in 0..<12 { g3.tick(DT) }
let still_jumping = g3.locomotion_state()
g3.tick(DT)
let now_falling = g3.locomotion_state()
print("PAUSE ticks dropped: resumed=\(loco_resumed) at22=\(still_jumping) at23=\(now_falling) (expect jumping/jumping/falling)")
