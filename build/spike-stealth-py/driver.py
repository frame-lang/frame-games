# Stealth cross-language oracle — Python driver. Mirrors run-oracle.mjs.
from stealth import Stealth

DT = 1.0 / 64.0
step = 0

def P(x, y):
    return {"x": float(x), "y": float(y)}

P1 = [P(0, 0), P(64, 0), P(64, 64)]
P2 = [P(0, 0), P(96, 0)]
P3 = [P(0, 0), P(96, 96)]
FAR = P(500, 500)
pos1 = FAR
pos2 = FAR
pos3 = FAR
g = None

def flags(gd):
    return f"{1 if gd.is_aware() else 0}{1 if gd.is_alerted() else 0}{1 if gd.should_move() else 0}"

def gcol(gd):
    t = gd.get_target()
    return f"{gd.get_state()}/{flags(gd)} tgt=({round(t['x'])},{round(t['y'])})"

def snap_of(m, label, tag):
    global step
    print(
        f"{tag}{step:03d} {label.ljust(38)} st={m.get_state().ljust(8)} "
        f"t={str(round(m.get_elapsed() * 64)).rjust(4)} by={str(m.get_caught_by()).rjust(2)} | "
        f"g1={gcol(m.guard1).ljust(28)} | g2={gcol(m.guard2).ljust(28)} | g3={gcol(m.guard3).ljust(28)}"
    )
    step += 1

def snap(label):
    snap_of(g, label, "")

def pump(n):
    for _ in range(n):
        g.tick(DT, pos1, pos2, pos3)

def run(n, label):
    pump(n)
    snap(f"pump x{n} ({label})")

g = Stealth._create()
snap("created (guards idle)")
g.start(P1, P2, P3)
snap("start -> playing, guards patrol wp0")
print(f"OP  get_current_state_name={g.get_current_state_name()}")

run(32, "0.5s: nobody arrives (FAR)")

pos1 = P(1, 1)
run(1, "g1 arrives wp0 -> tgt wp1")
pos1 = P(63, 1)
run(1, "g1 arrives wp1 -> tgt wp2")
pos1 = P(63, 63)
run(1, "g1 arrives wp2 -> WRAP tgt wp0")
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
pos3 = P(90, 90)
run(192, "3.0s search over -> NEAREST wp1")
pos3 = FAR

g.guard1.hear_sound(P(50, 50))
snap("g1 investigating again (push #2)")
g.guard1.spot_player(P(30, 30))
snap("spot DURING investigate -> alerted")
pos1 = P(29, 29)
run(1, "g1 arrives last_known -> searching")
pos1 = P(1, 1)
run(192, "3.0s search over -> patrolling")
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

esc = Stealth._create()
esc.start(P1, P2, P3)
for _ in range(64):
    esc.tick(DT, FAR, FAR, FAR)
esc.player_at_exit()
print(f"ESC escape path: st={esc.get_state()} by={esc.get_caught_by()} t={round(esc.get_elapsed() * 64)}")

g.start(P2, P3, P1)
snap("Q: start after restart: init DROPPED")

# ---- S-section: save/restore lockstep continuation ----
step = 0
s = Stealth._create()
s.start(P1, P2, P3)
for _ in range(32):
    s.tick(DT, P(1, 1), FAR, FAR)
s.guard1.hear_sound(P(50, 50))
s.guard2.spot_player(P(80, 80))
for _ in range(32):
    s.tick(DT, FAR, FAR, FAR)
snap_of(s, "SAVE POINT (push live, alerted, mid)", "S")
blob = s.save_state()
r = Stealth._create()
r.restore_state(blob)
snap_of(r, "restored copy, same tick", "S")
step -= 1
for n, label in [(64, "invest pops on both"), (224, "chase times out on both"), (192, "search resumes patrol on both")]:
    for _ in range(n):
        s.tick(DT, FAR, FAR, FAR)
    for _ in range(n):
        r.tick(DT, FAR, FAR, FAR)
    snap_of(s, f"orig  +{n} ({label})", "S")
    step -= 1
    snap_of(r, f"rest  +{n} ({label})", "S")

s.pause()
blob2 = s.save_state()
r2 = Stealth._create()
r2.restore_state(blob2)
r2.resume()
print(f"SP  paused save -> restore -> resume: st={r2.get_state()} t={round(r2.get_elapsed() * 64)}")
