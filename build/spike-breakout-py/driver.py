from breakout import Breakout

DT = 1.0 / 64.0
step = 0
g = None

def mU(x): return round(x * 1000)
def padr(s, w):
    s = str(s); return s + " " * (w - len(s)) if len(s) < w else s
def padl(s, w):
    s = str(s); return " " * (w - len(s)) + s if len(s) < w else s
def snap(label):
    global step
    rp = padl(mU(g.ball_respawn_progress()), 4) if g.get_state() == "playing" else padl("-", 4)
    print(f"{step:03d} {padr(label, 34)} "
          f"st={padr(g.get_state(), 11)} sc={padl(g.get_score(), 4)} lv={g.get_lives()} lvl={g.get_level()} br={padl(g.bricks_remaining(), 2)} | "
          f"ball={padr(g.ball_state(), 9)} vx={padl(mU(g.ball_vx()), 6)} vy={padl(mU(g.ball_vy()), 6)} rp={rp}")
    step += 1
def run(n, label):
    for _ in range(n): g.tick(DT)
    snap(f"pump x{n} ({label})")

g = Breakout._create()
snap("created")
g.start()
snap("start -> playing, ball attached")
print(f"OP  get_current_state_name={g.get_current_state_name()}")

g.launch_ball(3.5, -4.25)
snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]")
g.wall_bounce_x()
snap("wall_bounce_x -> vx negated")
g.wall_bounce_y()
snap("wall_bounce_y -> vy negated")
g.paddle_hit(2.75, -5.5)
snap("paddle_hit -> set_velocity(2.75,-5.5)")

g.brick_hit(0)
snap("brick_hit(0): +10, vy flip, broken")
g.brick_hit(0)
g.brick_hit(999)
g.brick_hit(-1)
snap("brick_hit dead/oob: NO score change")
g.brick_hit(1)
g.brick_hit(2)
snap("brick_hit(1,2): +20")

g.pause()
snap("pause during PLAYING (push)")
run(64, "1.0s paused: ball frozen")
g.resume()
snap("resume (pop -> playing)")

g.ball_fell_off()
snap("ball_fell_off -> lives-1, ball lost")
run(64, "1.0s: respawn progress ~0.5")
run(63, "just before 2.0s: still lost")
run(1, "tick 2.0s: ball -> attached")

g.launch_ball(3.5, -4.25)
snap("re-launch (fresh in_flight)")
for i in range(3, 40): g.brick_hit(i)
snap("cleared wall -> level_clear (lvl 2)")
g.start()
snap("start -> playing, fresh wall of 40")

g.ball_fell_off()
snap("fell off -> lives 1")
g.ball_fell_off()
snap("fell off -> lives 0 -> game_over")
g.restart()
snap("restart -> attract (reset)")

g2 = Breakout._create()
g2.start()
g2.launch_ball(1.0, -1.0)
g2.ball_fell_off()
for _ in range(32): g2.tick(DT)
rp_before = round(g2.ball_respawn_progress() * 1000)
g2.pause()
for _ in range(128): g2.tick(DT)
g2.resume()
rp_after = round(g2.ball_respawn_progress() * 1000)
print(f"PAUSE respawn frozen: before={rp_before} after={rp_after} ball={g2.ball_state()} (paused ticks must not advance the ball)")

g3 = Breakout._create()
g3.start()
print(f"BRICK is_broken: fresh0={str(g3.is_brick_broken(0)).lower()} oobNeg={str(g3.is_brick_broken(-1)).lower()} oobBig={str(g3.is_brick_broken(999)).lower()} (expect false, true, true)")
