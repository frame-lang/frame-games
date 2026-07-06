// Stealth cross-language oracle — C driver. Mirrors run-oracle.mjs.
// Single TU: pulls in the generated machine so g->guard1 etc. are visible.
// Build with -fsanitize=address to prove the Guard_destroy teardown clean.
#include "stealth.c"
#include <stdio.h>
#include <math.h>

static int step = 0;
static Stealth* g;
static Vector2 FAR;
static Vector2 pos1, pos2, pos3;

static Vector2 P(double x, double y) { Vector2 v; v.x = x; v.y = y; return v; }

static void pad(char* out, const char* s, int w) {
    int n = (int)strlen(s);
    strcpy(out, s);
    while (n < w) { out[n++] = ' '; }
    out[n] = '\0';
}
static void flags(char* out, Guard* gd) {
    out[0] = Guard_is_aware(gd) ? '1' : '0';
    out[1] = Guard_is_alerted(gd) ? '1' : '0';
    out[2] = Guard_should_move(gd) ? '1' : '0';
    out[3] = '\0';
}
static void gcol(char* out, Guard* gd) {
    char fl[8];
    flags(fl, gd);
    Vector2 t = Guard_get_target(gd);
    sprintf(out, "%s/%s tgt=(%ld,%ld)", Guard_get_state(gd), fl, lround(t.x), lround(t.y));
}
static void snap_of(Stealth* m, const char* label, const char* tag) {
    char lab[64], st[16], c1[48], c2[48], c3[48], p1[48], p2[48], p3[48];
    pad(lab, label, 38);
    pad(st, Stealth_get_state(m), 8);
    gcol(c1, m->guard1); pad(p1, c1, 28);
    gcol(c2, m->guard2); pad(p2, c2, 28);
    gcol(c3, m->guard3); pad(p3, c3, 28);
    printf("%s%03d %s st=%s t=%4ld by=%2d | g1=%s | g2=%s | g3=%s\n",
        tag, step, lab, st, lround(Stealth_get_elapsed(m) * 64.0), Stealth_get_caught_by(m),
        p1, p2, p3);
    step++;
}
static void snap(const char* label) { snap_of(g, label, ""); }
static void pump(int n) { for (int i = 0; i < n; i++) Stealth_tick(g, 1.0 / 64.0, pos1, pos2, pos3); }
static void run(int n, const char* label) {
    char buf[80];
    pump(n);
    sprintf(buf, "pump x%d (%s)", n, label);
    snap(buf);
}

