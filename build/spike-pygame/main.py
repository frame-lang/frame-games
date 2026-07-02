# Asteroids — Pygame host for the Frame AsteroidsGame controller. Same FSM as
# the other ports (asteroids.py, generated from asteroids.fpy); this is the
# engine layer: an async game loop (pygbag requires async + `await asyncio.sleep`),
# pygame.draw rendering, input, and the four ShipHost callbacks. Live FSM state
# is published to the site's diagram panel via pygbag's JS bridge.
import asyncio
import math
import pygame

from asteroids import AsteroidsGame, Vec2

COURT_W, COURT_H = 800, 600

COL_BG     = (0, 0, 0)
COL_SHIP   = (0x8a, 0xb4, 0xf8)
COL_ROCK   = (0x9a, 0xa4, 0xb8)
COL_BULLET = (255, 255, 255)
COL_FLAME  = (255, 173, 66)
COL_TEXT   = (255, 255, 255)

SHIP_THRUST = 240.0
SHIP_ROT    = 4.0
SHIP_MAX    = 320.0
SHIP_DRAG   = 0.5
SHIP_SIZE   = 14.0
BULLET_SPEED = 500.0
BULLET_LIFE  = 1.2
BULLET_SIZE  = 2

# ── live FSM state -> BroadcastChannel (pygbag/Pyodide JS bridge; no-op natively) ──
def _make_publisher():
    try:
        import platform
        win = platform.window
        chan = win.BroadcastChannel.new("frame-games:state:asteroids")

        def publish(game, ship):
            chan.postMessage(win.Object.fromEntries(win.Array(
                win.Array("AsteroidsGame", game),
                win.Array("Ship", ship),
                win.Array("AsteroidField", "Active"))))
        return publish
    except Exception:
        return lambda game, ship: None


