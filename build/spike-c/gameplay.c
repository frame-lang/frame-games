// Asteroids — raw GDExtension C gameplay host (port of main.cpp / gameplay.rs).
//
// No binding library: every engine call goes through the GDExtension C ABI —
// classdb_get_method_bind(class, method, version-hash) + ptrcall. Method-bind
// hashes are the real Godot 4.6.2 values pulled from extension_api.json; they
// validate only at runtime, so this is authored against the dump and verified
// in-browser after the Godot wedge clears.
//
// The Frame Ship FSM drives host effects through a ShipHost struct of direct C
// function pointers (no call_deferred needed in C — synchronous callbacks into
// `self` are fine), so the only ClassDB surface here is the class + 3 virtuals
// (_ready / _physics_process / _draw). No bound methods.

#include "gdextension_interface.h"
#include "asteroids.c"

#ifndef GDE_EXPORT
#define GDE_EXPORT __attribute__((visibility("default")))
#endif
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdint.h>

// ───────────────────────── tunables (mirror main.cpp) ─────────────────────────
#define SHIP_THRUST         240.0f
#define SHIP_ROTATION_SPEED 4.0f
#define SHIP_MAX_SPEED      320.0f
#define SHIP_DRAG           0.5f
#define SHIP_SIZE           14.0f
#define BULLET_SPEED        500.0f
#define BULLET_LIFETIME     1.2f
#define BULLET_SIZE         2.0f
#define PI_F                3.14159265f
#define TAU_F               6.2831853f
#define MAX_BULLETS         32

// Key enum values (from extension_api.json global_enums Key)
#define KEY_SPACE 32
#define KEY_LEFT  4194319
#define KEY_RIGHT 4194321
#define KEY_UP    4194320
#define KEY_A 65
#define KEY_D 68
#define KEY_W 87
#define KEY_P 80
#define KEY_H 72
#define KEY_R 82

typedef struct { float r, g, b, a; } GdColor;  // Godot Color (single precision)
// Godot Vector2 is {float,float} == FSM's Vector2; reused directly as a typeptr.

static const GdColor COL_BG     = {0,0,0,1};
static const GdColor COL_SHIP   = {0x8a/255.0f, 0xb4/255.0f, 0xf8/255.0f, 1};
static const GdColor COL_ROCK   = {0x9a/255.0f, 0xa4/255.0f, 0xb8/255.0f, 1};
static const GdColor COL_BULLET = {1,1,1,1};
static const GdColor COL_FLAME  = {1, 0.68f, 0.26f, 1};

typedef struct { Vector2 pos, vel; float life; } Bullet;

typedef struct AsteroidsMain {
    GDExtensionObjectPtr owner;     // the Godot Node2D object
    AsteroidsGame* fsm;
    ShipHost host;                  // direct C callbacks the Ship FSM fires
    Vector2 ship_pos, ship_vel;
    float ship_angle;
    Bullet bullets[MAX_BULLETS];
    int bullet_count;
    bool p_was_down, h_was_down;
    Vector2 court_size;
    int difficulty;
    char last_pub[96];              // last FSM snapshot published (dedup)
} AsteroidsMain;

// ───────────────────────── cached GDExtension interface ─────────────────────────
static GDExtensionInterfaceGetProcAddress    g_get_proc;
static GDExtensionClassLibraryPtr            g_library;

static GDExtensionInterfaceStringNameNewWithLatin1Chars  i_snnew;
static GDExtensionInterfaceClassdbConstructObject2       i_construct;
static GDExtensionInterfaceObjectSetInstance             i_set_instance;
static GDExtensionInterfaceObjectSetInstanceBinding      i_set_binding;
static GDExtensionInterfaceClassdbRegisterExtensionClass3 i_register_class;
static GDExtensionInterfaceClassdbGetMethodBind          i_get_method;
static GDExtensionInterfaceObjectMethodBindPtrcall       i_ptrcall;
static GDExtensionInterfaceGlobalGetSingleton            i_get_singleton;
static GDExtensionInterfaceMemAlloc                      i_alloc;
static GDExtensionInterfaceMemFree                       i_free;
static GDExtensionInterfaceStringNewWithUtf8Chars        i_strnew;
static GDExtensionInterfaceVariantGetPtrDestructor       i_get_destructor;

