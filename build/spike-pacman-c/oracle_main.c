// Pac-Man cross-language oracle — C driver.
//
// Executes the SAME canonical scenario as games/pacman/oracle/run-oracle.mjs
// against the C-generated machine and prints the SAME trace format; the build
// diffs this output against expected-trace.txt (the JS baseline). Any byte of
// difference is a cross-backend semantic divergence.
#include "pacman.c"
#include <stdio.h>

static GhostGame* g;
static int step = 0;
static const double DT = 1.0 / 64.0;

// pad `s` right to width w into buf (no truncation for longer strings —
// matches JS String.prototype.padEnd).
static const char* pad(const char* s, int w, char* buf) {
    int n = (int)strlen(s);
    int total = n > w ? n : w;
    memcpy(buf, s, (size_t)n);
    for (int i = n; i < total; i++) buf[i] = ' ';
    buf[total] = '\0';
    return buf;
}

static void snap(const char* label) {
    char lb[64], pb[16], g0[16], g1[16], g2[16], g3[16];
    const char* gs[4] = {"-", "-", "-", "-"};
    char flags[4][3] = {"--", "--", "--", "--"};
    int n = GhostGame_ghost_count(g);
    for (int i = 0; i < n; i++) {
        gs[i] = GhostGame_ghost_state(g, i);
        flags[i][0] = GhostGame_ghost_is_dangerous(g, i) ? 'D' : '.';
        flags[i][1] = GhostGame_ghost_is_edible(g, i) ? 'E' : '.';
        flags[i][2] = '\0';
    }
    printf("%03d %s phase=%s fright=%7.3f score=%4d g=[%s %s %s %s] f=[%s %s %s %s]\n",
           step,
           pad(label, 28, lb),
           pad(GhostGame_get_phase(g), 10, pb),
           GhostGame_frighten_seconds_left(g),
           GhostGame_get_score(g),
           pad(gs[0], 10, g0), pad(gs[1], 10, g1), pad(gs[2], 10, g2), pad(gs[3], 10, g3),
           flags[0], flags[1], flags[2], flags[3]);
    step++;
}

static void tick_n(int n, const char* label) {
    char lb[64];
    for (int i = 0; i < n; i++) GhostGame_tick(g, (float)DT);
    snprintf(lb, sizeof lb, "tick x%d (%s)", n, label);
    snap(lb);
}

int main(void) {
    g = GhostGame_create();
    const char* names[4] = {"blinky", "pinky", "inky", "clyde"};
    Vector2 corners[4] = {{680, 40}, {40, 40}, {680, 440}, {40, 440}};

    snap("created");
    for (int i = 0; i < 4; i++) GhostGame_add_ghost(g, Ghost_create(names[i], corners[i], i));
    snap("add_ghost x4");
    GhostGame_start(g);
    snap("start");

    tick_n(64, "1.0s: pen not due");
    tick_n(80, "2.25s: 1st release");
    tick_n(128, "4.25s: 2nd release");
    tick_n(128, "6.25s: 3rd release");
    tick_n(64, "7.25s: scatter(7s) over");

    GhostGame_power_pellet_picked_up(g);
    snap("pellet during CHASE (push)");
    tick_n(64, "1.0s frightened");
    GhostGame_ghost_caught(g, 0);
    snap("caught blinky (+200)");
    GhostGame_ghost_caught(g, 0);
    snap("caught blinky again (no-op)");
    GhostGame_ghost_caught(g, 1);
    snap("caught pinky (+200)");
    tick_n(64, "2.0s frightened");
    GhostGame_ghost_arrived_at_pen(g, 0);
    snap("blinky arrived at pen");
    tick_n(256, "6.0s: frighten expires");
    tick_n(64, "chase resumed 1.0s");

    GhostGame_power_pellet_picked_up(g);
    snap("pellet during CHASE #2 (push)");
    GhostGame_power_pellet_picked_up(g);
    snap("pellet WHILE frightened (re-enter)");
    tick_n(320, "5.0s of re-frighten");
    tick_n(96, "6.5s total: expires again");

    tick_n(1152, "chase(20s) over -> scatter");
    GhostGame_power_pellet_picked_up(g);
    snap("pellet during SCATTER (push)");
    tick_n(416, "6.5s: expires -> scatter");
    tick_n(320, "scatter(5s) over -> chase");

    snap("final");
    return 0;
}
