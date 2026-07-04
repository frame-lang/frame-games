// Shooter cross-language oracle — C driver. Mirrors run-oracle.mjs; output
// must byte-match expected-trace.txt. Build with -fsanitize=address to prove
// the Enemy_destroy teardown path clean (first live-instance destruction).
#include "shooter.c"
#include <stdio.h>

static Shooter* g;
static int step = 0;
static int wavesBuilt = 0;
static int ef = 0, bsingle = 0, bspread = 0, bspray = 0;
static const double DT = 1.0 / 64.0;

static const char* pad(const char* s, int w, char* buf) {
    int n = (int)strlen(s);
    int total = n > w ? n : w;
    memcpy(buf, s, (size_t)n);
    for (int i = n; i < total; i++) buf[i] = ' ';
    buf[total] = '\0';
    return buf;
}

static void buildWave(void) {
    wavesBuilt++;
    if (wavesBuilt == 1) {
        Shooter_add_enemy(g, Enemy_create(0, 2, 0.0, 100));
        Shooter_add_enemy(g, Enemy_create(1, 3, 0.75, 150));
    } else {
        Shooter_add_enemy(g, Enemy_create(wavesBuilt % 3, 1, 0.0, 10));
        Shooter_add_enemy(g, Enemy_create((wavesBuilt + 1) % 3, 1, 0.0, 10));
    }
}

static void pump(int n) {
    for (int i = 0; i < n; i++) {
        Shooter_tick(g, DT);
        if (Shooter_should_spawn_wave(g)) { Shooter_consume_wave(g); buildWave(); }
        if (Shooter_should_spawn_boss(g)) { Shooter_consume_boss_spawn(g); }
        for (int e = 0; e < Shooter_enemy_count(g); e++) {
            Enemy* en = g->enemies[e];
            if (Enemy_wants_to_fire(en)) { Enemy_consume_fire(en); ef++; }
        }
        if (Boss_wants_to_fire_single(g->boss)) { Boss_consume_fire(g->boss); bsingle++; }
        if (Boss_wants_to_fire_spread(g->boss)) { Boss_consume_fire(g->boss); bspread++; }
        if (Boss_wants_to_fire_spray(g->boss))  { Boss_consume_fire(g->boss); bspray++; }
        Shooter_clear_dead_enemies(g);
    }
}

static void snap(const char* label) {
    char lb[64], st[16], e0b[12], e1b[12], bb[16], pb[16];
    const char* e0 = Shooter_enemy_count(g) > 0 ? Enemy_get_state(g->enemies[0]) : "-";
    const char* e1 = Shooter_enemy_count(g) > 1 ? Enemy_get_state(g->enemies[1]) : "-";
    printf("%03d %s st=%s score=%4d lives=%d n=%d e0=%s e1=%s boss=%s bhp=%2d pl=%s fire[e=%d s=%d d=%d y=%d] waves=%d\n",
        step, pad(label, 30, lb), pad(Shooter_get_state(g), 10, st),
        Shooter_get_score(g), Shooter_get_lives(g), Shooter_enemy_count(g),
        pad(e0, 8, e0b), pad(e1, 8, e1b),
        pad(Boss_get_state(g->boss), 11, bb), Boss_get_hp(g->boss),
        pad(Player_get_state(g->player), 12, pb),
        ef, bsingle, bspread, bspray, wavesBuilt);
    step++;
}

static void run_n(int n, const char* label) {
    char lb[80];
    pump(n);
    snprintf(lb, sizeof lb, "pump x%d (%s)", n, label);
    snap(lb);
}