int main(void) {
    FAR = P(500, 500);
    pos1 = FAR; pos2 = FAR; pos3 = FAR;
    Vector2 P1[3] = { P(0,0), P(64,0), P(64,64) };
    Vector2 P2[2] = { P(0,0), P(96,0) };
    Vector2 P3[2] = { P(0,0), P(96,96) };

    g = Stealth_create();
    snap("created (guards idle)");
    Stealth_start(g, P1, 3, P2, 2, P3, 2);
    snap("start -> playing, guards patrol wp0");
    printf("OP  get_current_state_name=%s\n", Stealth_get_current_state_name(g));

    run(32, "0.5s: nobody arrives (FAR)");
    pos1 = P(1,1);   run(1, "g1 arrives wp0 -> tgt wp1");
    pos1 = P(63,1);  run(1, "g1 arrives wp1 -> tgt wp2");
    pos1 = P(63,63); run(1, "g1 arrives wp2 -> WRAP tgt wp0");
    pos1 = FAR;

    Guard_hear_sound(g->guard1, P(50,50));
    Guard_hear_sound(g->guard2, P(10,90));
    snap("g1+g2 hear_sound -> investigating");
    run(95, "1.484s: both still investigating");
    run(1, "tick 96 = 1.5s: both pop$ -> patrol");

    Guard_spot_player(g->guard3, P(80,80));
    snap("g3 spotted (patrolling->alerted)");
    Guard_hear_sound(g->guard3, P(5,5));
    snap("g3 hear_sound while alerted: NO-OP");

    run(200, "3.125s chasing (far, no arrive)");
    Guard_spot_player(g->guard3, P(80,80));
    snap("re-spot at 3.125s: chase timer RESET");
    run(200, "3.125s more: still alerted (reset)");
    run(56, "chase clock hits 4.0s -> searching");
    pos3 = P(90,90); run(192, "3.0s search over -> NEAREST wp1");
    pos3 = FAR;

    Guard_hear_sound(g->guard1, P(50,50));
    snap("g1 investigating again (push #2)");
    Guard_spot_player(g->guard1, P(30,30));
    snap("spot DURING investigate -> alerted");
    pos1 = P(29,29); run(1, "g1 arrives last_known -> searching");
    pos1 = P(1,1);   run(192, "3.0s search over -> patrolling");
    Guard_hear_sound(g->guard1, P(40,40));
    snap("g1 push #3 (orphan below on stack)");
    run(96, "1.5s: pop$ is LIFO -> patrolling");
    pos1 = FAR;

    Guard_hear_sound(g->guard2, P(10,90));
    snap("g2 investigating (timer at 0)");
    Stealth_pause(g);
    snap("pause during playing (push)");
    run(192, "3.0s paused: g2 timer FROZEN");
    Stealth_resume(g);
    snap("resume (pop -> playing)");
    run(96, "1.5s after resume: g2 pops now");

    Stealth_guard_caught_player(g, 1);
    snap("g2 touches player -> caught");

    Stealth_restart(g);
    snap("restart -> attract (counters reset)");

    Stealth* esc = Stealth_create();
    Stealth_start(esc, P1, 3, P2, 2, P3, 2);
    for (int i = 0; i < 64; i++) Stealth_tick(esc, 1.0/64.0, FAR, FAR, FAR);
    Stealth_player_at_exit(esc);
    printf("ESC escape path: st=%s by=%d t=%ld\n", Stealth_get_state(esc), Stealth_get_caught_by(esc), lround(Stealth_get_elapsed(esc) * 64.0));
    Stealth_destroy(esc);

    Stealth_start(g, P2, 2, P3, 2, P1, 3);
    snap("Q: start after restart: init DROPPED");
    Stealth_destroy(g);

    // ---- S-section ----
    step = 0;
    Stealth* s = Stealth_create();
    Stealth_start(s, P1, 3, P2, 2, P3, 2);
    for (int i = 0; i < 32; i++) Stealth_tick(s, 1.0/64.0, P(1,1), FAR, FAR);
    Guard_hear_sound(s->guard1, P(50,50));
    Guard_spot_player(s->guard2, P(80,80));
    for (int i = 0; i < 32; i++) Stealth_tick(s, 1.0/64.0, FAR, FAR, FAR);
    snap_of(s, "SAVE POINT (push live, alerted, mid)", "S");
    char* blob = Stealth_save_state(s);
    Stealth* r = Stealth_create();
    Stealth_restore_state(r, blob);
    free(blob);
    snap_of(r, "restored copy, same tick", "S");
    step--;
    int ns[3] = { 64, 224, 192 };
    const char* labels[3] = { "invest pops on both", "chase times out on both", "search resumes patrol on both" };
    for (int k = 0; k < 3; k++) {
        char buf[80];
        for (int i = 0; i < ns[k]; i++) Stealth_tick(s, 1.0/64.0, FAR, FAR, FAR);
        for (int i = 0; i < ns[k]; i++) Stealth_tick(r, 1.0/64.0, FAR, FAR, FAR);
        sprintf(buf, "orig  +%d (%s)", ns[k], labels[k]);
        snap_of(s, buf, "S");
        step--;
        sprintf(buf, "rest  +%d (%s)", ns[k], labels[k]);
        snap_of(r, buf, "S");
    }
    Stealth_pause(s);
    char* blob2 = Stealth_save_state(s);
    Stealth* r2 = Stealth_create();
    Stealth_restore_state(r2, blob2);
    free(blob2);
    Stealth_resume(r2);
    printf("SP  paused save -> restore -> resume: st=%s t=%ld\n", Stealth_get_state(r2), lround(Stealth_get_elapsed(r2) * 64.0));
    Stealth_destroy(s);
    Stealth_destroy(r);
    Stealth_destroy(r2);
    return 0;
}