// interned StringNames (single-pointer interned repr; compared by that pointer)
typedef struct { void* p; } SN;          // a StringName is sizeof(void*)
static SN sn_class, sn_node2d, sn_ready, sn_phys, sn_draw;

static void make_sn(SN* dst, const char* s) { i_snnew(dst, s, 0); }
static inline bool sn_eq(GDExtensionConstStringNamePtr a, const SN* b) {
    return *(void* const*)a == b->p;   // interned: same string -> same pointer
}

// ───────────────────────── method-bind ptrcall helpers ─────────────────────────
static GDExtensionMethodBindPtr bind_of(const char* cls, const char* meth, int64_t hash,
                                        GDExtensionMethodBindPtr* cache) {
    if (!*cache) {
        SN c, m; make_sn(&c, cls); make_sn(&m, meth);
        *cache = i_get_method(&c, &m, (GDExtensionInt)hash);
    }
    return *cache;
}
#define CALL(inst, args, ret, cls, meth, hash) do { \
    static GDExtensionMethodBindPtr _mb = NULL; \
    i_ptrcall(bind_of(cls, meth, hash, &_mb), (inst), (const GDExtensionConstTypePtr*)(args), (ret)); \
} while (0)

// singletons (cached)
static GDExtensionObjectPtr g_input, g_time, g_rendering, g_themedb, g_display;
static GDExtensionObjectPtr singleton(const char* name, GDExtensionObjectPtr* cache) {
    if (!*cache) { SN s; make_sn(&s, name); *cache = i_get_singleton(&s); }
    return *cache;
}

// ───────────────────────── engine call wrappers ─────────────────────────
static bool input_key(int64_t key) {
    GDExtensionObjectPtr in = singleton("Input", &g_input);
    int64_t k = key; const void* args[] = { &k }; uint8_t ret = 0;
    CALL(in, args, &ret, "Input", "is_key_pressed", 1938909964);
    return ret != 0;
}
static bool input_anything(void) {
    GDExtensionObjectPtr in = singleton("Input", &g_input);
    uint8_t ret = 0; CALL(in, (const void**)0, &ret, "Input", "is_anything_pressed", 36873697);
    return ret != 0;
}
static int64_t time_ticks_msec(void) {
    GDExtensionObjectPtr t = singleton("Time", &g_time);
    int64_t ret = 0; CALL(t, (const void**)0, &ret, "Time", "get_ticks_msec", 3905245786);
    return ret;
}
static void set_clear_color(GdColor c) {
    GDExtensionObjectPtr rs = singleton("RenderingServer", &g_rendering);
    const void* args[] = { &c }; CALL(rs, args, (void*)0, "RenderingServer", "set_default_clear_color", 2920490490);
}
static void d_queue_redraw(AsteroidsMain* s) {
    CALL(s->owner, (const void**)0, (void*)0, "CanvasItem", "queue_redraw", 3218959716);
}
static void d_circle(AsteroidsMain* s, Vector2 pos, double radius, GdColor col) {
    uint8_t filled = 1, aa = 0; double width = -1.0;
    const void* args[] = { &pos, &radius, &col, &filled, &width, &aa };
    CALL(s->owner, args, (void*)0, "CanvasItem", "draw_circle", 3153026596);
}
static void d_line(AsteroidsMain* s, Vector2 a, Vector2 b, GdColor col, double width) {
    uint8_t aa = 0; const void* args[] = { &a, &b, &col, &width, &aa };
    CALL(s->owner, args, (void*)0, "CanvasItem", "draw_line", 1562330099);
}
static void d_arc(AsteroidsMain* s, Vector2 c, double radius, double a0, double a1,
                  int64_t pts, GdColor col, double width) {
    uint8_t aa = 0; const void* args[] = { &c, &radius, &a0, &a1, &pts, &col, &width, &aa };
    CALL(s->owner, args, (void*)0, "CanvasItem", "draw_arc", 4140652635);
}

