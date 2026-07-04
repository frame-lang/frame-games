# Asteroids — Ruby host for the Frame AsteroidsGame controller. Same FSM as the
# other ports (asteroids.rb); this is the engine layer, written in Ruby and run
# in the browser by ruby.wasm. Rendering is HTML canvas 2D via the `js` interop
# library (ctx.call(:method, ...)); input + the rAF loop + live-state all go
# through JS.global. The four ShipHost callbacks are plain Ruby methods.
require "js"

COURT_W = 800
COURT_H = 600
TWO_PI  = Math::PI * 2

COL_SHIP   = "#8ab4f8"
COL_ROCK   = "#9aa4b8"
COL_BULLET = "#ffffff"
COL_FLAME  = "#ffad42"
COL_TEXT   = "#ffffff"

SHIP_THRUST = 240.0
SHIP_ROT    = 4.0
SHIP_MAX    = 320.0
SHIP_DRAG   = 0.5
SHIP_SIZE   = 14.0
BULLET_SPEED = 500.0
BULLET_LIFE  = 1.2
BULLET_SIZE  = 2.4

class Game
  attr_reader :fsm

  def initialize(canvas)
    @canvas = canvas
    @ctx = canvas.call(:getContext, "2d")
    @fsm = AsteroidsGame._create(self, 2)
    @court = Vec2.new(COURT_W, COURT_H)
    @ship_pos = Vec2.new(COURT_W / 2.0, COURT_H / 2.0)
    @ship_vel = Vec2.new(0.0, 0.0)
    @ship_angle = -Math::PI / 2
    @bullets = []          # each: [pos, vel, life]
    @keys = {}
    @last_pub = ""
    @chan = make_channel
    reset_ship
  end

  def make_channel
    JS.global[:BroadcastChannel].new("frame-games:state:asteroids")
  rescue StandardError
    nil
  end

  # ── ShipHost ──
  def warp_out
    @ship_pos = Vec2.new(rand * COURT_W, rand * COURT_H)
    @ship_vel = Vec2.new(0.0, 0.0)
  end

  def warp_in; end
  def spawn_explosion; end

  def reset_ship
    @ship_pos = Vec2.new(COURT_W / 2.0, COURT_H / 2.0)
    @ship_vel = Vec2.new(0.0, 0.0)
    @ship_angle = -Math::PI / 2
    @bullets.each { @fsm.bullet_expired }
    @bullets = []
  end

  # ── input ──
  def thrust_held
    @keys["ArrowUp"] || @keys["KeyW"]
  end

  def on_keydown(code)
    state = @fsm.get_current_state_name
    if state == "Attract"
      @fsm.start
      @bullets = []
      return
    end
    if state == "GameOver"
      if code == "KeyR"
        @fsm.restart
        @fsm.start
        @bullets = []
      end
      return
    end
    if code == "KeyP"
      @fsm.is_paused ? @fsm.resume : @fsm.pause
      return
    end
    return if @fsm.is_paused
    if code == "KeyH" && @fsm.ship.can_hyperspace
      @fsm.ship_hyperspace
    end
  end

  # ── frame ──
  def update(dt)
    state = @fsm.get_current_state_name
    return if state == "Attract" || state == "GameOver" || @fsm.is_paused
    handle_input(dt)
    @fsm.tick(dt, @court)
    update_ship(dt)
    update_bullets(dt)
    check_collisions
  end

  def handle_input(dt)
    return unless @fsm.ship.is_visible
    @ship_angle -= SHIP_ROT * dt if @keys["ArrowLeft"] || @keys["KeyA"]
    @ship_angle += SHIP_ROT * dt if @keys["ArrowRight"] || @keys["KeyD"]
    ss = @fsm.ship.get_current_state_name
    if (ss == "Alive" || ss == "Respawning") && thrust_held
      @ship_vel = @ship_vel + Vec2.new(Math.cos(@ship_angle), Math.sin(@ship_angle)) * (SHIP_THRUST * dt)
      @ship_vel = @ship_vel * (SHIP_MAX / @ship_vel.length) if @ship_vel.length > SHIP_MAX
    end
    if @fsm.ship.can_fire && @fsm.get_bullets_in_flight < @fsm.get_max_bullets && @keys["Space"]
      try_fire
    end
  end

  def try_fire
    @fsm.ship.fire
    d = Vec2.new(Math.cos(@ship_angle), Math.sin(@ship_angle))
    @bullets.push([@ship_pos + d * SHIP_SIZE, d * BULLET_SPEED + @ship_vel, 0.0])
    @fsm.bullet_fired
  end

  def wrap(p)
    p.x += COURT_W if p.x < 0
    p.x -= COURT_W if p.x > COURT_W
    p.y += COURT_H if p.y < 0
    p.y -= COURT_H if p.y > COURT_H
  end

  def update_ship(dt)
    return unless @fsm.ship.is_visible
    @ship_vel = @ship_vel * (1.0 - SHIP_DRAG * dt)
    @ship_pos = @ship_pos + @ship_vel * dt
    wrap(@ship_pos)
  end

  def update_bullets(dt)
    (@bullets.length - 1).downto(0) do |i|
      b = @bullets[i]
      b[0] = b[0] + b[1] * dt
      b[2] += dt
      wrap(b[0])
      if b[2] >= BULLET_LIFE
        @bullets.delete_at(i)
        @fsm.bullet_expired
      end
    end
  end

  def check_collisions
    total = @fsm.field.count
    (@bullets.length - 1).downto(0) do |bi|
      bp = @bullets[bi][0]
      hit = -1
      i = 0
      while i < total
        if @fsm.field.is_alive(i) && @fsm.field.position(i).distance_to(bp) < @fsm.field.radius_of(i)
          hit = i
          break
        end
        i += 1
      end
      if hit >= 0
        @fsm.bullet_hit_asteroid(hit)
        @bullets.delete_at(bi)
        @fsm.bullet_expired
      end
    end
    if @fsm.ship.can_be_hit
      i = 0
      while i < total
        if @fsm.field.is_alive(i) && @fsm.field.position(i).distance_to(@ship_pos) < @fsm.field.radius_of(i) + SHIP_SIZE * 0.6
          @fsm.ship_hit_asteroid(i)
          break
        end
        i += 1
      end
    end
  end

  def publish_state
    g = @fsm.get_current_state_name
    s = @fsm.ship.get_current_state_name
    snap = "#{g}|#{s}"
    return if snap == @last_pub
    @last_pub = snap
    return if @chan.nil?
    msg = JS.eval("return {}")
    msg[:AsteroidsGame] = g
    msg[:Ship] = s
    msg[:AsteroidField] = "Active"
    @chan.call(:postMessage, msg)
  end

  # ── render ──
  def draw(now)
    c = @ctx
    c[:fillStyle] = "#000000"
    c.call(:fillRect, 0, 0, COURT_W, COURT_H)
    state = @fsm.get_current_state_name
    total = @fsm.field.count

    c[:strokeStyle] = COL_ROCK
    c[:lineWidth] = 1.5
    i = 0
    while i < total
      if @fsm.field.is_alive(i)
        p = @fsm.field.position(i)
        c.call(:beginPath)
        c.call(:arc, p.x, p.y, @fsm.field.radius_of(i), 0, TWO_PI)
        c.call(:stroke)
      end
      i += 1
    end

    c[:fillStyle] = COL_BULLET
    @bullets.each do |b|
      c.call(:beginPath)
      c.call(:arc, b[0].x, b[0].y, BULLET_SIZE, 0, TWO_PI)
      c.call(:fill)
    end

    if state != "Attract" && state != "GameOver" && @fsm.ship.is_visible
      ss = @fsm.ship.get_current_state_name
      if ss == "Exploding"
        draw_explosion
      else
        visible = true
        visible = ((now / 100).to_i % 2 == 0) if ss == "Respawning"
        draw_ship if visible
      end
    end

    draw_hud(state)
  end

  def draw_ship
    a = @ship_angle
    at = @ship_pos
    nose  = at + Vec2.new(Math.cos(a), Math.sin(a)) * SHIP_SIZE
    left  = at + Vec2.new(Math.cos(a + 2.5), Math.sin(a + 2.5)) * SHIP_SIZE
    right = at + Vec2.new(Math.cos(a - 2.5), Math.sin(a - 2.5)) * SHIP_SIZE
    c = @ctx
    c[:strokeStyle] = COL_SHIP
    c[:lineWidth] = 1.5
    c.call(:beginPath)
    c.call(:moveTo, nose.x, nose.y)
    c.call(:lineTo, left.x, left.y)
    c.call(:lineTo, right.x, right.y)
    c.call(:closePath)
    c.call(:stroke)
    if thrust_held
      ss = @fsm.ship.get_current_state_name
      if ss == "Alive" || ss == "Respawning"
        tb = (left + right) * 0.5
        tt = at + Vec2.new(Math.cos(a), Math.sin(a)) * (-SHIP_SIZE * 1.4)
        c[:strokeStyle] = COL_FLAME
        c.call(:beginPath)
        c.call(:moveTo, tb.x, tb.y)
        c.call(:lineTo, tt.x, tt.y)
        c.call(:stroke)
      end
    end
  end

  def draw_explosion
    at = @ship_pos
    c = @ctx
    c[:strokeStyle] = COL_SHIP
    8.times do |i|
      t = i / 8.0 * TWO_PI
      c.call(:beginPath)
      c.call(:moveTo, at.x + Math.cos(t) * 4, at.y + Math.sin(t) * 4)
      c.call(:lineTo, at.x + Math.cos(t) * 14, at.y + Math.sin(t) * 14)
      c.call(:stroke)
    end
  end

  def draw_hud(state)
    c = @ctx
    c[:fillStyle] = COL_TEXT
    c[:textAlign] = "left"
    c[:font] = "16px monospace"
    hud = format("SCORE  %05d     LIVES  %d     WAVE  %d     DIFF  %d     WARP  %d",
                 @fsm.get_score, @fsm.get_lives, @fsm.get_wave,
                 @fsm.get_difficulty, @fsm.ship.get_hyperspaces_remaining)
    c.call(:fillText, hud, 12, 24)

    msg = nil
    case state
    when "Attract"   then msg = ["A S T E R O I D S", "", "Press any key to start", "(H hyperspace - P pause)"]
    when "WaveClear" then msg = ["WAVE CLEAR"]
    when "Paused"    then msg = ["PAUSED"]
    when "GameOver"  then msg = ["GAME OVER", "", "Press R to restart"]
    end
    return unless msg
    c[:textAlign] = "center"
    c[:font] = "26px monospace"
    y = (COURT_H * 0.4).to_i
    msg.each do |line|
      c.call(:fillText, line, COURT_W / 2, y) unless line.empty?
      y += 38
    end
  end
end

# ── bootstrap: canvas, input, rAF loop ──
document = JS.global[:document]
canvas = document.call(:getElementById, "game")
$game = Game.new(canvas)

HELD = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]

$on_keydown = ->(e) {
  code = e[:code].to_s
  e.call(:preventDefault) if HELD.include?(code)
  $game.instance_variable_get(:@keys)[code] = true
  $game.on_keydown(code)
  JS::Undefined
}
$on_keyup = ->(e) {
  $game.instance_variable_get(:@keys).delete(e[:code].to_s)
  JS::Undefined
}
JS.global.call(:addEventListener, "keydown", $on_keydown)
JS.global.call(:addEventListener, "keyup", $on_keyup)

$game.fsm.start if JS.global[:location][:hash].to_s == "#autostart"  # dev/headless capture

$last = 0.0
$frame = ->(ts) {
  now = ts.to_f
  dt = $last == 0.0 ? 0.016 : (now - $last) / 1000.0
  dt = 0.05 if dt > 0.05
  $last = now
  $game.update(dt)
  $game.publish_state
  $game.draw(now)
  JS.global.call(:requestAnimationFrame, $frame)
  JS::Undefined
}
JS.global.call(:requestAnimationFrame, $frame)
