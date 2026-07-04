-- Asteroids — LÖVE (Lua) host for the Frame AsteroidsGame controller. Same FSM
-- as the other ports (asteroids.lua, generated from asteroids.flua); this is
-- the engine layer: love.update/draw/keypressed, love.graphics rendering, and
-- the four ShipHost callbacks. Field indices are 1-based to match the FSM.
--
-- Note: no live-state publish here — love.js (emscripten LÖVE) doesn't expose a
-- JS bridge for the in-wasm Lua, so the site's FSM diagram panel won't live-
-- update for this port (the game itself plays fully). An honest engine limit.
local asteroids = require("asteroids")

local COURT = { x = 800, y = 600 }

local COL_SHIP   = { 0x8a/255, 0xb4/255, 0xf8/255 }
local COL_ROCK   = { 0x9a/255, 0xa4/255, 0xb8/255 }
local COL_BULLET = { 1, 1, 1 }
local COL_FLAME  = { 1, 0.68, 0.26 }
local COL_TEXT   = { 1, 1, 1 }

local SHIP_THRUST = 240
local SHIP_ROT    = 4
local SHIP_MAX    = 320
local SHIP_DRAG   = 0.5
local SHIP_SIZE   = 14
local BULLET_SPEED = 500
local BULLET_LIFE  = 1.2
local BULLET_SIZE  = 2

local fsm, host
local ship_pos, ship_vel, ship_angle
local bullets = {}
local hudFont, centerFont

-- ── vector helpers ({x,y} tables, matching the FSM) ──
local function vadd(a, b) return { x = a.x + b.x, y = a.y + b.y } end
local function vscale(a, s) return { x = a.x * s, y = a.y * s } end
local function vlen(a) return math.sqrt(a.x * a.x + a.y * a.y) end
local function vdist(a, b) return math.sqrt((a.x-b.x)^2 + (a.y-b.y)^2) end
local function wrap(p)
    if p.x < 0 then p.x = p.x + COURT.x end
    if p.x > COURT.x then p.x = p.x - COURT.x end
    if p.y < 0 then p.y = p.y + COURT.y end
    if p.y > COURT.y then p.y = p.y - COURT.y end
end
local function thrust_held() return love.keyboard.isDown("up", "w") end

function love.load()
    math.randomseed(os.time and os.time() or 1)
    hudFont = love.graphics.newFont(18)
    centerFont = love.graphics.newFont(28)
    love.graphics.setBackgroundColor(0, 0, 0)

    ship_pos = { x = COURT.x / 2, y = COURT.y / 2 }
    ship_vel = { x = 0, y = 0 }
    ship_angle = -math.pi / 2

    host = {
        warp_out = function()
            ship_pos = { x = math.random() * COURT.x, y = math.random() * COURT.y }
            ship_vel = { x = 0, y = 0 }
        end,
        warp_in = function() end,
        spawn_explosion = function() end,
        reset_ship = function()
            ship_pos = { x = COURT.x / 2, y = COURT.y / 2 }
            ship_vel = { x = 0, y = 0 }
            ship_angle = -math.pi / 2
            for _ = 1, #bullets do fsm:bullet_expired() end
            bullets = {}
        end,
    }
    fsm = asteroids.AsteroidsGame._create(host, 2)
    host.reset_ship()
end

local function try_fire()
    fsm.ship:fire()
    local dir = { x = math.cos(ship_angle), y = math.sin(ship_angle) }
    bullets[#bullets + 1] = {
        pos = vadd(ship_pos, vscale(dir, SHIP_SIZE)),
        vel = vadd(vscale(dir, BULLET_SPEED), ship_vel),
        life = 0,
    }
    fsm:bullet_fired()
end

local function handle_input(dt)
    if not fsm.ship:is_visible() then return end
    if love.keyboard.isDown("left", "a") then ship_angle = ship_angle - SHIP_ROT * dt end
    if love.keyboard.isDown("right", "d") then ship_angle = ship_angle + SHIP_ROT * dt end
    local ss = fsm.ship:get_current_state_name()
    if (ss == "Alive" or ss == "Respawning") and thrust_held() then
        ship_vel = vadd(ship_vel, vscale({ x = math.cos(ship_angle), y = math.sin(ship_angle) }, SHIP_THRUST * dt))
        if vlen(ship_vel) > SHIP_MAX then ship_vel = vscale(ship_vel, SHIP_MAX / vlen(ship_vel)) end
    end
    if fsm.ship:can_fire() and fsm:get_bullets_in_flight() < fsm:get_max_bullets()
       and love.keyboard.isDown("space") then
        try_fire()
    end
end

local function update_ship(dt)
    if not fsm.ship:is_visible() then return end
    ship_vel = vscale(ship_vel, 1 - SHIP_DRAG * dt)
    ship_pos = vadd(ship_pos, vscale(ship_vel, dt))
    wrap(ship_pos)
end

local function update_bullets(dt)
    for i = #bullets, 1, -1 do
        local b = bullets[i]
        b.pos = vadd(b.pos, vscale(b.vel, dt))
        b.life = b.life + dt
        wrap(b.pos)
        if b.life >= BULLET_LIFE then
            table.remove(bullets, i)
            fsm:bullet_expired()
        end
    end
