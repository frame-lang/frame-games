<?php
// Asteroids — PHP host for the Frame AsteroidsGame controller. Same FSM as the
// other ports (asteroids.php); this is the engine layer, written in PHP and run
// in the browser by php-wasm. Rendering is HTML canvas 2D via the `vrzno`
// JS-interop extension (`new Vrzno()` is a proxy to globalThis; property get/set
// and method calls cross into JS). Input, the requestAnimationFrame loop
// (vrzno_await on a frame promise), and live-state (BroadcastChannel) all go
// through a small JS helper prelude injected with vrzno_eval. The four ShipHost
// callbacks are plain PHP methods.

const COURT_W = 800;
const COURT_H = 600;
const TWO_PI  = M_PI * 2;

const COL_SHIP   = "#8ab4f8";
const COL_ROCK   = "#9aa4b8";
const COL_BULLET = "#ffffff";
const COL_FLAME  = "#ffad42";
const COL_TEXT   = "#ffffff";

const SHIP_THRUST = 240.0;
const SHIP_ROT    = 4.0;
const SHIP_MAX    = 320.0;
const SHIP_DRAG   = 0.5;
const SHIP_SIZE   = 14.0;
const BULLET_SPEED = 500.0;
const BULLET_LIFE  = 1.2;
const BULLET_SIZE  = 2.4;

class Game implements IShipHost {
    public $fsm;
    public $ctx;
    public $win;
    public $court;
    public $ship_pos;
    public $ship_vel;
    public $ship_angle;
    public $bullets = [];   // each: [Vec2 pos, Vec2 vel, float life]
    public $last_pub = "";

    public function __construct($win, $ctx) {
        $this->win = $win;
        $this->ctx = $ctx;
        $this->fsm = AsteroidsGame::_create($this, 2);
        $this->court = new Vec2(COURT_W, COURT_H);
        $this->reset_ship();
    }

    // ── ShipHost ──
    public function warp_out() {
        $this->ship_pos = new Vec2(mt_rand() / mt_getrandmax() * COURT_W, mt_rand() / mt_getrandmax() * COURT_H);
        $this->ship_vel = new Vec2(0.0, 0.0);
    }
    public function warp_in() {}
    public function spawn_explosion() {}
    public function reset_ship() {
        $this->ship_pos = new Vec2(COURT_W / 2.0, COURT_H / 2.0);
        $this->ship_vel = new Vec2(0.0, 0.0);
        $this->ship_angle = -M_PI / 2;
        foreach ($this->bullets as $b) { $this->fsm->bullet_expired(); }
        $this->bullets = [];
    }

    // ── input ──
    public function thrust_held() {
        return $this->win->__isDown("ArrowUp") || $this->win->__isDown("KeyW");
    }

    public function on_keydown($code) {
        $state = $this->fsm->get_current_state_name();
        if ($state == "Attract") {
            $this->fsm->start();
            $this->bullets = [];
            return;
        }
        if ($state == "GameOver") {
            if ($code == "KeyR") {
                $this->fsm->restart();
                $this->fsm->start();
                $this->bullets = [];
            }
            return;
        }
        if ($code == "KeyP") {
            if ($this->fsm->is_paused()) { $this->fsm->resume(); } else { $this->fsm->pause(); }
            return;
        }
        if ($this->fsm->is_paused()) { return; }
        if ($code == "KeyH" && $this->fsm->ship->can_hyperspace()) {
            $this->fsm->ship_hyperspace();
        }
    }

    // ── frame ──
    public function update($dt) {
        $state = $this->fsm->get_current_state_name();
        if ($state == "Attract" || $state == "GameOver" || $this->fsm->is_paused()) { return; }
        $this->handle_input($dt);
        $this->fsm->tick($dt, $this->court);
        $this->update_ship($dt);
        $this->update_bullets($dt);
        $this->check_collisions();
    }

    public function handle_input($dt) {
        if (!$this->fsm->ship->is_visible()) { return; }
        if ($this->win->__isDown("ArrowLeft") || $this->win->__isDown("KeyA")) { $this->ship_angle -= SHIP_ROT * $dt; }
        if ($this->win->__isDown("ArrowRight") || $this->win->__isDown("KeyD")) { $this->ship_angle += SHIP_ROT * $dt; }
        $ss = $this->fsm->ship->get_current_state_name();
        if (($ss == "Alive" || $ss == "Respawning") && $this->thrust_held()) {
            $this->ship_vel = $this->ship_vel->add((new Vec2(cos($this->ship_angle), sin($this->ship_angle)))->scale(SHIP_THRUST * $dt));
            if ($this->ship_vel->length() > SHIP_MAX) { $this->ship_vel = $this->ship_vel->scale(SHIP_MAX / $this->ship_vel->length()); }
        }
        if ($this->fsm->ship->can_fire() && $this->fsm->get_bullets_in_flight() < $this->fsm->get_max_bullets() && $this->win->__isDown("Space")) {
            $this->try_fire();
        }
    }

