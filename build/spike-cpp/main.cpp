// Asteroids — C++/godot-cpp gameplay driver (port of main.gd / gameplay.rs).
// A Node2D that owns the Frame AsteroidsGame controller, handles ship
// physics + input + collisions, renders the scene, and exposes the four
// host effects the Ship FSM fires via call_deferred.
#include <godot_cpp/classes/node2d.hpp>
#include <godot_cpp/classes/input.hpp>
#include <godot_cpp/classes/label.hpp>
#include <godot_cpp/classes/canvas_layer.hpp>
#include <godot_cpp/classes/time.hpp>
#include <godot_cpp/classes/rendering_server.hpp>
#include <godot_cpp/classes/display_server.hpp>
#include <godot_cpp/core/class_db.hpp>
#include <godot_cpp/variant/utility_functions.hpp>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif
#include <vector>
#include <cmath>
#include <cstdio>

#include "asteroids.cpp"

using namespace godot;

static const Color COL_BG(0, 0, 0, 1);
static const Color COL_SHIP(0x8a / 255.0f, 0xb4 / 255.0f, 0xf8 / 255.0f);
static const Color COL_ROCK(0x9a / 255.0f, 0xa4 / 255.0f, 0xb8 / 255.0f);
static const Color COL_BULLET(1, 1, 1);
static const Color COL_FLAME(1, 0.68f, 0.26f);

static const float SHIP_THRUST = 240.0f;
static const float SHIP_ROTATION_SPEED = 4.0f;
static const float SHIP_MAX_SPEED = 320.0f;
static const float SHIP_DRAG = 0.5f;
static const float SHIP_SIZE = 14.0f;
static const float BULLET_SPEED = 500.0f;
static const float BULLET_LIFETIME = 1.2f;
static const float BULLET_SIZE = 2.0f;
static const float PI_F = 3.14159265f;
static const float TAU_F = 6.2831853f;

struct Bullet {
    Vector2 pos;
    Vector2 vel;
    float life;
};

class AsteroidsMain : public Node2D {
    GDCLASS(AsteroidsMain, Node2D)

    AsteroidsGame* fsm = nullptr;   // deferred to _ready — NOT a default member
    Vector2 ship_pos;
    Vector2 ship_vel;
    float ship_angle = -PI_F * 0.5f;
    std::vector<Bullet> bullets;
    bool p_was_down = false;
    bool h_was_down = false;
    Label* label_hud = nullptr;
    Label* label_center = nullptr;
    Vector2 court_size = Vector2(800, 600);
    int difficulty = 2;
    std::string last_pub;           // last FSM snapshot published (dedup)

protected:
    static void _bind_methods() {
        ClassDB::bind_method(D_METHOD("reset_ship"), &AsteroidsMain::reset_ship);
        ClassDB::bind_method(D_METHOD("warp_out"), &AsteroidsMain::warp_out);
        ClassDB::bind_method(D_METHOD("warp_in"), &AsteroidsMain::warp_in);
        ClassDB::bind_method(D_METHOD("spawn_explosion"), &AsteroidsMain::spawn_explosion);
    }

public:
    void _ready() override {
        fsm = new AsteroidsGame(AsteroidsGame::__create(this, difficulty));
        RenderingServer::get_singleton()->set_default_clear_color(COL_BG);
        build_ui();
        reset_ship();
    }

    void _physics_process(double delta) override {
        float dt = (float)delta;
        handle_input(dt);

        std::string state = fsm->get_current_state_name();
        if (!fsm->is_paused() && state != "Attract" && state != "GameOver") {
            fsm->tick(dt, court_size);
            update_ship(dt);
            update_bullets(dt);
            check_collisions();
        }
        update_labels();
        publish_state();
        queue_redraw();
    }

    // Live FSM state → BroadcastChannel, web only (the site's diagram panel
    // listens on frame-games:state:<id>). Mirrors the C/Rust ports.
    void publish_state() {
#ifdef __EMSCRIPTEN__
        std::string g = fsm->get_current_state_name();
        std::string s = fsm->ship->get_current_state_name();
        std::string snap = g + "|" + s;
        if (snap == last_pub) return;
        last_pub = snap;
        char js[256];
        snprintf(js, sizeof js,
            "(window._fgChan||(window._fgChan=new BroadcastChannel('frame-games:state:asteroids')))"
            ".postMessage({AsteroidsGame:'%s',Ship:'%s',AsteroidField:'Active'})", g.c_str(), s.c_str());
        emscripten_run_script(js);
#endif
    }

    void _draw() override {
        std::string state = fsm->get_current_state_name();

        int total = fsm->field->count();
        int i = 0;
        while (i < total) {
            if (fsm->field->is_alive(i)) {
                draw_asteroid(fsm->field->position(i), fsm->field->radius_of(i));
            }
            i += 1;
        }
        for (const Bullet& b : bullets) {
            draw_circle(b.pos, BULLET_SIZE, COL_BULLET);
        }
        if (state != "Attract" && state != "GameOver" && fsm->ship->is_visible()) {
            std::string ship_state = fsm->ship->get_current_state_name();
            if (ship_state == "Exploding") {
                draw_explosion(ship_pos);
            } else {
                bool visible = true;
                if (ship_state == "Respawning") {
                    visible = (Time::get_singleton()->get_ticks_msec() / 100) % 2 == 0;
                }
                if (visible) {
                    draw_ship(ship_pos, ship_angle);
                }
            }
        }
    }