class Game:
    def __init__(self):
        self.fsm = AsteroidsGame._create(self, 2)
        self.court = Vec2(COURT_W, COURT_H)
        self.ship_pos = Vec2(COURT_W / 2, COURT_H / 2)
        self.ship_vel = Vec2(0, 0)
        self.ship_angle = -math.pi / 2
        self.bullets = []          # list of [pos, vel, life]
        self.last_pub = ""
        self._publish = _make_publisher()
        self.reset_ship()

    # ── ShipHost ──
    def warp_out(self):
        import random
        self.ship_pos = Vec2(random.random() * COURT_W, random.random() * COURT_H)
        self.ship_vel = Vec2(0, 0)

    def warp_in(self):
        pass

    def spawn_explosion(self):
        pass

    def reset_ship(self):
        self.ship_pos = Vec2(COURT_W / 2, COURT_H / 2)
        self.ship_vel = Vec2(0, 0)
        self.ship_angle = -math.pi / 2
        for _ in self.bullets:
            self.fsm.bullet_expired()
        self.bullets = []

    # ── frame ──
    def thrust_held(self, keys):
        return keys[pygame.K_UP] or keys[pygame.K_w]

    def on_keydown(self, key):
        state = self.fsm.get_current_state_name()
        if state == "Attract":
            self.fsm.start()
            self.bullets = []
            return
        if state == "GameOver":
            if key == pygame.K_r:
                self.fsm.restart()
                self.fsm.start()
                self.bullets = []
            return
        if key == pygame.K_p:
            if self.fsm.is_paused():
                self.fsm.resume()
            else:
                self.fsm.pause()
            return
        if self.fsm.is_paused():
            return
        if key == pygame.K_h and self.fsm.ship.can_hyperspace():
            self.fsm.ship_hyperspace()

    def update(self, dt, keys):
        state = self.fsm.get_current_state_name()
        if state == "Attract" or state == "GameOver" or self.fsm.is_paused():
            return
        self.handle_input(dt, keys)
        self.fsm.tick(dt, self.court)
        self.update_ship(dt)
        self.update_bullets(dt)
        self.check_collisions()

    def handle_input(self, dt, keys):
        if not self.fsm.ship.is_visible():
            return
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            self.ship_angle -= SHIP_ROT * dt
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            self.ship_angle += SHIP_ROT * dt
        ss = self.fsm.ship.get_current_state_name()
        if (ss == "Alive" or ss == "Respawning") and self.thrust_held(keys):
            self.ship_vel = self.ship_vel + Vec2(math.cos(self.ship_angle), math.sin(self.ship_angle)) * (SHIP_THRUST * dt)
            if self.ship_vel.length() > SHIP_MAX:
                self.ship_vel = self.ship_vel * (SHIP_MAX / self.ship_vel.length())
        if self.fsm.ship.can_fire() and self.fsm.get_bullets_in_flight() < self.fsm.get_max_bullets() and keys[pygame.K_SPACE]:
            self.try_fire()

    def try_fire(self):
        self.fsm.ship.fire()
        d = Vec2(math.cos(self.ship_angle), math.sin(self.ship_angle))
        self.bullets.append([self.ship_pos + d * SHIP_SIZE, d * BULLET_SPEED + self.ship_vel, 0.0])
        self.fsm.bullet_fired()

    def _wrap(self, p):
        if p.x < 0: p.x += COURT_W
        if p.x > COURT_W: p.x -= COURT_W
        if p.y < 0: p.y += COURT_H
        if p.y > COURT_H: p.y -= COURT_H

    def update_ship(self, dt):
        if not self.fsm.ship.is_visible():
            return
        self.ship_vel = self.ship_vel * (1.0 - SHIP_DRAG * dt)
        self.ship_pos = self.ship_pos + self.ship_vel * dt
        self._wrap(self.ship_pos)

    def update_bullets(self, dt):
        for i in range(len(self.bullets) - 1, -1, -1):
            b = self.bullets[i]
            b[0] = b[0] + b[1] * dt
            b[2] += dt
            self._wrap(b[0])
            if b[2] >= BULLET_LIFE:
                self.bullets.pop(i)
                self.fsm.bullet_expired()

    def check_collisions(self):
        total = self.fsm.field.count()
        for bi in range(len(self.bullets) - 1, -1, -1):
            bp = self.bullets[bi][0]
            hit = -1
            for i in range(total):
                if self.fsm.field.is_alive(i) and self.fsm.field.position(i).distance_to(bp) < self.fsm.field.radius_of(i):
                    hit = i
                    break
            if hit >= 0:
                self.fsm.bullet_hit_asteroid(hit)
                self.bullets.pop(bi)
                self.fsm.bullet_expired()
        if self.fsm.ship.can_be_hit():
            for i in range(total):
                if self.fsm.field.is_alive(i) and self.fsm.field.position(i).distance_to(self.ship_pos) < self.fsm.field.radius_of(i) + SHIP_SIZE * 0.6:
                    self.fsm.ship_hit_asteroid(i)
                    break

    def publish_state(self):
        g = self.fsm.get_current_state_name()
        s = self.fsm.ship.get_current_state_name()
        snap = g + "|" + s
        if snap == self.last_pub:
            return
        self.last_pub = snap
        self._publish(g, s)

    # ── render ──
    def draw(self, screen, hud_font, center_font, ticks):
        screen.fill(COL_BG)
        state = self.fsm.get_current_state_name()
        total = self.fsm.field.count()
        for i in range(total):
            if self.fsm.field.is_alive(i):
                p = self.fsm.field.position(i)
                pygame.draw.circle(screen, COL_ROCK, (int(p.x), int(p.y)), int(self.fsm.field.radius_of(i)), 1)
        for b in self.bullets:
            pygame.draw.circle(screen, COL_BULLET, (int(b[0].x), int(b[0].y)), BULLET_SIZE)
        if state != "Attract" and state != "GameOver" and self.fsm.ship.is_visible():
            ss = self.fsm.ship.get_current_state_name()
            if ss == "Exploding":
                self._draw_explosion(screen)
            else:
                visible = True
                if ss == "Respawning":
                    visible = (ticks // 100) % 2 == 0
                if visible:
                    self._draw_ship(screen)
        self._draw_hud(screen, hud_font, center_font, state)

    def _draw_ship(self, screen):
        a = self.ship_angle
        at = self.ship_pos
        nose = at + Vec2(math.cos(a), math.sin(a)) * SHIP_SIZE
        left = at + Vec2(math.cos(a + 2.5), math.sin(a + 2.5)) * SHIP_SIZE
        right = at + Vec2(math.cos(a - 2.5), math.sin(a - 2.5)) * SHIP_SIZE
        pygame.draw.polygon(screen, COL_SHIP,
                            [(nose.x, nose.y), (left.x, left.y), (right.x, right.y)], 1)
        if pygame.key.get_pressed()[pygame.K_UP] or pygame.key.get_pressed()[pygame.K_w]:
            ss = self.fsm.ship.get_current_state_name()
            if ss == "Alive" or ss == "Respawning":
                tb = (left + right) * 0.5
                tt = at + Vec2(math.cos(a), math.sin(a)) * (-SHIP_SIZE * 1.4)
                pygame.draw.line(screen, COL_FLAME, (tb.x, tb.y), (tt.x, tt.y))

    def _draw_explosion(self, screen):
        at = self.ship_pos
        for i in range(8):
            t = i / 8.0 * math.pi * 2
            pygame.draw.line(screen, COL_SHIP,
                             (at.x + math.cos(t) * 4, at.y + math.sin(t) * 4),
                             (at.x + math.cos(t) * 14, at.y + math.sin(t) * 14))

    def _draw_hud(self, screen, hud_font, center_font, state):
        hud = "SCORE  %05d     LIVES  %d     WAVE  %d     DIFF  %d     WARP  %d" % (
            self.fsm.get_score(), self.fsm.get_lives(), self.fsm.get_wave(),
            self.fsm.get_difficulty(), self.fsm.ship.get_hyperspaces_remaining())
        screen.blit(hud_font.render(hud, True, COL_TEXT), (12, 8))
        msg = None
        if state == "Attract":
            msg = ["A S T E R O I D S", "", "Press any key to start", "(H hyperspace · P pause)"]
        elif state == "WaveClear":
            msg = ["WAVE CLEAR"]
        elif state == "Paused":
            msg = ["PAUSED"]
        elif state == "GameOver":
            msg = ["GAME OVER", "", "Press R to restart"]
        if msg:
            y = int(COURT_H * 0.4)
            for line in msg:
                if line:
                    surf = center_font.render(line, True, COL_TEXT)
                    screen.blit(surf, ((COURT_W - surf.get_width()) // 2, y))
                y += 38


async def main():
    pygame.init()
    screen = pygame.display.set_mode((COURT_W, COURT_H))
    pygame.display.set_caption("Asteroids")
    clock = pygame.time.Clock()
    hud_font = pygame.font.Font(None, 26)
    center_font = pygame.font.Font(None, 40)
    game = Game()

    while True:
        dt = clock.tick(60) / 1000.0
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return
            elif event.type == pygame.KEYDOWN:
                game.on_keydown(event.key)
        game.update(dt, pygame.key.get_pressed())
        game.publish_state()
        game.draw(screen, hud_font, center_font, pygame.time.get_ticks())
        pygame.display.flip()
        await asyncio.sleep(0)


asyncio.run(main())
