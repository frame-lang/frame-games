// Stealth cross-language oracle — C++ driver. Mirrors run-oracle.mjs / Driver.cs.
// Output must byte-match games/stealth/oracle/expected-trace.txt.
// Build with -fsanitize=address to prove save_state/restore_state (shared_ptr
// re-make + child recursion) and shared_ptr teardown clean.
#include "stealth.cpp"
#include <cstdio>
#include <cmath>
#include <string>

static const double DT = 1.0 / 64.0;
static int step = 0;
static Stealth* g;
static Vector2 FAR2(500, 500);
static Vector2 pos1, pos2, pos3;

static Vector2 P(double x, double y) { return Vector2(x, y); }

static std::string padRight(const std::string& s, size_t w) {
    std::string out = s;
    while (out.size() < w) out += ' ';
    return out;
}
static std::string padLeft(const std::string& s, size_t w) {
    std::string out = s;
    while (out.size() < w) out = " " + out;
    return out;
}

static std::string Flags(std::shared_ptr<Guard> gd) {
    return std::string(gd->is_aware() ? "1" : "0")
         + (gd->is_alerted() ? "1" : "0")
         + (gd->should_move() ? "1" : "0");
}
static std::string Gcol(std::shared_ptr<Guard> gd) {
    Vector2 t = gd->get_target();
    return gd->get_state() + "/" + Flags(gd)
         + " tgt=(" + std::to_string((long)std::llround(t.x)) + ","
         + std::to_string((long)std::llround(t.y)) + ")";
}
static void SnapOf(Stealth* m, const std::string& label, const std::string& tag) {
    char stepbuf[8];
    std::snprintf(stepbuf, sizeof(stepbuf), "%03d", step);
    std::string t = padLeft(std::to_string((long)std::llround(m->get_elapsed() * 64)), 4);
    std::string by = padLeft(std::to_string(m->get_caught_by()), 2);
    printf("%s%s %s st=%s t=%s by=%s | g1=%s | g2=%s | g3=%s\n",
        tag.c_str(), stepbuf, padRight(label, 38).c_str(),
        padRight(m->get_state(), 8).c_str(), t.c_str(), by.c_str(),
        padRight(Gcol(m->guard1), 28).c_str(),
        padRight(Gcol(m->guard2), 28).c_str(),
        padRight(Gcol(m->guard3), 28).c_str());
    step++;
}
static void Snap(const std::string& label) { SnapOf(g, label, ""); }
static void Pump(int n) { for (int i = 0; i < n; i++) g->tick(DT, pos1, pos2, pos3); }
static void Run(int n, const std::string& label) { Pump(n); Snap("pump x" + std::to_string(n) + " (" + label + ")"); }

