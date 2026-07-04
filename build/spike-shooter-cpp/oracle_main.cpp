// Shooter cross-language oracle — C++ driver (ASan-able: delete-based teardown). Mirrors run-oracle.mjs; output
// must byte-match expected-trace.txt. Build with -fsanitize=address to prove
// the Enemy_destroy teardown path clean (first live-instance destruction).
#include "shooter.cpp"
#include <stdio.h>

static Shooter* g;
static int step = 0;
static int wavesBuilt = 0;
static int ef = 0, bsingle = 0, bspread = 0, bspray = 0;
static const double DT = 1.0 / 64.0;

#include <string>
static std::string pads(const std::string& s, size_t w) {
    std::string out = s;
    while (out.size() < w) out += ' ';
    return out;
}

static void buildWave(void) {
    wavesBuilt++;
    if (wavesBuilt == 1) {
        g->add_enemy(new Enemy(Enemy::__create(0, 2, 0.0, 100)));
        g->add_enemy(new Enemy(Enemy::__create(1, 3, 0.75, 150)));
    } else {
        g->add_enemy(new Enemy(Enemy::__create(wavesBuilt % 3, 1, 0.0, 10)));
        g->add_enemy(new Enemy(Enemy::__create((wavesBuilt + 1) % 3, 1, 0.0, 10)));
    }
}

static void pump(int n) {
    for (int i = 0; i < n; i++) {
        g->tick(DT);
        if (g->should_spawn_wave()) { g->consume_wave(); buildWave(); }
        if (g->should_spawn_boss()) { g->consume_boss_spawn(); }
        for (int e = 0; e < g->enemy_count(); e++) {
            Enemy* en = g->enemies[e];
            if (en->wants_to_fire()) { en->consume_fire(); ef++; }
        }
        if (g->boss->wants_to_fire_single()) { g->boss->consume_fire(); bsingle++; }
        if (g->boss->wants_to_fire_spread()) { g->boss->consume_fire(); bspread++; }
        if (g->boss->wants_to_fire_spray())  { g->boss->consume_fire(); bspray++; }
        g->clear_dead_enemies();
    }
}

static void snap(const std::string& label) {
    std::string e0 = g->enemy_count() > 0 ? g->enemies[0]->get_state() : "-";
    std::string e1 = g->enemy_count() > 1 ? g->enemies[1]->get_state() : "-";
    printf("%03d %s st=%s score=%4d lives=%d n=%d e0=%s e1=%s boss=%s bhp=%2d pl=%s fire[e=%d s=%d d=%d y=%d] waves=%d\n",
        step, pads(label, 30).c_str(), pads(g->get_state(), 10).c_str(),
        g->get_score(), g->get_lives(), g->enemy_count(),
        pads(e0, 8).c_str(), pads(e1, 8).c_str(),
        pads(g->boss->get_state(), 11).c_str(), g->boss->get_hp(),
        pads(g->player->get_state(), 12).c_str(),
        ef, bsingle, bspread, bspray, wavesBuilt);
    step++;
}

static void run_n(int n, const std::string& label) {
    pump(n);
    snap("pump x" + std::to_string(n) + " (" + label + ")");
}

int main(void) {
    static Shooter gobj = Shooter::__create(); g = &gobj;

    snap("created");
    g->start();
    snap("start -> playing");

    run_n(129, "2.0s+: wave 1 spawns");
    run_n(32, "0.5s: spawning -> active");
    g->enemy_hit(0, 1);
    snap("e0 hit 1/2 (still active)");
    g->enemy_hit(0, 1);
    snap("e0 hit 2/2 -> dying, +100");
    run_n(26, "0.4s: e0 gone + CLEANED UP");
    run_n(23, "e1 fire #1 (rate 0.75)");
    run_n(48, "e1 fire #2");

    g->player_hit();
    snap("player hit -> exploding");
    g->player_hit();
    snap("player hit while exploding (no-op)");
    run_n(64, "1.0s: lives-1 -> invulnerable");
    g->player_hit();
    snap("player hit while invuln (no-op)");

    g->pause();
    snap("pause during PLAYING (push)");
    run_n(64, "1.0s paused: everything frozen");
    g->resume();
    snap("resume (pop -> playing)");
    run_n(128, "2.0s: invuln over + wave 2");

    g->enemy_hit(0, 99);
    snap("kill the old shooter e0 (+150)");
    run_n(600, "rush: waves 3..6 spawn+decay");
    run_n(600, "rush: waves 7..10 -> BOSS mid-pump");
    snap("boss_fight (entered during rush)");

    run_n(116, "boss p1: idle(1.8s) -> firing");
    run_n(26, "p1 firing 0.4s -> idle (1 shot)");
    g->boss_hit(10); g->boss_hit(10); g->boss_hit(10);
    snap("boss 90->60 (>59.4: still P1)");
    g->boss_hit(10);
    snap("boss 60->50 <=59.4 -> PHASE 2");

    g->pause();
    snap("pause during BOSS FIGHT (push)");
    run_n(64, "1.0s paused: boss frozen");
    g->resume();
    snap("resume (pop -> boss_fight)");

    run_n(84, "p2: idle(1.3s) -> spread");
    run_n(33, "p2 spread 0.5s -> idle (1 shot)");
    g->boss_hit(21);
    snap("boss 50->29 <=29.7 -> PHASE 3");

    run_n(39, "p3: idle(0.6s) -> spray");
    run_n(52, "p3 spray 0.8s (~6 shots @0.12s)");
    g->boss_hit(29);
    snap("boss 29->0 in P3 -> DYING");
    run_n(200, "boss dying -> gone -> VICTORY");

    snap("final");

    // --- pinned quirk section ---
    Shooter g2obj = Shooter::__create(); Shooter* g2 = &g2obj;
    g2->start();
    for (int w = 0; w < 10; w++) { for (int i = 0; i < 129; i++) { g2->tick(DT); } if (g2->should_spawn_wave()) g2->consume_wave(); }
    for (int i = 0; i < 65; i++) { g2->tick(DT); }
    printf("Q00 quirk: state=%s boss=%s\n", g2->get_state().c_str(), g2->boss->get_state().c_str());
    g2->boss_hit(90);
    printf("Q01 quirk: one 90-dmg hit in P1 -> boss=%s hp=%d (phase two, not dying)\n", g2->boss->get_state().c_str(), g2->boss->get_hp());
    g2->boss_hit(1);
    printf("Q02 quirk: 1-dmg hit in P2 at 0hp -> boss=%s hp=%d (phase three)\n", g2->boss->get_state().c_str(), g2->boss->get_hp());
    g2->boss_hit(1);
    printf("Q03 quirk: 1-dmg hit in P3 -> boss=%s (finally dying)\n", g2->boss->get_state().c_str());

    // full teardown under ASan: delete every surviving enemy
    for (int i = 0; i < g->enemy_count(); i++) delete g->enemies[i];
    for (int i = 0; i < g2->enemy_count(); i++) delete g2->enemies[i];
    return 0;
}