    public function try_fire() {
        $this->fsm->ship->fire();
        $d = new Vec2(cos($this->ship_angle), sin($this->ship_angle));
        $this->bullets[] = [$this->ship_pos->add($d->scale(SHIP_SIZE)), $d->scale(BULLET_SPEED)->add($this->ship_vel), 0.0];
        $this->fsm->bullet_fired();
    }

    public function wrap($p) {
        if ($p->x < 0) { $p->x += COURT_W; }
        if ($p->x > COURT_W) { $p->x -= COURT_W; }
        if ($p->y < 0) { $p->y += COURT_H; }
        if ($p->y > COURT_H) { $p->y -= COURT_H; }
    }

    public function update_ship($dt) {
        if (!$this->fsm->ship->is_visible()) { return; }
        $this->ship_vel = $this->ship_vel->scale(1.0 - SHIP_DRAG * $dt);
        $this->ship_pos = $this->ship_pos->add($this->ship_vel->scale($dt));
        $this->wrap($this->ship_pos);
    }

    public function update_bullets($dt) {
        for ($i = count($this->bullets) - 1; $i >= 0; $i--) {
            $b = $this->bullets[$i];
            $b[0] = $b[0]->add($b[1]->scale($dt));
            $b[2] += $dt;
            $this->wrap($b[0]);
            $this->bullets[$i] = $b;
            if ($b[2] >= BULLET_LIFE) {
                array_splice($this->bullets, $i, 1);
                $this->fsm->bullet_expired();
            }
        }
    }

    public function check_collisions() {
        $total = $this->fsm->field->count();
        for ($bi = count($this->bullets) - 1; $bi >= 0; $bi--) {
            $bp = $this->bullets[$bi][0];
            $hit = -1;
            for ($i = 0; $i < $total; $i++) {
                if ($this->fsm->field->is_alive($i) && $this->fsm->field->position($i)->distance_to($bp) < $this->fsm->field->radius_of($i)) {
                    $hit = $i;
                    break;
                }
            }
            if ($hit >= 0) {
                $this->fsm->bullet_hit_asteroid($hit);
                array_splice($this->bullets, $bi, 1);
                $this->fsm->bullet_expired();
            }
        }
        if ($this->fsm->ship->can_be_hit()) {
            for ($i = 0; $i < $total; $i++) {
                if ($this->fsm->field->is_alive($i) && $this->fsm->field->position($i)->distance_to($this->ship_pos) < $this->fsm->field->radius_of($i) + SHIP_SIZE * 0.6) {
                    $this->fsm->ship_hit_asteroid($i);
                    break;
                }
            }
        }
    }

    public function publish_state() {
        $g = $this->fsm->get_current_state_name();
        $s = $this->fsm->ship->get_current_state_name();
        $snap = $g . "|" . $s;
        if ($snap == $this->last_pub) { return; }
        $this->last_pub = $snap;
        $this->win->__pub($g, $s);
    }

    // ── render ──
    public function draw($now) {
        $c = $this->ctx;
        $c->fillStyle = "#000000";
        $c->fillRect(0, 0, COURT_W, COURT_H);
        $state = $this->fsm->get_current_state_name();
        $total = $this->fsm->field->count();

        $c->strokeStyle = COL_ROCK;
        $c->lineWidth = 1.5;
        for ($i = 0; $i < $total; $i++) {
            if ($this->fsm->field->is_alive($i)) {
                $p = $this->fsm->field->position($i);
                $c->beginPath();
                $c->arc($p->x, $p->y, $this->fsm->field->radius_of($i), 0, TWO_PI);
                $c->stroke();
            }
        }

        $c->fillStyle = COL_BULLET;
        foreach ($this->bullets as $b) {
            $c->beginPath();
            $c->arc($b[0]->x, $b[0]->y, BULLET_SIZE, 0, TWO_PI);
            $c->fill();
        }

        if ($state != "Attract" && $state != "GameOver" && $this->fsm->ship->is_visible()) {
            $ss = $this->fsm->ship->get_current_state_name();
            if ($ss == "Exploding") {
                $this->draw_explosion();
            } else {
                $visible = true;
                if ($ss == "Respawning") { $visible = (intval($now / 100) % 2 == 0); }
                if ($visible) { $this->draw_ship(); }
            }
        }

        $this->draw_hud($state);
    }