// ───────────────────────── small helpers ─────────────────────────
static inline Vector2 vadd(Vector2 a, Vector2 b){ return v2(a.x+b.x, a.y+b.y); }
static inline Vector2 vscale(Vector2 a, float s){ return v2(a.x*s, a.y*s); }
static inline float vlen(Vector2 a){ return sqrtf(a.x*a.x + a.y*a.y); }
static inline float vdist(Vector2 a, Vector2 b){ return sqrtf((a.x-b.x)*(a.x-b.x)+(a.y-b.y)*(a.y-b.y)); }
static inline float clampf(float x, float lo, float hi){ return x<lo?lo:(x>hi?hi:x); }
static void wrap(Vector2* p, Vector2 court){
    if (p->x < 0) p->x += court.x; if (p->x > court.x) p->x -= court.x;
    if (p->y < 0) p->y += court.y; if (p->y > court.y) p->y -= court.y;
}

// ───────────────────────── host effects (ShipHost callbacks) ─────────────────────────
static void host_reset_ship(void* ctx) {
    AsteroidsMain* s = (AsteroidsMain*)ctx;
    s->ship_pos = vscale(s->court_size, 0.5f);
    s->ship_vel = v2(0,0);
    s->ship_angle = -PI_F * 0.5f;
    for (int k = 0; k < s->bullet_count; k++) AsteroidsGame_bullet_expired(s->fsm);
    s->bullet_count = 0;
}
static void host_warp_out(void* ctx) {
    AsteroidsMain* s = (AsteroidsMain*)ctx;
    s->ship_pos = v2(fld_rf()*s->court_size.x, fld_rf()*s->court_size.y);
    s->ship_vel = v2(0,0);
}
static void host_warp_in(void* ctx)         { (void)ctx; }
static void host_spawn_explosion(void* ctx) { (void)ctx; }

// ───────────────────────── gameplay (mirrors main.cpp) ─────────────────────────
static bool thrust_held(void){ return input_key(KEY_UP) || input_key(KEY_W); }

static void try_fire(AsteroidsMain* s) {
    if (s->bullet_count >= MAX_BULLETS) return;
    Ship_fire(s->fsm->ship);
    Vector2 dir = v2(cosf(s->ship_angle), sinf(s->ship_angle));
    Vector2 muzzle = vadd(s->ship_pos, vscale(dir, SHIP_SIZE));
    s->bullets[s->bullet_count++] = (Bullet){ muzzle, vadd(vscale(dir, BULLET_SPEED), s->ship_vel), 0.0f };
    AsteroidsGame_bullet_fired(s->fsm);
}

static void handle_input(AsteroidsMain* s, float dt) {
    const char* state = AsteroidsGame_get_current_state_name(s->fsm);
    if (strcmp(state, "Attract") == 0) {
        if (input_anything()) { AsteroidsGame_start(s->fsm); s->bullet_count = 0; }
        return;
    }
    if (strcmp(state, "GameOver") == 0) {
        if (input_key(KEY_R)) { AsteroidsGame_restart(s->fsm); AsteroidsGame_start(s->fsm); s->bullet_count = 0; }
        return;
    }
    if (input_key(KEY_P) && !s->p_was_down) {
        s->p_was_down = true;
        if (AsteroidsGame_is_paused(s->fsm)) AsteroidsGame_resume(s->fsm); else AsteroidsGame_pause(s->fsm);
    } else if (!input_key(KEY_P)) s->p_was_down = false;

    if (AsteroidsGame_is_paused(s->fsm)) return;
    if (!Ship_is_visible(s->fsm->ship)) return;

    if (input_key(KEY_LEFT) || input_key(KEY_A)) s->ship_angle -= SHIP_ROTATION_SPEED * dt;
    if (input_key(KEY_RIGHT) || input_key(KEY_D)) s->ship_angle += SHIP_ROTATION_SPEED * dt;

    const char* ss = Ship_get_current_state_name(s->fsm->ship);
    if (strcmp(ss, "Alive") == 0 || strcmp(ss, "Respawning") == 0) {
        if (input_key(KEY_UP) || input_key(KEY_W)) {
            s->ship_vel = vadd(s->ship_vel, vscale(v2(cosf(s->ship_angle), sinf(s->ship_angle)), SHIP_THRUST*dt));
            float spd = vlen(s->ship_vel);
            if (spd > SHIP_MAX_SPEED) s->ship_vel = vscale(s->ship_vel, SHIP_MAX_SPEED/spd);
        }
    }
    if (Ship_can_fire(s->fsm->ship)
        && AsteroidsGame_get_bullets_in_flight(s->fsm) < AsteroidsGame_get_max_bullets(s->fsm)
        && input_key(KEY_SPACE)) try_fire(s);

    if (input_key(KEY_H) && !s->h_was_down) {
        s->h_was_down = true;
        if (Ship_can_hyperspace(s->fsm->ship)) AsteroidsGame_ship_hyperspace(s->fsm);
    } else if (!input_key(KEY_H)) s->h_was_down = false;
}

