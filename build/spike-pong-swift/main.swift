import Foundation

var step = 0
var g = Pong.__create()

func bU(_ x: Bool) -> Int { return x ? 1 : 0 }
func padr(_ s: String, _ w: Int) -> String { var o = s; while o.count < w { o += " " }; return o }
func padl(_ o: Any, _ w: Int) -> String { var s = "\(o)"; while s.count < w { s = " " + s }; return s }
func st3(_ n: Int) -> String { var s = "\(n)"; while s.count < 3 { s = "0" + s }; return s }

func snap(_ label: String) {
    print("\(st3(step)) \(padr(label,38)) st=\(padr(g.get_current_state_name(),12)) sl=\(padl(g.get_score_left(),2)) sr=\(padl(g.get_score_right(),2)) serve=\(padl(g.get_serve_direction(),2)) play=\(bU(g.is_playing())) winner=\(padr(g.get_winner(),6))")
    step += 1
}
func pointRight(_ x: Pong) { x.launch(); x.ball_out_left() }
func pointLeft(_ x: Pong) { x.launch(); x.ball_out_right() }

snap("created (AttractMode / 0-0)")
print("OP  get_current_state_name=\(g.get_current_state_name()) get_winning_score=\(g.get_winning_score())")

g.start(); snap("start -> Serving")
g.pause(); snap("pause during Serving (push)")
g.resume(); snap("resume (pop -> Serving)")
g.launch(); snap("launch -> InPlay (playing)")
g.pause(); snap("pause during InPlay (push)")
g.resume(); snap("resume (pop -> InPlay)")
g.ball_out_left(); snap("ball_out_left -> right+1, serve -1")
pointLeft(g); snap("pointLeft -> left+1, serve +1")
for _ in 0..<9 { pointRight(g) }
snap("right at 10 (one short of 11)")
pointRight(g); snap("right scores 11 -> GameOver [right wins]")
print("WIN winner=\(g.get_winner()) playing=\(bU(g.is_playing())) sl=\(g.get_score_left()) sr=\(g.get_score_right())")
g.restart(); snap("restart -> AttractMode (reset)")

var g2 = Pong.__create()
g2.start()
for _ in 0..<11 { pointLeft(g2) }
print("MIRROR left win: st=\(g2.get_current_state_name()) winner=\(g2.get_winner()) sl=\(g2.get_score_left()) serve=\(g2.get_serve_direction())")
