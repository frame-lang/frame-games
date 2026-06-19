// Asteroids — Rust/gdext gameplay driver (port of main.gd).
// A Node2D that owns the Frame AsteroidsGame controller, handles ship
// physics + input + collisions, renders the scene, and exposes the four
// host effects the Ship FSM fires via call_deferred.
use godot::prelude::*;
use godot::classes::{INode2D, Node2D, Label, CanvasLayer, Input, Time, RenderingServer, DisplayServer};
use godot::global::{Key, HorizontalAlignment, VerticalAlignment};

use crate::asteroids::AsteroidsGame;

const COL_BG: Color = Color::from_rgba(0.0, 0.0, 0.0, 1.0);
const COL_SHIP: Color = Color::from_rgba(0x8a as f32 / 255.0, 0xb4 as f32 / 255.0, 0xf8 as f32 / 255.0, 1.0);
const COL_ROCK: Color = Color::from_rgba(0x9a as f32 / 255.0, 0xa4 as f32 / 255.0, 0xb8 as f32 / 255.0, 1.0);
const COL_BULLET: Color = Color::from_rgba(1.0, 1.0, 1.0, 1.0);
const COL_FLAME: Color = Color::from_rgba(1.0, 0.68, 0.26, 1.0);

const SHIP_THRUST: f32 = 240.0;
const SHIP_ROTATION_SPEED: f32 = 4.0;
const SHIP_MAX_SPEED: f32 = 320.0;
const SHIP_DRAG: f32 = 0.5;
const SHIP_SIZE: f32 = 14.0;
const BULLET_SPEED: f32 = 500.0;
const BULLET_LIFETIME: f32 = 1.2;
const BULLET_SIZE: f32 = 2.0;

struct Bullet {
    pos: Vector2,
    vel: Vector2,
    life: f32,
}

#[derive(GodotClass)]
#[class(base = Node2D)]
pub struct AsteroidsMain {
    fsm: Option<AsteroidsGame>,
    ship_pos: Vector2,
    ship_vel: Vector2,
    ship_angle: f32,
    bullets: Vec<Bullet>,
    p_was_down: bool,
    h_was_down: bool,
    label_hud: Option<Gd<Label>>,
    label_center: Option<Gd<Label>>,
    court_size: Vector2,
    difficulty: i32,
    last_pub: String,
    base: Base<Node2D>,
}

#[godot_api]
impl INode2D for AsteroidsMain {
    fn init(base: Base<Node2D>) -> Self {
        Self {
            fsm: None,
            ship_pos: Vector2::ZERO,
            ship_vel: Vector2::ZERO,
            ship_angle: -std::f32::consts::PI * 0.5,
            bullets: Vec::new(),
            p_was_down: false,
            h_was_down: false,
            label_hud: None,
            label_center: None,
            court_size: Vector2::new(800.0, 600.0),
            difficulty: 2,
            last_pub: String::new(),
            base,
        }
    }

    fn ready(&mut self) {
        let host = self.to_gd().upcast::<Node>();
        self.fsm = Some(AsteroidsGame::__create(self.difficulty, host));
        RenderingServer::singleton().set_default_clear_color(COL_BG);
        self.build_ui();
        self.reset_ship_impl();
    }

    fn physics_process(&mut self, delta: f64) {
        let dt = delta as f32;
        self.handle_input(dt);

        let state = self.fsm.as_mut().unwrap().get_current_state_name();
        let paused = self.fsm.as_mut().unwrap().is_paused();
        if !paused && state != "Attract" && state != "GameOver" {
            let court = self.court_size;
            self.fsm.as_mut().unwrap().tick(dt, court);
            self.update_ship(dt);
            self.update_bullets(dt);
            self.check_collisions();
        }
        self.update_labels();
        self.publish_state();
        self.base_mut().queue_redraw();
    }