static void update_ship(AsteroidsMain* s, float dt) {
    if (!Ship_is_visible(s->fsm->ship)) return;
    s->ship_vel = vscale(s->ship_vel, 1.0f - SHIP_DRAG*dt);
    s->ship_pos = vadd(s->ship_pos, vscale(s->ship_vel, dt));
    wrap(&s->ship_pos, s->court_size);
}
static void update_bullets(AsteroidsMain* s, float dt) {
    for (int i = s->bullet_count - 1; i >= 0; i--) {
        s->bullets[i].pos = vadd(s->bullets[i].pos, vscale(s->bullets[i].vel, dt));
        s->bullets[i].life += dt;
        wrap(&s->bullets[i].pos, s->court_size);
        if (s->bullets[i].life >= BULLET_LIFETIME) {
            s->bullets[i] = s->bullets[--s->bullet_count];
            AsteroidsGame_bullet_expired(s->fsm);
        }
    }
}
static void check_collisions(AsteroidsMain* s) {
    int total = AsteroidField_count(s->fsm->field);
    for (int bi = s->bullet_count - 1; bi >= 0; bi--) {
        Vector2 bp = s->bullets[bi].pos; int hit = -1;
        for (int i = 0; i < total; i++) {
            if (AsteroidField_is_alive(s->fsm->field, i)
                && vdist(AsteroidField_position(s->fsm->field, i), bp) < AsteroidField_radius_of(s->fsm->field, i)) { hit = i; break; }
        }
        if (hit >= 0) {
            AsteroidsGame_bullet_hit_asteroid(s->fsm, hit);
            s->bullets[bi] = s->bullets[--s->bullet_count];
            AsteroidsGame_bullet_expired(s->fsm);
        }
    }
    if (Ship_can_be_hit(s->fsm->ship)) {
        for (int i = 0; i < total; i++) {
            if (AsteroidField_is_alive(s->fsm->field, i)
                && vdist(AsteroidField_position(s->fsm->field, i), s->ship_pos) < AsteroidField_radius_of(s->fsm->field, i) + SHIP_SIZE*0.6f) {
                AsteroidsGame_ship_hit_asteroid(s->fsm, i); break;
            }
        }
    }
}

// ───────────────────────── rendering ─────────────────────────
static void draw_ship(AsteroidsMain* s, Vector2 at, float ang) {
    Vector2 nose  = vadd(at, vscale(v2(cosf(ang),        sinf(ang)),        SHIP_SIZE));
    Vector2 left  = vadd(at, vscale(v2(cosf(ang+2.5f),   sinf(ang+2.5f)),   SHIP_SIZE));
    Vector2 right = vadd(at, vscale(v2(cosf(ang-2.5f),   sinf(ang-2.5f)),   SHIP_SIZE));
    d_line(s, nose, left, COL_SHIP, 1.5);   // wireframe triangle (no PackedVector2Array)
    d_line(s, left, right, COL_SHIP, 1.5);
    d_line(s, right, nose, COL_SHIP, 1.5);
    if (thrust_held()) {
        const char* ss = Ship_get_current_state_name(s->fsm->ship);
        if (strcmp(ss,"Alive")==0 || strcmp(ss,"Respawning")==0) {
            Vector2 tail_base = vscale(vadd(left, right), 0.5f);
            Vector2 tail_tip = vadd(at, vscale(v2(cosf(ang), sinf(ang)), -SHIP_SIZE*1.4f));
            d_line(s, tail_base, tail_tip, COL_FLAME, 1.5);
        }
    }
}
static void draw_explosion(AsteroidsMain* s, Vector2 at) {
    for (int i = 0; i < 8; i++) {
        float t = (float)i/8.0f*TAU_F;
        d_line(s, vadd(at, vscale(v2(cosf(t),sinf(t)),4.0f)),
                  vadd(at, vscale(v2(cosf(t),sinf(t)),14.0f)), COL_SHIP, 2.0);
    }
}