    public function draw_ship() {
        $a = $this->ship_angle;
        $at = $this->ship_pos;
        $nose  = $at->add((new Vec2(cos($a), sin($a)))->scale(SHIP_SIZE));
        $left  = $at->add((new Vec2(cos($a + 2.5), sin($a + 2.5)))->scale(SHIP_SIZE));
        $right = $at->add((new Vec2(cos($a - 2.5), sin($a - 2.5)))->scale(SHIP_SIZE));
        $c = $this->ctx;
        $c->strokeStyle = COL_SHIP;
        $c->lineWidth = 1.5;
        $c->beginPath();
        $c->moveTo($nose->x, $nose->y);
        $c->lineTo($left->x, $left->y);
        $c->lineTo($right->x, $right->y);
        $c->closePath();
        $c->stroke();
        if ($this->thrust_held()) {
            $ss = $this->fsm->ship->get_current_state_name();
            if ($ss == "Alive" || $ss == "Respawning") {
                $tb = ($left->add($right))->scale(0.5);
                $tt = $at->add((new Vec2(cos($a), sin($a)))->scale(-SHIP_SIZE * 1.4));
                $c->strokeStyle = COL_FLAME;
                $c->beginPath();
                $c->moveTo($tb->x, $tb->y);
                $c->lineTo($tt->x, $tt->y);
                $c->stroke();
            }
        }
    }

    public function draw_explosion() {
        $at = $this->ship_pos;
        $c = $this->ctx;
        $c->strokeStyle = COL_SHIP;
        for ($i = 0; $i < 8; $i++) {
            $t = $i / 8.0 * TWO_PI;
            $c->beginPath();
            $c->moveTo($at->x + cos($t) * 4, $at->y + sin($t) * 4);
            $c->lineTo($at->x + cos($t) * 14, $at->y + sin($t) * 14);
            $c->stroke();
        }
    }

    public function draw_hud($state) {
        $c = $this->ctx;
        $c->fillStyle = COL_TEXT;
        $c->textAlign = "left";
        $c->font = "16px monospace";
        $hud = sprintf("SCORE  %05d     LIVES  %d     WAVE  %d     DIFF  %d     WARP  %d",
                       $this->fsm->get_score(), $this->fsm->get_lives(), $this->fsm->get_wave(),
                       $this->fsm->get_difficulty(), $this->fsm->ship->get_hyperspaces_remaining());
        $c->fillText($hud, 12, 24);

        $msg = null;
        if ($state == "Attract")   { $msg = ["A S T E R O I D S", "", "Press any key to start", "(H hyperspace - P pause)"]; }
        elseif ($state == "WaveClear") { $msg = ["WAVE CLEAR"]; }
        elseif ($state == "Paused")    { $msg = ["PAUSED"]; }
        elseif ($state == "GameOver")  { $msg = ["GAME OVER", "", "Press R to restart"]; }
        if ($msg === null) { return; }
        $c->textAlign = "center";
        $c->font = "26px monospace";
        $y = intval(COURT_H * 0.4);
        foreach ($msg as $line) {
            if ($line != "") { $c->fillText($line, COURT_W / 2, $y); }
            $y += 38;
        }
    }
}

// ── bootstrap: JS helper prelude, canvas, rAF loop ──
$window = new Vrzno();
vrzno_eval(<<<'JS'
  globalThis.__keys = {};
  globalThis.__events = [];
  globalThis.__isDown = (k) => !!globalThis.__keys[k];
  globalThis.__drain = () => { const e = globalThis.__events; globalThis.__events = []; return e.join(','); };
  globalThis.__frame = () => new Promise(res => requestAnimationFrame(t => res(t)));
  const HELD = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'];
  window.addEventListener('keydown', e => { if (HELD.includes(e.code)) e.preventDefault(); globalThis.__keys[e.code]=true; globalThis.__events.push(e.code); });
  window.addEventListener('keyup', e => { delete globalThis.__keys[e.code]; });
  try {
    globalThis.__chan = new BroadcastChannel('frame-games:state:asteroids');
    globalThis.__pub = (g,s) => globalThis.__chan.postMessage({AsteroidsGame:g, Ship:s, AsteroidField:'Active'});
  } catch(e) { globalThis.__pub = () => {}; }
  if (location.hash === '#autostart') globalThis.__autostart = true;
JS);

$canvas = $window->document->getElementById("game");
$ctx = $canvas->getContext("2d");
$game = new Game($window, $ctx);
if ($window->__autostart) { $game->fsm->start(); }

$last = 0.0;
while (true) {
    $now = floatval(vrzno_await($window->__frame()));
    $dt = ($last == 0.0) ? 0.016 : ($now - $last) / 1000.0;
    if ($dt > 0.05) { $dt = 0.05; }
    $last = $now;

    $codes = $window->__drain();
    if ($codes != "") {
        foreach (explode(",", $codes) as $code) { $game->on_keydown($code); }
    }

    $game->update($dt);
    $game->publish_state();
    $game->draw($now);}
