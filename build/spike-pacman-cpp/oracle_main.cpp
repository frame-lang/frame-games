// Pac-Man cross-language oracle — C++ driver. Mirrors run-oracle.mjs
// step-for-step; output must byte-match expected-trace.txt.
#include "pacman.cpp"
#include <cstdio>
#include <string>

static GhostGame* g;
static int step = 0;
static const double DT = 1.0 / 64.0;

static std::string pad(const std::string& s, size_t w) {
    std::string out = s;
    while (out.size() < w) out += ' ';
    return out;
}

static void snap(const std::string& label) {
    std::string gs[4] = {"-", "-", "-", "-"};
    std::string flags[4] = {"--", "--", "--", "--"};
    int n = g->ghost_count();
    for (int i = 0; i < n; i++) {
        gs[i] = g->ghost_state(i);
        flags[i] = std::string(g->ghost_is_dangerous(i) ? "D" : ".") + (g->ghost_is_edible(i) ? "E" : ".");
    }
    printf("%03d %s phase=%s fright=%7.3f score=%4d g=[%s %s %s %s] f=[%s %s %s %s]\n",
        step, pad(label, 28).c_str(), pad(g->get_phase(), 10).c_str(),
        g->frighten_seconds_left(), g->get_score(),
        pad(gs[0], 10).c_str(), pad(gs[1], 10).c_str(), pad(gs[2], 10).c_str(), pad(gs[3], 10).c_str(),
        flags[0].c_str(), flags[1].c_str(), flags[2].c_str(), flags[3].c_str());
    step++;
}

static void tick_n(int n, const char* label) {
    for (int i = 0; i < n; i++) g->tick(DT);
    char lb[64];
    snprintf(lb, sizeof lb, "tick x%d (%s)", n, label);
    snap(lb);
}

int main() {
    GhostGame game = GhostGame::__create();
    g = &game;
    const char* names[4] = {"blinky", "pinky", "inky", "clyde"};
    Vector2 corners[4] = {{680, 40}, {40, 40}, {680, 440}, {40, 440}};

    snap("created");
    for (int i = 0; i < 4; i++) g->add_ghost(new Ghost(Ghost::__create(names[i], corners[i], i)));
    snap("add_ghost x4");
    g->start();
    snap("start");

    tick_n(64, "1.0s: pen not due");
    tick_n(80, "2.25s: 1st release");
    tick_n(128, "4.25s: 2nd release");
    tick_n(128, "6.25s: 3rd release");
    tick_n(64, "7.25s: scatter(7s) over");

    g->power_pellet_picked_up();
    snap("pellet during CHASE (push)");
    tick_n(64, "1.0s frightened");
    g->ghost_caught(0);
    snap("caught blinky (+200)");
    g->ghost_caught(0);
    snap("caught blinky again (no-op)");
    g->ghost_caught(1);
    snap("caught pinky (+200)");
    tick_n(64, "2.0s frightened");
    g->ghost_arrived_at_pen(0);
    snap("blinky arrived at pen");
    tick_n(256, "6.0s: frighten expires");
    tick_n(64, "chase resumed 1.0s");

    g->power_pellet_picked_up();
    snap("pellet during CHASE #2 (push)");
    g->power_pellet_picked_up();
    snap("pellet WHILE frightened (re-enter)");
    tick_n(320, "5.0s of re-frighten");
    tick_n(96, "6.5s total: expires again");

    tick_n(1152, "chase(20s) over -> scatter");
    g->power_pellet_picked_up();
    snap("pellet during SCATTER (push)");
    tick_n(416, "6.5s: expires -> scatter");
    tick_n(320, "scatter(5s) over -> chase");

    snap("final");
    return 0;
}