// ───────────────────────── virtuals ─────────────────────────
static void v_ready(GDExtensionClassInstancePtr inst, const GDExtensionConstTypePtr* args, GDExtensionTypePtr ret) {
    (void)args; (void)ret;
    AsteroidsMain* s = (AsteroidsMain*)inst;
    s->host.warp_out = host_warp_out; s->host.warp_in = host_warp_in;
    s->host.spawn_explosion = host_spawn_explosion; s->host.reset_ship = host_reset_ship;
    s->host.ctx = s;
    s->fsm = AsteroidsGame_create(&s->host, s->difficulty);
    set_clear_color(COL_BG);
    host_reset_ship(s);
}

// Live FSM state → BroadcastChannel, web only (the site's diagram panel listens
// on frame-games:state:<id>). Posts a {AsteroidsGame, Ship, AsteroidField}
// snapshot on change, mirroring the GDScript version's live_state_publisher.
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
static void publish_state(AsteroidsMain* s) {
    const char* g = AsteroidsGame_get_current_state_name(s->fsm);
    const char* sh = Ship_get_current_state_name(s->fsm->ship);
    char snap[96];
    snprintf(snap, sizeof snap, "%s|%s", g, sh);
    if (strcmp(snap, s->last_pub) == 0) return;          // unchanged
    snprintf(s->last_pub, sizeof s->last_pub, "%s", snap);
    char js[256];
    snprintf(js, sizeof js,
        "(window._fgChan||(window._fgChan=new BroadcastChannel('frame-games:state:asteroids')))"
        ".postMessage({AsteroidsGame:'%s',Ship:'%s',AsteroidField:'Active'})", g, sh);
    emscripten_run_script(js);
}
#else
static void publish_state(AsteroidsMain* s) { (void)s; }
#endif

static void v_physics_process(GDExtensionClassInstancePtr inst, const GDExtensionConstTypePtr* args, GDExtensionTypePtr ret) {
    (void)ret;
    AsteroidsMain* s = (AsteroidsMain*)inst;
    float dt = (float)(*(const double*)args[0]);
    handle_input(s, dt);
    const char* state = AsteroidsGame_get_current_state_name(s->fsm);
    if (!AsteroidsGame_is_paused(s->fsm) && strcmp(state,"Attract")!=0 && strcmp(state,"GameOver")!=0) {
        Vector2 court = s->court_size;
        AsteroidsGame_tick(s->fsm, dt, court);
        update_ship(s, dt);
        update_bullets(s, dt);
        check_collisions(s);
    }
    publish_state(s);
    d_queue_redraw(s);
}