    fn draw(&mut self) {
        let state = self.fsm.as_mut().unwrap().get_current_state_name();

        // Gather asteroid render data first (reads fsm), then draw (base_mut).
        let total = self.fsm.as_mut().unwrap().field.count();
        let mut rocks: Vec<(Vector2, f32)> = Vec::new();
        let mut i = 0;
        while i < total {
            let f = &mut self.fsm.as_mut().unwrap().field;
            if f.is_alive(i) {
                rocks.push((f.position(i), f.radius_of(i)));
            }
            i += 1;
        }

        let ship_visible = self.fsm.as_mut().unwrap().ship.is_visible();
        let ship_state = self.fsm.as_mut().unwrap().ship.get_current_state_name();
        let thrusting = Self::thrust_held();
        let ship_pos = self.ship_pos;
        let ship_angle = self.ship_angle;
        let bullets: Vec<Vector2> = self.bullets.iter().map(|b| b.pos).collect();

        for (pos, radius) in rocks {
            self.draw_asteroid(pos, radius);
        }
        for bp in bullets {
            self.base_mut().draw_circle(bp, BULLET_SIZE, COL_BULLET);
        }
        if state != "Attract" && state != "GameOver" && ship_visible {
            if ship_state == "Exploding" {
                self.draw_explosion(ship_pos);
            } else {
                let mut visible = true;
                if ship_state == "Respawning" {
                    let t = Time::singleton().get_ticks_msec();
                    visible = (t / 100) % 2 == 0;
                }
                if visible {
                    self.draw_ship(ship_pos, ship_angle, thrusting && (ship_state == "Alive" || ship_state == "Respawning"));
                }
            }
        }
    }
}

