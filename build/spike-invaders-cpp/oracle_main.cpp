#include "invaders.cpp"
#include <cstdio>
#include <cmath>
#include <string>

static int step = 0;
static Invaders* g;

static long ivus() { return std::lround(g->fleet->get_step_interval() * 1e6); }
static std::string padr(std::string s, int w) { while ((int)s.size() < w) s += " "; return s; }
static std::string padl(long v, int w) { std::string s = std::to_string(v); while ((int)s.size() < w) s = " " + s; return s; }
static void snap(const char* label) {
    auto fl = g->fleet;
    printf("%03d %s st=%s sc=%s wv=%d lv=%d | fl=%s dir=%s al=%s/%s iv=%s lr=%s | pl=%s pz=%d\n",
        step, padr(label, 34).c_str(), padr(g->get_state(), 13).c_str(), padl(g->get_score(), 4).c_str(),
        g->get_wave(), g->get_lives(),
        padr(fl->get_state(), 9).c_str(), padl(fl->get_direction(), 2).c_str(),
        padl(fl->alive_count(), 2).c_str(), padl(fl->total(), 2).c_str(),
        padl(ivus(), 6).c_str(), padl(fl->lowest_row(), 2).c_str(),
        padr(g->player->get_state(), 12).c_str(), g->is_paused() ? 1 : 0);
    step++;
}
static void run(int n, const char* label) { char b[80]; for (int i = 0; i < n; i++) g->tick(1.0/64.0); sprintf(b, "pump x%d (%s)", n, label); snap(b); }

int main() {
    g = new Invaders(Invaders::__create());
    snap("created");
    g->start();
    snap("start -> playing (fleet 55, iv=600000)");
    printf("OP  get_current_state_name=%s\n", g->get_current_state_name().c_str());

    run(39, "0.61s: fleet wants_to_step");
    printf("SIG consume_step=%s (timer was >= interval)\n", g->fleet->consume_step() ? "true" : "false");

    g->player_killed_invader(0);
    snap("kill idx0 (+10, pace up)");
    g->player_killed_invader(1);
    g->player_killed_invader(2);
    snap("kill idx1,2 (+20 more)");
    g->player_killed_invader(1);
    g->player_killed_invader(999);
    g->player_killed_invader(-1);
    snap("kill dead/oob idx: NO score change");

    g->fleet_reached_edge();
    snap("fleet_reached_edge -> stepping, dir flip");
    run(1, "one tick: stepping -> marching");

    g->pause();
    snap("pause during PLAYING (push)");
    run(64, "1.0s paused: fleet+player frozen");
    g->resume();
    snap("resume (pop -> playing)");

    for (int i = 3; i < 55; i++) g->player_killed_invader(i);
    snap("cleared fleet -> wave_complete");

    g->pause();
    snap("pause during WAVE_COMPLETE (push)");
    run(64, "1.0s paused: wave timer frozen");
    g->resume();
    snap("resume (pop -> wave_complete)");

    run(129, "2.0s: wave 2 begins, fleet reset");

    g->player_hit();
    snap("player_hit -> player_dying");
    g->player_hit();
    snap("player_hit while exploding: NO-OP");

    g->pause();
    snap("pause during PLAYER_DYING (push)");
    run(64, "1.0s paused: explosion timer frozen");
    g->resume();
    snap("resume (pop -> player_dying)");

    run(77, "1.2s: lives-1, invuln, -> playing");
    run(96, "1.5s: invuln over -> alive");

    g->fleet_reached_bottom();
    snap("fleet_reached_bottom -> game_over");
    g->restart();
    snap("restart -> attract (reset)");

    Invaders g2 = Invaders::__create();
    g2.start();
    for (int life = 0; life < 3; life++) { g2.player_hit(); for (int i = 0; i < 180; i++) g2.tick(1.0/64.0); }
    printf("DEATH after 3 hits: st=%s lives=%d player=%s\n", g2.get_state().c_str(), g2.get_lives(), g2.player->get_state().c_str());

    Invaders g3 = Invaders::__create();
    g3.start();
    int d0 = g3.fleet->get_direction();
    g3.fleet_reached_edge(); g3.tick(1.0/64.0);
    int d1 = g3.fleet->get_direction();
    g3.fleet_reached_edge(); g3.tick(1.0/64.0);
    int d2 = g3.fleet->get_direction();
    printf("DIR bounces: start=%d after1=%d after2=%d\n", d0, d1, d2);
    return 0;
}