int main(void) {
    g = Shooter_create();

    snap("created");
    Shooter_start(g);
    snap("start -> playing");

    run_n(129, "2.0s+: wave 1 spawns");
    run_n(32, "0.5s: spawning -> active");
    Shooter_enemy_hit(g, 0, 1);
    snap("e0 hit 1/2 (still active)");
    Shooter_enemy_hit(g, 0, 1);
    snap("e0 hit 2/2 -> dying, +100");
    run_n(26, "0.4s: e0 gone + CLEANED UP");
    run_n(23, "e1 fire #1 (rate 0.75)");
    run_n(48, "e1 fire #2");

    Shooter_player_hit(g);
    snap("player hit -> exploding");
    Shooter_player_hit(g);
    snap("player hit while exploding (no-op)");
    run_n(64, "1.0s: lives-1 -> invulnerable");
    Shooter_player_hit(g);
    snap("player hit while invuln (no-op)");

    Shooter_pause(g);
    snap("pause during PLAYING (push)");
    run_n(64, "1.0s paused: everything frozen");
    Shooter_resume(g);
    snap("resume (pop -> playing)");
    run_n(128, "2.0s: invuln over + wave 2");

    Shooter_enemy_hit(g, 0, 99);
    snap("kill the old shooter e0 (+150)");
    run_n(600, "rush: waves 3..6 spawn+decay");
    run_n(600, "rush: waves 7..10 -> BOSS mid-pump");
    snap("boss_fight (entered during rush)");

    run_n(116, "boss p1: idle(1.8s) -> firing");
    run_n(26, "p1 firing 0.4s -> idle (1 shot)");
    Shooter_boss_hit(g, 10); Shooter_boss_hit(g, 10); Shooter_boss_hit(g, 10);
    snap("boss 90->60 (>59.4: still P1)");
    Shooter_boss_hit(g, 10);
    snap("boss 60->50 <=59.4 -> PHASE 2");

    Shooter_pause(g);
    snap("pause during BOSS FIGHT (push)");
    run_n(64, "1.0s paused: boss frozen");
    Shooter_resume(g);
    snap("resume (pop -> boss_fight)");

    run_n(84, "p2: idle(1.3s) -> spread");
    run_n(33, "p2 spread 0.5s -> idle (1 shot)");
    Shooter_boss_hit(g, 21);
    snap("boss 50->29 <=29.7 -> PHASE 3");

    run_n(39, "p3: idle(0.6s) -> spray");
    run_n(52, "p3 spray 0.8s (~6 shots @0.12s)");
    Shooter_boss_hit(g, 29);
    snap("boss 29->0 in P3 -> DYING");
    run_n(200, "boss dying -> gone -> VICTORY");

    snap("final");

    // --- pinned quirk section ---
    Shooter* g2 = Shooter_create();
    Shooter_start(g2);
    for (int w = 0; w < 10; w++) { for (int i = 0; i < 129; i++) { Shooter_tick(g2, DT); } if (Shooter_should_spawn_wave(g2)) Shooter_consume_wave(g2); }
    for (int i = 0; i < 65; i++) { Shooter_tick(g2, DT); }
    printf("Q00 quirk: state=%s boss=%s\n", Shooter_get_state(g2), Boss_get_state(g2->boss));
    Shooter_boss_hit(g2, 90);
    printf("Q01 quirk: one 90-dmg hit in P1 -> boss=%s hp=%d (phase two, not dying)\n", Boss_get_state(g2->boss), Boss_get_hp(g2->boss));
    Shooter_boss_hit(g2, 1);
    printf("Q02 quirk: 1-dmg hit in P2 at 0hp -> boss=%s hp=%d (phase three)\n", Boss_get_state(g2->boss), Boss_get_hp(g2->boss));
    Shooter_boss_hit(g2, 1);
    printf("Q03 quirk: 1-dmg hit in P3 -> boss=%s (finally dying)\n", Boss_get_state(g2->boss));

    // full teardown under ASan/LSan: destroy everything still alive
    for (int i = 0; i < Shooter_enemy_count(g); i++) Enemy_destroy(g->enemies[i]);
    Shooter_destroy(g);
    Shooter_destroy(g2);
    return 0;
}