end

local function check_collisions()
    local total = fsm.field:count()
    for bi = #bullets, 1, -1 do
        local bp = bullets[bi].pos
        local hit = 0
        for i = 1, total do
            if fsm.field:is_alive(i) and vdist(fsm.field:position(i), bp) < fsm.field:radius_of(i) then
                hit = i
                break
            end
        end
        if hit > 0 then
            fsm:bullet_hit_asteroid(hit)
            table.remove(bullets, bi)
            fsm:bullet_expired()
        end
    end
    if fsm.ship:can_be_hit() then
        for i = 1, total do
            if fsm.field:is_alive(i) and vdist(fsm.field:position(i), ship_pos) < fsm.field:radius_of(i) + SHIP_SIZE * 0.6 then
                fsm:ship_hit_asteroid(i)
                break
            end
        end
    end
end

function love.update(dt)
    local state = fsm:get_current_state_name()
    if state ~= "Attract" and state ~= "GameOver" and not fsm:is_paused() then
        handle_input(dt)
        fsm:tick(dt, COURT)
        update_ship(dt)
        update_bullets(dt)
        check_collisions()
    end
end

function love.keypressed(key)
    local state = fsm:get_current_state_name()
    if state == "Attract" then
        fsm:start()
        bullets = {}
        return
    end
    if state == "GameOver" then
        if key == "r" then fsm:restart(); fsm:start(); bullets = {} end
        return
    end
    if key == "p" then
        if fsm:is_paused() then fsm:resume() else fsm:pause() end
        return
    end
    if fsm:is_paused() then return end
    if key == "h" and fsm.ship:can_hyperspace() then fsm:ship_hyperspace() end
end

-- ── rendering ──
local function draw_ship(at, ang)
    local nose  = vadd(at, vscale({ x = math.cos(ang),       y = math.sin(ang) },       SHIP_SIZE))
    local left  = vadd(at, vscale({ x = math.cos(ang + 2.5), y = math.sin(ang + 2.5) }, SHIP_SIZE))
    local right = vadd(at, vscale({ x = math.cos(ang - 2.5), y = math.sin(ang - 2.5) }, SHIP_SIZE))
    love.graphics.setColor(COL_SHIP)
    love.graphics.polygon("line", nose.x, nose.y, left.x, left.y, right.x, right.y)
    if thrust_held() then
        local ss = fsm.ship:get_current_state_name()
        if ss == "Alive" or ss == "Respawning" then
            local tb = vscale(vadd(left, right), 0.5)
            local tt = vadd(at, vscale({ x = math.cos(ang), y = math.sin(ang) }, -SHIP_SIZE * 1.4))
            love.graphics.setColor(COL_FLAME)
            love.graphics.line(tb.x, tb.y, tt.x, tt.y)
        end
    end
end

local function draw_explosion(at)
    love.graphics.setColor(COL_SHIP)
    for i = 0, 7 do
        local t = i / 8 * math.pi * 2
        love.graphics.line(at.x + math.cos(t) * 4, at.y + math.sin(t) * 4,
                           at.x + math.cos(t) * 14, at.y + math.sin(t) * 14)
    end
end

function love.draw()
    local state = fsm:get_current_state_name()
    local total = fsm.field:count()
    love.graphics.setColor(COL_ROCK)
    for i = 1, total do
        if fsm.field:is_alive(i) then
            local p = fsm.field:position(i)
            love.graphics.circle("line", p.x, p.y, fsm.field:radius_of(i))
        end
    end
    love.graphics.setColor(COL_BULLET)
    for i = 1, #bullets do
        love.graphics.circle("fill", bullets[i].pos.x, bullets[i].pos.y, BULLET_SIZE)
    end
    if state ~= "Attract" and state ~= "GameOver" and fsm.ship:is_visible() then
        local ss = fsm.ship:get_current_state_name()
        if ss == "Exploding" then
            draw_explosion(ship_pos)
        else
            local visible = true
            if ss == "Respawning" then visible = math.floor(love.timer.getTime() * 10) % 2 == 0 end
            if visible then draw_ship(ship_pos, ship_angle) end
        end
    end

    -- HUD + centered messages
    love.graphics.setColor(COL_TEXT)
    love.graphics.setFont(hudFont)
    love.graphics.print(string.format(
        "SCORE  %05d     LIVES  %d     WAVE  %d     DIFF  %d     WARP  %d",
        fsm:get_score(), fsm:get_lives(), fsm:get_wave(), fsm:get_difficulty(),
        fsm.ship:get_hyperspaces_remaining()), 12, 8)

    local msg = nil
    if state == "Attract" then
        msg = "A S T E R O I D S\n\nPress any key to start\n(H hyperspace · P pause)"
    elseif state == "WaveClear" then msg = "WAVE CLEAR"
    elseif state == "Paused" then msg = "PAUSED"
    elseif state == "GameOver" then msg = "GAME OVER\n\nPress R to restart"
    end
    if msg then
        love.graphics.setFont(centerFont)
        love.graphics.printf(msg, 0, COURT.y * 0.4, COURT.x, "center")
    end
end