    // ---- Host surface — Ship fires these via call_deferred ----
    void reset_ship() {
        ship_pos = court_size * 0.5;
        ship_vel = Vector2();
        ship_angle = -PI_F * 0.5f;
        int n = (int)bullets.size();
        for (int k = 0; k < n; k++) {
            fsm->bullet_expired();
        }
        bullets.clear();
    }

    void warp_out() {
        ship_pos = Vector2(rf() * court_size.x, rf() * court_size.y);
        ship_vel = Vector2();
    }

    void warp_in() {}
    void spawn_explosion() {}

private:
    void build_ui() {
        CanvasLayer* canvas = memnew(CanvasLayer);
        add_child(canvas);

        label_hud = memnew(Label);
        label_hud->add_theme_font_size_override("font_size", 18);
        label_hud->set_position(Vector2(10, 6));
        label_hud->set_size(Vector2(court_size.x - 20, 28));
        canvas->add_child(label_hud);

        label_center = memnew(Label);
        label_center->add_theme_font_size_override("font_size", 28);
        label_center->set_position(Vector2(0, court_size.y * 0.4f));
        label_center->set_size(Vector2(court_size.x, 120));
        label_center->set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
        label_center->set_vertical_alignment(VERTICAL_ALIGNMENT_CENTER);
        canvas->add_child(label_center);
    }

    bool thrust_held() {
        Input* in = Input::get_singleton();
        return in->is_key_pressed(KEY_UP) || in->is_key_pressed(KEY_W);
    }

    void handle_input(float dt) {
        Input* in = Input::get_singleton();
        std::string state = fsm->get_current_state_name();

        if (state == "Attract") {
            if (in->is_anything_pressed()) {
                fsm->start();
                bullets.clear();
            }
            return;
        }
        if (state == "GameOver") {
            if (in->is_key_pressed(KEY_R)) {
                fsm->restart();
                fsm->start();
                bullets.clear();
            }
            return;
        }

        if (in->is_key_pressed(KEY_P) && !p_was_down) {
            p_was_down = true;
            if (fsm->is_paused()) { fsm->resume(); } else { fsm->pause(); }
        } else if (!in->is_key_pressed(KEY_P)) {
            p_was_down = false;
        }

        if (fsm->is_paused()) { return; }
        if (!fsm->ship->is_visible()) { return; }

        if (in->is_key_pressed(KEY_LEFT) || in->is_key_pressed(KEY_A)) {
            ship_angle -= SHIP_ROTATION_SPEED * dt;
        }
        if (in->is_key_pressed(KEY_RIGHT) || in->is_key_pressed(KEY_D)) {
            ship_angle += SHIP_ROTATION_SPEED * dt;
        }

        std::string ship_state = fsm->ship->get_current_state_name();
        if (ship_state == "Alive" || ship_state == "Respawning") {
            if (in->is_key_pressed(KEY_UP) || in->is_key_pressed(KEY_W)) {
                ship_vel += Vector2(std::cos(ship_angle), std::sin(ship_angle)) * SHIP_THRUST * dt;
                if (ship_vel.length() > SHIP_MAX_SPEED) {
                    ship_vel = ship_vel.normalized() * SHIP_MAX_SPEED;
                }
            }
        }

        if (fsm->ship->can_fire() && fsm->get_bullets_in_flight() < fsm->get_max_bullets()
            && in->is_key_pressed(KEY_SPACE)) {
            try_fire();
        }

        if (in->is_key_pressed(KEY_H) && !h_was_down) {
            h_was_down = true;
            if (fsm->ship->can_hyperspace()) { fsm->ship_hyperspace(); }
        } else if (!in->is_key_pressed(KEY_H)) {
            h_was_down = false;
        }
    }

    void update_ship(float dt) {
        if (!fsm->ship->is_visible()) { return; }
        ship_vel *= (1.0f - SHIP_DRAG * dt);
        ship_pos += ship_vel * dt;
        if (ship_pos.x < 0.0) { ship_pos.x += court_size.x; }
        if (ship_pos.x > court_size.x) { ship_pos.x -= court_size.x; }
        if (ship_pos.y < 0.0) { ship_pos.y += court_size.y; }
        if (ship_pos.y > court_size.y) { ship_pos.y -= court_size.y; }
    }

    void try_fire() {
        fsm->ship->fire();
        Vector2 dir = Vector2(std::cos(ship_angle), std::sin(ship_angle));
        Vector2 muzzle = ship_pos + dir * SHIP_SIZE;
        bullets.push_back(Bullet{ muzzle, dir * BULLET_SPEED + ship_vel, 0.0f });
        fsm->bullet_fired();
    }