int main() {
    std::vector<Vector2> P1 = { P(0, 0), P(64, 0), P(64, 64) };
    std::vector<Vector2> P2 = { P(0, 0), P(96, 0) };
    std::vector<Vector2> P3 = { P(0, 0), P(96, 96) };
    pos1 = FAR2; pos2 = FAR2; pos3 = FAR2;
    static Stealth gobj = Stealth::__create(); g = &gobj;

    Snap("created (guards idle)");
    g->start(P1, P2, P3);
    Snap("start -> playing, guards patrol wp0");
    printf("OP  get_current_state_name=%s\n", g->get_current_state_name().c_str());

    Run(32, "0.5s: nobody arrives (FAR)");

    pos1 = P(1, 1);
    Run(1, "g1 arrives wp0 -> tgt wp1");
    pos1 = P(63, 1);
    Run(1, "g1 arrives wp1 -> tgt wp2");
    pos1 = P(63, 63);
    Run(1, "g1 arrives wp2 -> WRAP tgt wp0");
    pos1 = FAR2;

    g->guard1->hear_sound(P(50, 50));
    g->guard2->hear_sound(P(10, 90));
    Snap("g1+g2 hear_sound -> investigating");
    Run(95, "1.484s: both still investigating");
    Run(1, "tick 96 = 1.5s: both pop$ -> patrol");

    g->guard3->spot_player(P(80, 80));
    Snap("g3 spotted (patrolling->alerted)");
    g->guard3->hear_sound(P(5, 5));
    Snap("g3 hear_sound while alerted: NO-OP");

    Run(200, "3.125s chasing (far, no arrive)");
    g->guard3->spot_player(P(80, 80));
    Snap("re-spot at 3.125s: chase timer RESET");
    Run(200, "3.125s more: still alerted (reset)");
    Run(56, "chase clock hits 4.0s -> searching");
    pos3 = P(90, 90);
    Run(192, "3.0s search over -> NEAREST wp1");
    pos3 = FAR2;

    g->guard1->hear_sound(P(50, 50));
    Snap("g1 investigating again (push #2)");
    g->guard1->spot_player(P(30, 30));
    Snap("spot DURING investigate -> alerted");
    pos1 = P(29, 29);
    Run(1, "g1 arrives last_known -> searching");
    pos1 = P(1, 1);
    Run(192, "3.0s search over -> patrolling");
    g->guard1->hear_sound(P(40, 40));
    Snap("g1 push #3 (orphan below on stack)");
    Run(96, "1.5s: pop$ is LIFO -> patrolling");
    pos1 = FAR2;

    g->guard2->hear_sound(P(10, 90));
    Snap("g2 investigating (timer at 0)");
    g->pause();
    Snap("pause during playing (push)");
    Run(192, "3.0s paused: g2 timer FROZEN");
    g->resume();
    Snap("resume (pop -> playing)");
    Run(96, "1.5s after resume: g2 pops now");

    g->guard_caught_player(1);
    Snap("g2 touches player -> caught");

    g->restart();
    Snap("restart -> attract (counters reset)");

    Stealth escobj = Stealth::__create(); Stealth* esc = &escobj;
    esc->start(P1, P2, P3);
    for (int i = 0; i < 64; i++) esc->tick(DT, FAR2, FAR2, FAR2);
    esc->player_at_exit();
    printf("ESC escape path: st=%s by=%d t=%ld\n",
        esc->get_state().c_str(), esc->get_caught_by(),
        (long)std::llround(esc->get_elapsed() * 64));

    g->start(P2, P3, P1);
    Snap("Q: start after restart: init DROPPED");

    // ---- S-section: save/restore lockstep continuation ----
    step = 0;
    Stealth sobj = Stealth::__create(); Stealth* s = &sobj;
    s->start(P1, P2, P3);
    for (int i = 0; i < 32; i++) s->tick(DT, P(1, 1), FAR2, FAR2);
    s->guard1->hear_sound(P(50, 50));
    s->guard2->spot_player(P(80, 80));
    for (int i = 0; i < 32; i++) s->tick(DT, FAR2, FAR2, FAR2);
    SnapOf(s, "SAVE POINT (push live, alerted, mid)", "S");
    std::string blob = s->save_state();
    Stealth robj = Stealth::__create(); Stealth* r = &robj;
    r->restore_state(blob);
    SnapOf(r, "restored copy, same tick", "S");
    step--;
    int ns[3] = { 64, 224, 192 };
    const char* labels[3] = { "invest pops on both", "chase times out on both", "search resumes patrol on both" };
    for (int k = 0; k < 3; k++) {
        for (int i = 0; i < ns[k]; i++) s->tick(DT, FAR2, FAR2, FAR2);
        for (int i = 0; i < ns[k]; i++) r->tick(DT, FAR2, FAR2, FAR2);
        SnapOf(s, "orig  +" + std::to_string(ns[k]) + " (" + labels[k] + ")", "S");
        step--;
        SnapOf(r, "rest  +" + std::to_string(ns[k]) + " (" + labels[k] + ")", "S");
    }
    s->pause();
    std::string blob2 = s->save_state();
    Stealth r2obj = Stealth::__create(); Stealth* r2 = &r2obj;
    r2->restore_state(blob2);
    r2->resume();
    printf("SP  paused save -> restore -> resume: st=%s t=%ld\n",
        r2->get_state().c_str(), (long)std::llround(r2->get_elapsed() * 64));

    return 0;
}
