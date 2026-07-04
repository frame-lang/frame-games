-- Shooter cross-language oracle — Lua driver. Mirrors run-oracle.mjs.
local M = require("shooter")
local Shooter = M.Shooter or Shooter
local Enemy = M.Enemy or Enemy

local DT = 1.0 / 64.0
local step = 0
local wavesBuilt = 0
local ef, bsingle, bspread, bspray = 0, 0, 0, 0
local g

local function pad(s, w)
  while #s < w do s = s .. " " end
  return s
end

local function buildWave()
  wavesBuilt = wavesBuilt + 1
  if wavesBuilt == 1 then
    g:add_enemy(Enemy._create(0, 2, 0.0, 100))
    g:add_enemy(Enemy._create(1, 3, 0.75, 150))
  else
    g:add_enemy(Enemy._create(wavesBuilt % 3, 1, 0.0, 10))
    g:add_enemy(Enemy._create((wavesBuilt + 1) % 3, 1, 0.0, 10))
  end
end

local function pump(n)
  for _ = 1, n do
    g:tick(DT)
    if g:should_spawn_wave() then g:consume_wave(); buildWave() end
    if g:should_spawn_boss() then g:consume_boss_spawn() end
    for e = 1, g:enemy_count() do
      local en = g.enemies[e]
      if en:wants_to_fire() then en:consume_fire(); ef = ef + 1 end
    end
    if g.boss:wants_to_fire_single() then g.boss:consume_fire(); bsingle = bsingle + 1 end
    if g.boss:wants_to_fire_spread() then g.boss:consume_fire(); bspread = bspread + 1 end
    if g.boss:wants_to_fire_spray()  then g.boss:consume_fire(); bspray = bspray + 1 end
    g:clear_dead_enemies()
  end
end

local function snap(label)
  local e0 = g:enemy_count() > 0 and g.enemies[1]:get_state() or "-"
  local e1 = g:enemy_count() > 1 and g.enemies[2]:get_state() or "-"
  print(string.format("%03d %s st=%s score=%4d lives=%d n=%d e0=%s e1=%s boss=%s bhp=%2d pl=%s fire[e=%d s=%d d=%d y=%d] waves=%d",
    step, pad(label, 30), pad(g:get_state(), 10),
    g:get_score(), g:get_lives(), g:enemy_count(),
    pad(e0, 8), pad(e1, 8), pad(g.boss:get_state(), 11), g.boss:get_hp(),
    pad(g.player:get_state(), 12), ef, bsingle, bspread, bspray, wavesBuilt))
  step = step + 1
end

local function run_n(n, label)
  pump(n)
  snap(string.format("pump x%d (%s)", n, label))
end

g = Shooter._create()
snap("created"); g:start(); snap("start -> playing")
run_n(129, "2.0s+: wave 1 spawns"); run_n(32, "0.5s: spawning -> active")
g:enemy_hit(0, 1); snap("e0 hit 1/2 (still active)")
g:enemy_hit(0, 1); snap("e0 hit 2/2 -> dying, +100")
run_n(26, "0.4s: e0 gone + CLEANED UP"); run_n(23, "e1 fire #1 (rate 0.75)"); run_n(48, "e1 fire #2")
g:player_hit(); snap("player hit -> exploding")
g:player_hit(); snap("player hit while exploding (no-op)")
run_n(64, "1.0s: lives-1 -> invulnerable")
g:player_hit(); snap("player hit while invuln (no-op)")
g:pause(); snap("pause during PLAYING (push)")
run_n(64, "1.0s paused: everything frozen")
g:resume(); snap("resume (pop -> playing)")
run_n(128, "2.0s: invuln over + wave 2")
g:enemy_hit(0, 99); snap("kill the old shooter e0 (+150)")
run_n(600, "rush: waves 3..6 spawn+decay"); run_n(600, "rush: waves 7..10 -> BOSS mid-pump")
snap("boss_fight (entered during rush)")
run_n(116, "boss p1: idle(1.8s) -> firing"); run_n(26, "p1 firing 0.4s -> idle (1 shot)")
g:boss_hit(10); g:boss_hit(10); g:boss_hit(10); snap("boss 90->60 (>59.4: still P1)")
g:boss_hit(10); snap("boss 60->50 <=59.4 -> PHASE 2")
g:pause(); snap("pause during BOSS FIGHT (push)")
run_n(64, "1.0s paused: boss frozen")
g:resume(); snap("resume (pop -> boss_fight)")
run_n(84, "p2: idle(1.3s) -> spread"); run_n(33, "p2 spread 0.5s -> idle (1 shot)")
g:boss_hit(21); snap("boss 50->29 <=29.7 -> PHASE 3")
run_n(39, "p3: idle(0.6s) -> spray"); run_n(52, "p3 spray 0.8s (~6 shots @0.12s)")
g:boss_hit(29); snap("boss 29->0 in P3 -> DYING")
run_n(200, "boss dying -> gone -> VICTORY")
snap("final")

local g2 = Shooter._create()
g2:start()
for _ = 1, 10 do
  for _ = 1, 129 do g2:tick(DT) end
  if g2:should_spawn_wave() then g2:consume_wave() end
end
for _ = 1, 65 do g2:tick(DT) end
print(string.format("Q00 quirk: state=%s boss=%s", g2:get_state(), g2.boss:get_state()))
g2:boss_hit(90)
print(string.format("Q01 quirk: one 90-dmg hit in P1 -> boss=%s hp=%d (phase two, not dying)", g2.boss:get_state(), g2.boss:get_hp()))
g2:boss_hit(1)
print(string.format("Q02 quirk: 1-dmg hit in P2 at 0hp -> boss=%s hp=%d (phase three)", g2.boss:get_state(), g2.boss:get_hp()))
g2:boss_hit(1)
print(string.format("Q03 quirk: 1-dmg hit in P3 -> boss=%s (finally dying)", g2.boss:get_state()))