    void update_bullets(float dt) {
        int i = (int)bullets.size() - 1;
        while (i >= 0) {
            bullets[i].pos += bullets[i].vel * dt;
            bullets[i].life += dt;
            if (bullets[i].pos.x < 0.0) { bullets[i].pos.x += court_size.x; }
            if (bullets[i].pos.x > court_size.x) { bullets[i].pos.x -= court_size.x; }
            if (bullets[i].pos.y < 0.0) { bullets[i].pos.y += court_size.y; }
            if (bullets[i].pos.y > court_size.y) { bullets[i].pos.y -= court_size.y; }
            if (bullets[i].life >= BULLET_LIFETIME) {
                bullets.erase(bullets.begin() + i);
                fsm->bullet_expired();
            }
            i -= 1;
        }
    }

    void check_collisions() {
        int total = fsm->field->count();

        int bi = (int)bullets.size() - 1;
        while (bi >= 0) {
            Vector2 bpos = bullets[bi].pos;
            int hit = -1;
            int i = 0;
            while (i < total) {
                if (fsm->field->is_alive(i) && fsm->field->position(i).distance_to(bpos) < fsm->field->radius_of(i)) {
                    hit = i;
                    break;
                }
                i += 1;
            }
            if (hit >= 0) {
                fsm->bullet_hit_asteroid(hit);
                bullets.erase(bullets.begin() + bi);
                fsm->bullet_expired();
            }
            bi -= 1;
        }

        if (fsm->ship->can_be_hit()) {
            int i = 0;
            while (i < total) {
                if (fsm->field->is_alive(i) && fsm->field->position(i).distance_to(ship_pos) < fsm->field->radius_of(i) + SHIP_SIZE * 0.6f) {
                    fsm->ship_hit_asteroid(i);
                    break;
                }
                i += 1;
            }
        }
    }

    void update_labels() {
        char buf[160];
        snprintf(buf, sizeof(buf),
            "SCORE  %05d     LIVES  %d     WAVE  %d     DIFF  %d     WARP  %d",
            fsm->get_score(), fsm->get_lives(), fsm->get_wave(), fsm->get_difficulty(),
            fsm->ship->get_hyperspaces_remaining());
        if (label_hud) { label_hud->set_text(String(buf)); }

        std::string state = fsm->get_current_state_name();
        // Device-aware hints: touch shows the button glyphs ↻/⚡/⏸, keyboard
        // shows the keys R/H/P.
        bool touch = DisplayServer::get_singleton()->is_touchscreen_available();
        const char* verb  = touch ? "Tap" : "Press";
        const char* rtok  = touch ? "↻" : "R";   // ↻
        const char* htok  = touch ? "⚡" : "H";   // ⚡
        const char* ptok  = touch ? "⏸" : "P";   // ⏸
        const char* startmsg = touch ? "Tap to start" : "Press any key to start";
        std::string center;
        if (state == "Attract")
            center = std::string("A S T E R O I D S\n\n") + startmsg + "\n(" + htok + " hyperspace · " + ptok + " pause)";
        else if (state == "WaveClear") center = "WAVE CLEAR";
        else if (state == "Paused") center = "PAUSED";
        else if (state == "GameOver")
            center = std::string("GAME OVER\n\n") + verb + " " + rtok + " to restart";
        if (label_center) { label_center->set_text(String::utf8(center.c_str())); }
    }

    void draw_asteroid(Vector2 at, float radius) {
        draw_arc(at, radius, 0.0, TAU_F, 32, COL_ROCK, 2.0);
    }

    void draw_ship(Vector2 at, float angle) {
        Vector2 nose = at + Vector2(std::cos(angle), std::sin(angle)) * SHIP_SIZE;
        Vector2 left = at + Vector2(std::cos(angle + 2.5f), std::sin(angle + 2.5f)) * SHIP_SIZE;
        Vector2 right = at + Vector2(std::cos(angle - 2.5f), std::sin(angle - 2.5f)) * SHIP_SIZE;
        PackedVector2Array poly;
        poly.push_back(nose);
        poly.push_back(left);
        poly.push_back(right);
        draw_colored_polygon(poly, COL_SHIP);
        if (thrust_held()) {
            std::string ss = fsm->ship->get_current_state_name();
            if (ss == "Alive" || ss == "Respawning") {
                Vector2 tail_base = (left + right) * 0.5;
                Vector2 tail_tip = at - Vector2(std::cos(angle), std::sin(angle)) * SHIP_SIZE * 1.4f;
                draw_line(tail_base, tail_tip, COL_FLAME, 1.5);
            }
        }
    }

    void draw_explosion(Vector2 at) {
        int i = 0;
        while (i < 8) {
            float t = (float)i / 8.0f * TAU_F;
            Vector2 p1 = at + Vector2(std::cos(t), std::sin(t)) * 4.0f;
            Vector2 p2 = at + Vector2(std::cos(t), std::sin(t)) * 14.0f;
            draw_line(p1, p2, COL_SHIP, 2.0);
            i += 1;
        }
    }
};