#[godot_api]
impl AsteroidsMain {
    // Live FSM state → BroadcastChannel, web only (the site's diagram panel
    // listens on frame-games:state:<id>). Posts a snapshot on change, mirroring
    // the GDScript version's injected live_state_publisher.
    #[cfg(target_arch = "wasm32")]
    fn publish_state(&mut self) {
        let game = self.fsm.as_mut().unwrap().get_current_state_name();
        let ship = self.fsm.as_mut().unwrap().ship.get_current_state_name();
        let snap = format!("{game}|{ship}");
        if snap == self.last_pub {
            return;
        }
        self.last_pub = snap;
        // NUL-terminated JS, eval'd through the emscripten runtime (same path
        // as the C port) — gdext's lean codegen omits JavaScriptBridge.
        let js = format!(
            "(window._fgChan||(window._fgChan=new BroadcastChannel('frame-games:state:asteroids')))\
             .postMessage({{AsteroidsGame:'{game}',Ship:'{ship}',AsteroidField:'Active'}})\0"
        );
        extern "C" {
            fn emscripten_run_script(script: *const core::ffi::c_char);
        }
        unsafe { emscripten_run_script(js.as_ptr() as *const core::ffi::c_char) };
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn publish_state(&mut self) {
        let _ = &self.last_pub; // native: no JS bridge; field used only on web
    }

    // ---- Host surface — Ship fires these via call_deferred ----
    #[func]
    fn reset_ship(&mut self) {
        self.reset_ship_impl();
    }

    #[func]
    fn warp_out(&mut self) {
        let c = self.court_size;
        self.ship_pos = Vector2::new(rf() * c.x, rf() * c.y);
        self.ship_vel = Vector2::ZERO;
    }

    #[func]
    fn warp_in(&mut self) {}

    #[func]
    fn spawn_explosion(&mut self) {}

    // ---- Internals ----
    fn reset_ship_impl(&mut self) {
        self.ship_pos = self.court_size * 0.5;
        self.ship_vel = Vector2::ZERO;
        self.ship_angle = -std::f32::consts::PI * 0.5;
        if self.fsm.is_some() {
            let n = self.bullets.len();
            for _ in 0..n {
                self.fsm.as_mut().unwrap().bullet_expired();
            }
        }
        self.bullets.clear();
    }

    fn build_ui(&mut self) {
        let mut canvas = CanvasLayer::new_alloc();

        let mut hud = Label::new_alloc();
        hud.add_theme_font_size_override("font_size", 18);
        hud.set_position(Vector2::new(10.0, 6.0));
        hud.set_size(Vector2::new(self.court_size.x - 20.0, 28.0));
        canvas.add_child(&hud);
        self.label_hud = Some(hud);

        let mut center = Label::new_alloc();
        center.add_theme_font_size_override("font_size", 28);
        center.set_position(Vector2::new(0.0, self.court_size.y * 0.4));
        center.set_size(Vector2::new(self.court_size.x, 120.0));
        center.set_horizontal_alignment(HorizontalAlignment::CENTER);
        center.set_vertical_alignment(VerticalAlignment::CENTER);
        canvas.add_child(&center);
        self.label_center = Some(center);

        self.base_mut().add_child(&canvas);
    }

    fn thrust_held() -> bool {
        let input = Input::singleton();
        input.is_key_pressed(Key::UP) || input.is_key_pressed(Key::W)
    }

    fn handle_input(&mut self, dt: f32) {
        let input = Input::singleton();
        let state = self.fsm.as_mut().unwrap().get_current_state_name();

        if state == "Attract" {
            if input.is_anything_pressed() {
                self.fsm.as_mut().unwrap().start();
                self.bullets.clear();
            }
            return;
        }
        if state == "GameOver" {
            if input.is_key_pressed(Key::R) {
                self.fsm.as_mut().unwrap().restart();
                self.fsm.as_mut().unwrap().start();
                self.bullets.clear();
            }
            return;
        }

        if input.is_key_pressed(Key::P) && !self.p_was_down {
            self.p_was_down = true;
            if self.fsm.as_mut().unwrap().is_paused() {
                self.fsm.as_mut().unwrap().resume();
            } else {
                self.fsm.as_mut().unwrap().pause();
            }
        } else if !input.is_key_pressed(Key::P) {
            self.p_was_down = false;
        }

        if self.fsm.as_mut().unwrap().is_paused() {
            return;
        }
        if !self.fsm.as_mut().unwrap().ship.is_visible() {
            return;
        }

        if input.is_key_pressed(Key::LEFT) || input.is_key_pressed(Key::A) {
            self.ship_angle -= SHIP_ROTATION_SPEED * dt;
        }
        if input.is_key_pressed(Key::RIGHT) || input.is_key_pressed(Key::D) {
            self.ship_angle += SHIP_ROTATION_SPEED * dt;
        }

        let ship_state = self.fsm.as_mut().unwrap().ship.get_current_state_name();
        if ship_state == "Alive" || ship_state == "Respawning" {
            if input.is_key_pressed(Key::UP) || input.is_key_pressed(Key::W) {
                self.ship_vel += Vector2::new(self.ship_angle.cos(), self.ship_angle.sin()) * SHIP_THRUST * dt;
                if self.ship_vel.length() > SHIP_MAX_SPEED {
                    self.ship_vel = self.ship_vel.normalized() * SHIP_MAX_SPEED;
                }
            }
        }

        let can_fire = self.fsm.as_mut().unwrap().ship.can_fire();
        let in_flight = self.fsm.as_mut().unwrap().get_bullets_in_flight();
        let max_b = self.fsm.as_mut().unwrap().get_max_bullets();
        if can_fire && in_flight < max_b && input.is_key_pressed(Key::SPACE) {
            self.try_fire();
        }

        if input.is_key_pressed(Key::H) && !self.h_was_down {
            self.h_was_down = true;
            if self.fsm.as_mut().unwrap().ship.can_hyperspace() {
                self.fsm.as_mut().unwrap().ship_hyperspace();
            }
        } else if !input.is_key_pressed(Key::H) {
            self.h_was_down = false;
        }
    }

    fn update_ship(&mut self, dt: f32) {
        if !self.fsm.as_mut().unwrap().ship.is_visible() {
            return;
        }
        self.ship_vel *= 1.0 - SHIP_DRAG * dt;
        self.ship_pos += self.ship_vel * dt;
        let c = self.court_size;
        if self.ship_pos.x < 0.0 { self.ship_pos.x += c.x; }
        if self.ship_pos.x > c.x { self.ship_pos.x -= c.x; }
        if self.ship_pos.y < 0.0 { self.ship_pos.y += c.y; }
        if self.ship_pos.y > c.y { self.ship_pos.y -= c.y; }
    }

    fn try_fire(&mut self) {
        self.fsm.as_mut().unwrap().ship.fire();
        let dir = Vector2::new(self.ship_angle.cos(), self.ship_angle.sin());
        let muzzle = self.ship_pos + dir * SHIP_SIZE;
        self.bullets.push(Bullet { pos: muzzle, vel: dir * BULLET_SPEED + self.ship_vel, life: 0.0 });
        self.fsm.as_mut().unwrap().bullet_fired();
    }

    fn update_bullets(&mut self, dt: f32) {
        let c = self.court_size;
        let mut i = self.bullets.len() as i32 - 1;
        while i >= 0 {
            let idx = i as usize;
            let v = self.bullets[idx].vel;
            self.bullets[idx].pos += v * dt;
            self.bullets[idx].life += dt;
            let mut p = self.bullets[idx].pos;
            if p.x < 0.0 { p.x += c.x; }
            if p.x > c.x { p.x -= c.x; }
            if p.y < 0.0 { p.y += c.y; }
            if p.y > c.y { p.y -= c.y; }
            self.bullets[idx].pos = p;
            if self.bullets[idx].life >= BULLET_LIFETIME {
                self.bullets.remove(idx);
                self.fsm.as_mut().unwrap().bullet_expired();
            }
            i -= 1;
        }
    }

    fn check_collisions(&mut self) {
        let total = self.fsm.as_mut().unwrap().field.count();

        let mut bi = self.bullets.len() as i32 - 1;
        while bi >= 0 {
            let bpos = self.bullets[bi as usize].pos;
            let mut hit: i32 = -1;
            let mut i = 0;
            while i < total {
                let f = &mut self.fsm.as_mut().unwrap().field;
                if f.is_alive(i) && f.position(i).distance_to(bpos) < f.radius_of(i) {
                    hit = i;
                    break;
                }
                i += 1;
            }
            if hit >= 0 {
                self.fsm.as_mut().unwrap().bullet_hit_asteroid(hit);
                self.bullets.remove(bi as usize);
                self.fsm.as_mut().unwrap().bullet_expired();
            }
            bi -= 1;
        }

        if self.fsm.as_mut().unwrap().ship.can_be_hit() {
            let ship_pos = self.ship_pos;
            let mut i = 0;
            while i < total {
                let f = &mut self.fsm.as_mut().unwrap().field;
                if f.is_alive(i) && f.position(i).distance_to(ship_pos) < f.radius_of(i) + SHIP_SIZE * 0.6 {
                    self.fsm.as_mut().unwrap().ship_hit_asteroid(i);
                    break;
                }
                i += 1;
            }
        }
    }

    fn update_labels(&mut self) {
        let g = self.fsm.as_mut().unwrap();
        let hud = format!(
            "SCORE  {:05}     LIVES  {}     WAVE  {}     DIFF  {}     WARP  {}",
            g.get_score(), g.get_lives(), g.get_wave(), g.get_difficulty(),
            g.ship.get_hyperspaces_remaining()
        );
        let state = self.fsm.as_mut().unwrap().get_current_state_name();
        // Device-aware hints: touch shows the button glyphs ↻/⚡/⏸, keyboard
        // shows the keys R/H/P.
        let touch = DisplayServer::singleton().is_touchscreen_available();
        let (verb, rtok, htok, ptok, startmsg) = if touch {
            ("Tap", "↻", "⚡", "⏸", "Tap to start")
        } else {
            ("Press", "R", "H", "P", "Press any key to start")
        };
        let center = match state.to_string().as_str() {
            "Attract" => format!("A S T E R O I D S\n\n{startmsg}\n({htok} hyperspace · {ptok} pause)"),
            "WaveClear" => "WAVE CLEAR".to_string(),
            "Paused" => "PAUSED".to_string(),
            "GameOver" => format!("GAME OVER\n\n{verb} {rtok} to restart"),
            _ => String::new(),
        };
        if let Some(l) = self.label_hud.as_mut() { l.set_text(&hud); }
        if let Some(l) = self.label_center.as_mut() { l.set_text(&center); }
    }

    fn draw_asteroid(&mut self, at: Vector2, radius: f32) {
        self.base_mut().draw_arc(at, radius, 0.0, std::f32::consts::TAU, 32, COL_ROCK);
    }

    fn draw_ship(&mut self, at: Vector2, angle: f32, flame: bool) {
        let nose = at + Vector2::new(angle.cos(), angle.sin()) * SHIP_SIZE;
        let left = at + Vector2::new((angle + 2.5).cos(), (angle + 2.5).sin()) * SHIP_SIZE;
        let right = at + Vector2::new((angle - 2.5).cos(), (angle - 2.5).sin()) * SHIP_SIZE;
        let poly = PackedVector2Array::from(&[nose, left, right]);
        self.base_mut().draw_colored_polygon(&poly, COL_SHIP);
        if flame {
            let tail_base = (left + right) * 0.5;
            let tail_tip = at - Vector2::new(angle.cos(), angle.sin()) * SHIP_SIZE * 1.4;
            self.base_mut().draw_line(tail_base, tail_tip, COL_FLAME);
        }
    }

    fn draw_explosion(&mut self, at: Vector2) {
        let mut i = 0;
        while i < 8 {
            let t = i as f32 / 8.0 * std::f32::consts::TAU;
            let p1 = at + Vector2::new(t.cos(), t.sin()) * 4.0;
            let p2 = at + Vector2::new(t.cos(), t.sin()) * 14.0;
            self.base_mut().draw_line(p1, p2, COL_SHIP);
            i += 1;
        }
    }
}

fn rf() -> f32 { godot::global::randf() as f32 }
