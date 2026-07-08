local M = require("breakout")
local Breakout = M.Breakout
local DT = 1.0 / 64.0
local step = 0
local g
local function mU(x) return math.floor(x * 1000 + 0.5) end
local function padr(s, w) s = tostring(s); while #s < w do s = s .. " " end return s end
local function padl(s, w) s = tostring(s); while #s < w do s = " " .. s end return s end
local function snap(label)
  local rp = (g:get_state() == "playing") and padl(mU(g:ball_respawn_progress()), 4) or padl("-", 4)
  print(string.format("%03d %s st=%s sc=%s lv=%d lvl=%d br=%s | ball=%s vx=%s vy=%s rp=%s",
    step, padr(label, 34), padr(g:get_state(), 11), padl(g:get_score(), 4), g:get_lives(), g:get_level(),
    padl(g:bricks_remaining(), 2), padr(g:ball_state(), 9), padl(mU(g:ball_vx()), 6), padl(mU(g:ball_vy()), 6), rp))
  step = step + 1
end
local function run(n, label) for _ = 1, n do g:tick(DT) end snap(string.format("pump x%d (%s)", n, label)) end

g = Breakout._create()
snap("created")
g:start()
snap("start -> playing, ball attached")
print("OP  get_current_state_name=" .. g:get_current_state_name())
g:launch_ball(3.5, -4.25)
snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]")
g:wall_bounce_x()
snap("wall_bounce_x -> vx negated")
g:wall_bounce_y()
snap("wall_bounce_y -> vy negated")
g:paddle_hit(2.75, -5.5)
snap("paddle_hit -> set_velocity(2.75,-5.5)")
g:brick_hit(0)
snap("brick_hit(0): +10, vy flip, broken")
g:brick_hit(0); g:brick_hit(999); g:brick_hit(-1)
snap("brick_hit dead/oob: NO score change")
g:brick_hit(1); g:brick_hit(2)
snap("brick_hit(1,2): +20")
g:pause()
snap("pause during PLAYING (push)")
run(64, "1.0s paused: ball frozen")
g:resume()
snap("resume (pop -> playing)")
g:ball_fell_off()
snap("ball_fell_off -> lives-1, ball lost")
run(64, "1.0s: respawn progress ~0.5")
run(63, "just before 2.0s: still lost")
run(1, "tick 2.0s: ball -> attached")
g:launch_ball(3.5, -4.25)
snap("re-launch (fresh in_flight)")
for i = 3, 39 do g:brick_hit(i) end
snap("cleared wall -> level_clear (lvl 2)")
g:start()
snap("start -> playing, fresh wall of 40")
g:ball_fell_off()
snap("fell off -> lives 1")
g:ball_fell_off()
snap("fell off -> lives 0 -> game_over")
g:restart()
snap("restart -> attract (reset)")

local g2 = Breakout._create()
g2:start()
g2:launch_ball(1.0, -1.0)
g2:ball_fell_off()
for _ = 1, 32 do g2:tick(DT) end
local rp_before = math.floor(g2:ball_respawn_progress() * 1000 + 0.5)
g2:pause()
for _ = 1, 128 do g2:tick(DT) end
g2:resume()
local rp_after = math.floor(g2:ball_respawn_progress() * 1000 + 0.5)
print(string.format("PAUSE respawn frozen: before=%d after=%d ball=%s (paused ticks must not advance the ball)", rp_before, rp_after, g2:ball_state()))

local g3 = Breakout._create()
g3:start()
print(string.format("BRICK is_broken: fresh0=%s oobNeg=%s oobBig=%s (expect false, true, true)",
  tostring(g3:is_brick_broken(0)), tostring(g3:is_brick_broken(-1)), tostring(g3:is_brick_broken(999))))