// ───────────────────────── text: HUD + device-aware center messages ─────────────────────────
static bool is_touch(void) {
    static int cached = -1;
    if (cached < 0) {
        GDExtensionObjectPtr ds = singleton("DisplayServer", &g_display);
        uint8_t r = 0; CALL(ds, (const void**)0, &r, "DisplayServer", "is_touchscreen_available", 36873697);
        cached = r ? 1 : 0;
    }
    return cached != 0;
}
static GDExtensionObjectPtr fallback_font(void) {
    static GDExtensionObjectPtr font = NULL;
    if (!font) {
        GDExtensionObjectPtr tdb = singleton("ThemeDB", &g_themedb);
        CALL(tdb, (const void**)0, &font, "ThemeDB", "get_fallback_font", 3656929885);
    }
    return font;
}
// draw_string via raw ptrcall. align: 0=left, 1=center. The godot String is
// pointer-sized (4 on wasm32, 8 on arm64), so a void* slot is exactly right.
static void draw_text(AsteroidsMain* s, const char* text, Vector2 pos, double width,
                      int64_t align, int64_t font_size, GdColor col) {
    static GDExtensionPtrDestructor str_dtor = NULL;
    void* str; i_strnew(&str, text);
    GDExtensionObjectPtr font = fallback_font();
    int64_t just = 3, dir = 0, ori = 0; double over = 0.0;
    const void* a[] = { &font, &pos, &str, &align, &width, &font_size, &col, &just, &dir, &ori, &over };
    CALL(s->owner, a, (void*)0, "CanvasItem", "draw_string", 719605945);
    if (!str_dtor) str_dtor = i_get_destructor(GDEXTENSION_VARIANT_TYPE_STRING);
    str_dtor(&str);
}
static void draw_hud(AsteroidsMain* s, const char* state) {
    static const GdColor COL_TEXT = {1, 1, 1, 1};
    char buf[160];
    snprintf(buf, sizeof buf, "SCORE  %05d     LIVES  %d     WAVE  %d     DIFF  %d     WARP  %d",
        AsteroidsGame_get_score(s->fsm), AsteroidsGame_get_lives(s->fsm),
        AsteroidsGame_get_wave(s->fsm), AsteroidsGame_get_difficulty(s->fsm),
        Ship_get_hyperspaces_remaining(s->fsm->ship));
    draw_text(s, buf, v2(12, 24), s->court_size.x - 24, 0, 18, COL_TEXT);

    // device-aware center message (multi-line): keys R/H/P on desktop, glyphs ↻/⚡/⏸ on touch
    bool t = is_touch();
    const char* verb  = t ? "Tap" : "Press";
    const char* rt    = t ? "↻" : "R";
    const char* ht    = t ? "⚡" : "H";
    const char* pt    = t ? "⏸" : "P";
    const char* start = t ? "Tap to start" : "Press any key to start";
    char msg[256] = "";
    if      (strcmp(state,"Attract")==0)  snprintf(msg, sizeof msg, "A S T E R O I D S\n\n%s\n(%s hyperspace · %s pause)", start, ht, pt);
    else if (strcmp(state,"WaveClear")==0) snprintf(msg, sizeof msg, "WAVE CLEAR");
    else if (strcmp(state,"Paused")==0)    snprintf(msg, sizeof msg, "PAUSED");
    else if (strcmp(state,"GameOver")==0)  snprintf(msg, sizeof msg, "GAME OVER\n\n%s %s to restart", verb, rt);
    if (!msg[0]) return;
    int lines = 1; for (char* c = msg; *c; c++) if (*c == '\n') lines++;
    float lh = 36.0f;
    float y0 = s->court_size.y * 0.4f - (lines - 1) * lh * 0.5f;
    char* line = msg; int idx = 0;
    for (char* c = msg; ; c++) {
        if (*c == '\n' || *c == '\0') {
            char save = *c; *c = '\0';
            draw_text(s, line, v2(0, y0 + idx * lh), s->court_size.x, 1, 28, COL_TEXT);
            *c = save; line = c + 1; idx++;
            if (save == '\0') break;
        }
    }
}

static void v_draw(GDExtensionClassInstancePtr inst, const GDExtensionConstTypePtr* args, GDExtensionTypePtr ret) {
    (void)args; (void)ret;
    AsteroidsMain* s = (AsteroidsMain*)inst;
    const char* state = AsteroidsGame_get_current_state_name(s->fsm);
    int total = AsteroidField_count(s->fsm->field);
    for (int i = 0; i < total; i++)
        if (AsteroidField_is_alive(s->fsm->field, i))
            d_arc(s, AsteroidField_position(s->fsm->field, i), AsteroidField_radius_of(s->fsm->field, i), 0.0, TAU_F, 32, COL_ROCK, 2.0);
    for (int i = 0; i < s->bullet_count; i++) d_circle(s, s->bullets[i].pos, BULLET_SIZE, COL_BULLET);
    if (strcmp(state,"Attract")!=0 && strcmp(state,"GameOver")!=0 && Ship_is_visible(s->fsm->ship)) {
        const char* ss = Ship_get_current_state_name(s->fsm->ship);
        if (strcmp(ss,"Exploding")==0) draw_explosion(s, s->ship_pos);
        else {
            bool visible = true;
            if (strcmp(ss,"Respawning")==0) visible = (time_ticks_msec()/100)%2==0;
            if (visible) draw_ship(s, s->ship_pos, s->ship_angle);
        }
    }
    draw_hud(s, state);
}

// ───────────────────────── class lifecycle ─────────────────────────
static const GDExtensionInstanceBindingCallbacks g_binding_cb = { NULL, NULL, NULL };

