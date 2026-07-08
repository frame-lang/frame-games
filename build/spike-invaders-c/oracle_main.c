#include "invaders.c"
#include <stdio.h>
#include <math.h>

static int step = 0;
static Invaders* g;

static long ivus() { return lround(Fleet_get_step_interval(g->fleet) * 1e6); }
static void pad(char* out, const char* s, int w) { int n = (int)strlen(s); strcpy(out, s); while (n < w) out[n++] = ' '; out[n] = '\0'; }
static void lpadn(char* out, long v, int w) { char t[32]; sprintf(t, "%ld", v); int n = (int)strlen(t); int p = w - n; if (p < 0) p = 0; int k = 0; while (k < p) out[k++] = ' '; strcpy(out + k, t); }
static void snap(const char* label) {
    char lab[64], st[16], fst[16], pl[16], sc[8], dir[8], al[8], tot[8], iv[8], lr[8];
    pad(lab, label, 34); pad(st, Invaders_get_state(g), 13);
    pad(fst, Fleet_get_state(g->fleet), 9); pad(pl, Player_get_state(g->player), 12);
    lpadn(sc, Invaders_get_score(g), 4); lpadn(dir, Fleet_get_direction(g->fleet), 2);
    lpadn(al, Fleet_alive_count(g->fleet), 2); lpadn(tot, Fleet_total(g->fleet), 2);
    lpadn(iv, ivus(), 6); lpadn(lr, Fleet_lowest_row(g->fleet), 2);
    printf("%03d %s st=%s sc=%s wv=%d lv=%d | fl=%s dir=%s al=%s/%s iv=%s lr=%s | pl=%s pz=%d\n",
        step, lab, st, sc, Invaders_get_wave(g), Invaders_get_lives(g),
        fst, dir, al, tot, iv, lr, pl, Invaders_is_paused(g) ? 1 : 0);
    step++;
}
static void run(int n, const char* label) { char b[80]; for (int i = 0; i < n; i++) Invaders_tick(g, 1.0/64.0); sprintf(b, "pump x%d (%s)", n, label); snap(b); }

int main(void) {
    g = Invaders_create();
    snap("created");
    Invaders_start(g);
    snap("start -> playing (fleet 55, iv=600000)");
    printf("OP  get_current_state_name=%s\n", Invaders_get_current_state_name(g));

    run(39, "0.61s: fleet wants_to_step");
    printf("SIG consume_step=%s (timer was >= interval)\n", Fleet_consume_step(g->fleet) ? "true" : "false");

    Invaders_player_killed_invader(g, 0);
    snap("kill idx0 (+10, pace up)");
    Invaders_player_killed_invader(g, 1);
    Invaders_player_killed_invader(g, 2);
    snap("kill idx1,2 (+20 more)");
    Invaders_player_killed_invader(g, 1);
    Invaders_player_killed_invader(g, 999);
    Invaders_player_killed_invader(g, -1);
    snap("kill dead/oob idx: NO score change");

    Invaders_fleet_reached_edge(g);
    snap("fleet_reached_edge -> stepping, dir flip");
    run(1, "one tick: stepping -> marching");

    Invaders_pause(g);
    snap("pause during PLAYING (push)");
    run(64, "1.0s paused: fleet+player frozen");
    Invaders_resume(g);
    snap("resume (pop -> playing)");

    for (int i = 3; i < 55; i++) Invaders_player_killed_invader(g, i);
    snap("cleared fleet -> wave_complete");

    Invaders_pause(g);
    snap("pause during WAVE_COMPLETE (push)");
    run(64, "1.0s paused: wave timer frozen");
    Invaders_resume(g);
    snap("resume (pop -> wave_complete)");

    run(129, "2.0s: wave 2 begins, fleet reset");

    Invaders_player_hit(g);
    snap("player_hit -> player_dying");
    Invaders_player_hit(g);
    snap("player_hit while exploding: NO-OP");

    Invaders_pause(g);
    snap("pause during PLAYER_DYING (push)");
    run(64, "1.0s paused: explosion timer frozen");
    Invaders_resume(g);
    snap("resume (pop -> player_dying)");

    run(77, "1.2s: lives-1, invuln, -> playing");
    run(96, "1.5s: invuln over -> alive");

    Invaders_fleet_reached_bottom(g);
    snap("fleet_reached_bottom -> game_over");
    Invaders_restart(g);
    snap("restart -> attract (reset)");

    Invaders* g2 = Invaders_create();
    Invaders_start(g2);
    for (int life = 0; life < 3; life++) { Invaders_player_hit(g2); for (int i = 0; i < 180; i++) Invaders_tick(g2, 1.0/64.0); }
    printf("DEATH after 3 hits: st=%s lives=%d player=%s\n", Invaders_get_state(g2), Invaders_get_lives(g2), Player_get_state(g2->player));

    Invaders* g3 = Invaders_create();
    Invaders_start(g3);
    int d0 = Fleet_get_direction(g3->fleet);
    Invaders_fleet_reached_edge(g3); Invaders_tick(g3, 1.0/64.0);
    int d1 = Fleet_get_direction(g3->fleet);
    Invaders_fleet_reached_edge(g3); Invaders_tick(g3, 1.0/64.0);
    int d2 = Fleet_get_direction(g3->fleet);
    printf("DIR bounces: start=%d after1=%d after2=%d\n", d0, d1, d2);
    return 0;
}
