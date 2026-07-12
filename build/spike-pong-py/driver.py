from pong import Pong

step = 0
g = None

def bU(x): return 1 if x else 0
def padr(s, w):
    s = str(s); return s + " " * (w - len(s)) if len(s) < w else s
def padl(s, w):
    s = str(s); return " " * (w - len(s)) + s if len(s) < w else s
def snap(label):
    global step
    print(f"{step:03d} {padr(label, 38)} "
          f"st={padr(g.get_current_state_name(), 12)} sl={padl(g.get_score_left(), 2)} sr={padl(g.get_score_right(), 2)} "
          f"serve={padl(g.get_serve_direction(), 2)} play={bU(g.is_playing())} winner={padr(g.get_winner(), 6)}")
    step += 1
def pointRight(x=None): (x or g).launch(); (x or g).ball_out_left()
def pointLeft(x=None): (x or g).launch(); (x or g).ball_out_right()

g = Pong._create()
snap("created (AttractMode / 0-0)")
print(f"OP  get_current_state_name={g.get_current_state_name()} get_winning_score={g.get_winning_score()}")

g.start(); snap("start -> Serving")
g.pause(); snap("pause during Serving (push)")
g.resume(); snap("resume (pop -> Serving)")
g.launch(); snap("launch -> InPlay (playing)")
g.pause(); snap("pause during InPlay (push)")
g.resume(); snap("resume (pop -> InPlay)")
g.ball_out_left(); snap("ball_out_left -> right+1, serve -1")
pointLeft(); snap("pointLeft -> left+1, serve +1")
for _ in range(9): pointRight()
snap("right at 10 (one short of 11)")
pointRight(); snap("right scores 11 -> GameOver [right wins]")
print(f"WIN winner={g.get_winner()} playing={bU(g.is_playing())} sl={g.get_score_left()} sr={g.get_score_right()}")
g.restart(); snap("restart -> AttractMode (reset)")

g2 = Pong._create()
g2.start()
for _ in range(11): pointLeft(g2)
print(f"MIRROR left win: st={g2.get_current_state_name()} winner={g2.get_winner()} sl={g2.get_score_left()} serve={g2.get_serve_direction()}")