static GDExtensionObjectPtr create_instance(void* userdata) {
    (void)userdata;
    AsteroidsMain* s = (AsteroidsMain*)i_alloc(sizeof(AsteroidsMain));
    memset(s, 0, sizeof(*s));
    s->ship_angle = -PI_F*0.5f;
    s->court_size = v2(800, 600);
    s->difficulty = 2;
    GDExtensionObjectPtr obj = i_construct(&sn_node2d);
    s->owner = obj;
    i_set_instance(obj, &sn_class, s);
    i_set_binding(obj, g_library, s, &g_binding_cb);
    return obj;
}
static void free_instance(void* userdata, GDExtensionClassInstancePtr inst) {
    (void)userdata;
    AsteroidsMain* s = (AsteroidsMain*)inst;
    if (s->fsm) AsteroidsGame_destroy(s->fsm);
    i_free(s);
}
static GDExtensionClassCallVirtual get_virtual(void* userdata, GDExtensionConstStringNamePtr name) {
    (void)userdata;
    if (sn_eq(name, &sn_ready)) return v_ready;
    if (sn_eq(name, &sn_phys))  return v_physics_process;
    if (sn_eq(name, &sn_draw))  return v_draw;
    return NULL;
}

// ───────────────────────── registration / entry ─────────────────────────
static void* proc(const char* n){ return (void*)g_get_proc(n); }

static void initialize_level(void* userdata, GDExtensionInitializationLevel level) {
    (void)userdata;
    if (level != GDEXTENSION_INITIALIZATION_SCENE) return;
    make_sn(&sn_class,  "AsteroidsMain");
    make_sn(&sn_node2d, "Node2D");
    make_sn(&sn_ready,  "_ready");
    make_sn(&sn_phys,   "_physics_process");
    make_sn(&sn_draw,   "_draw");

    GDExtensionClassCreationInfo3 ci;
    memset(&ci, 0, sizeof(ci));
    ci.is_exposed = 1;
    ci.create_instance_func = create_instance;
    ci.free_instance_func = free_instance;
    ci.get_virtual_func = get_virtual;
    i_register_class(g_library, &sn_class, &sn_node2d, &ci);
}
static void deinitialize_level(void* userdata, GDExtensionInitializationLevel level) { (void)userdata; (void)level; }

GDExtensionBool GDE_EXPORT asteroids_library_init(
        GDExtensionInterfaceGetProcAddress p_get_proc_address,
        GDExtensionClassLibraryPtr p_library,
        GDExtensionInitialization* r_init) {
    g_get_proc = p_get_proc_address;
    g_library  = p_library;

    i_snnew         = (GDExtensionInterfaceStringNameNewWithLatin1Chars) proc("string_name_new_with_latin1_chars");
    i_construct     = (GDExtensionInterfaceClassdbConstructObject2)      proc("classdb_construct_object2");
    i_set_instance  = (GDExtensionInterfaceObjectSetInstance)            proc("object_set_instance");
    i_set_binding   = (GDExtensionInterfaceObjectSetInstanceBinding)     proc("object_set_instance_binding");
    i_register_class= (GDExtensionInterfaceClassdbRegisterExtensionClass3)proc("classdb_register_extension_class3");
    i_get_method    = (GDExtensionInterfaceClassdbGetMethodBind)         proc("classdb_get_method_bind");
    i_ptrcall       = (GDExtensionInterfaceObjectMethodBindPtrcall)      proc("object_method_bind_ptrcall");
    i_get_singleton = (GDExtensionInterfaceGlobalGetSingleton)           proc("global_get_singleton");
    i_alloc         = (GDExtensionInterfaceMemAlloc)                     proc("mem_alloc");
    i_free          = (GDExtensionInterfaceMemFree)                      proc("mem_free");
    i_strnew        = (GDExtensionInterfaceStringNewWithUtf8Chars)       proc("string_new_with_utf8_chars");
    i_get_destructor= (GDExtensionInterfaceVariantGetPtrDestructor)      proc("variant_get_ptr_destructor");

    r_init->minimum_initialization_level = GDEXTENSION_INITIALIZATION_SCENE;
    r_init->initialize = initialize_level;
    r_init->deinitialize = deinitialize_level;
    return 1;
}
