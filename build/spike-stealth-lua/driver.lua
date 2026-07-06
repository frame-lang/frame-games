-- Stealth cross-language oracle — Lua driver. Mirrors run-oracle.mjs.
local M = require("stealth")
local Stealth = M.Stealth

local DT = 1.0 / 64.0
local step = 0

local function P(x, y) return { x = x + 0.0, y = y + 0.0 } end

local P1 = { P(0, 0), P(64, 0), P(64, 64) }
local P2 = { P(0, 0), P(96, 0) }
local P3 = { P(0, 0), P(96, 96) }
local FAR = P(500, 500)
local pos1, pos2, pos3 = FAR, FAR, FAR
local g

local function pad(s, w)
  s = tostring(s)
  while #s < w do s = s .. " " end
  return s
end
local function lpad(s, w)
  s = tostring(s)
  while #s < w do s = " " .. s end
  return s
end
local function rnd(x) return math.floor(x + 0.5) end

local function flags(gd)
  return string.format("%d%d%d",
    gd:is_aware() and 1 or 0, gd:is_alerted() and 1 or 0, gd:should_move() and 1 or 0)
end
local function gcol(gd)
  local t = gd:get_target()
  return string.format("%s/%s tgt=(%d,%d)", gd:get_state(), flags(gd), rnd(t.x), rnd(t.y))
end
local function snap_of(m, label, tag)
  print(string.format("%s%03d %s st=%s t=%s by=%s | g1=%s | g2=%s | g3=%s",
    tag, step, pad(label, 38), pad(m:get_state(), 8),
    lpad(rnd(m:get_elapsed() * 64), 4), lpad(m:get_caught_by(), 2),
    pad(gcol(m.guard1), 28), pad(gcol(m.guard2), 28), pad(gcol(m.guard3), 28)))
  step = step + 1
end
local function snap(label) snap_of(g, label, "") end
local function pump(n) for _ = 1, n do g:tick(DT, pos1, pos2, pos3) end end
local function run(n, label) pump(n); snap(string.format("pump x%d (%s)", n, label)) end

g = Stealth._create()
snap("created (guards idle)")
g:start(P1, P2, P3)
snap("start -> playing, guards patrol wp0")
print("OP  get_current_state_name=" .. g:get_current_state_name())

run(32, "0.5s: nobody arrives (FAR)")

pos1 = P(1, 1); run(1, "g1 arrives wp0 -> tgt wp1")
pos1 = P(63, 1); run(1, "g1 arrives wp1 -> tgt wp2")
pos1 = P(63, 63); run(1, "g1 arrives wp2 -> WRAP tgt wp0")
pos1 = FAR

g.guard1:hear_sound(P(50, 50))
g.guard2:hear_sound(P(10, 90))
snap("g1+g2 hear_sound -> investigating")
run(95, "1.484s: both still investigating")
run(1, "tick 96 = 1.5s: both pop$ -> patrol")

g.guard3:spot_player(P(80, 80))
snap("g3 spotted (patrolling->alerted)")
g.guard3:hear_sound(P(5, 5))
snap("g3 hear_sound while alerted: NO-OP")

run(200, "3.125s chasing (far, no arrive)")
g.guard3:spot_player(P(80, 80))
snap("re-spot at 3.125s: chase timer RESET")
run(200, "3.125s more: still alerted (reset)")
run(56, "chase clock hits 4.0s -> searching")
pos3 = P(90, 90); run(192, "3.0s search over -> NEAREST wp1")
pos3 = FAR

g.guard1:hear_sound(P(50, 50))
snap("g1 investigating again (push #2)")
g.guard1:spot_player(P(30, 30))
snap("spot DURING investigate -> alerted")
pos1 = P(29, 29); run(1, "g1 arrives last_known -> searching")
pos1 = P(1, 1); run(192, "3.0s search over -> patrolling")
g.guard1:hear_sound(P(40, 40))
snap("g1 push #3 (orphan below on stack)")
run(96, "1.5s: pop$ is LIFO -> patrolling")
pos1 = FAR

g.guard2:hear_sound(P(10, 90))
snap("g2 investigating (timer at 0)")
g:pause()
snap("pause during playing (push)")
run(192, "3.0s paused: g2 timer FROZEN")
g:resume()
snap("resume (pop -> playing)")
run(96, "1.5s after resume: g2 pops now")

g:guard_caught_player(1)
snap("g2 touches player -> caught")

g:restart()
snap("restart -> attract (counters reset)")

local esc = Stealth._create()
esc:start(P1, P2, P3)
for _ = 1, 64 do esc:tick(DT, FAR, FAR, FAR) end
esc:player_at_exit()
print(string.format("ESC escape path: st=%s by=%d t=%d", esc:get_state(), esc:get_caught_by(), rnd(esc:get_elapsed() * 64)))

g:start(P2, P3, P1)
snap("Q: start after restart: init DROPPED")

-- ---- S-section: save/restore lockstep continuation ----
step = 0
local s = Stealth._create()
s:start(P1, P2, P3)
for _ = 1, 32 do s:tick(DT, P(1, 1), FAR, FAR) end
s.guard1:hear_sound(P(50, 50))
s.guard2:spot_player(P(80, 80))
for _ = 1, 32 do s:tick(DT, FAR, FAR, FAR) end
snap_of(s, "SAVE POINT (push live, alerted, mid)", "S")
local blob = s:save_state()
local r = Stealth._create()
r:restore_state(blob)
snap_of(r, "restored copy, same tick", "S")
step = step - 1
local plan = { { 64, "invest pops on both" }, { 224, "chase times out on both" }, { 192, "search resumes patrol on both" } }
for _, pr in ipairs(plan) do
  local n, label = pr[1], pr[2]
  for _ = 1, n do s:tick(DT, FAR, FAR, FAR) end
  for _ = 1, n do r:tick(DT, FAR, FAR, FAR) end
  snap_of(s, string.format("orig  +%d (%s)", n, label), "S")
  step = step - 1
  snap_of(r, string.format("rest  +%d (%s)", n, label), "S")
end

s:pause()
local blob2 = s:save_state()
local r2 = Stealth._create()
r2:restore_state(blob2)
r2:resume()
print(string.format("SP  paused save -> restore -> resume: st=%s t=%d", r2:get_state(), rnd(r2:get_elapsed() * 64)))
