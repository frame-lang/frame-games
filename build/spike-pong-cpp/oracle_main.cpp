#include "pong.cpp"
#include <cstdio>
#include <string>

static int step = 0;
static int bU(bool x) { return x ? 1 : 0; }
static std::string padr(std::string s, int w) { while ((int)s.size() < w) s += " "; return s; }
static std::string lpad(std::string s, int w) { while ((int)s.size() < w) s = " " + s; return s; }
static std::string i2s(long v) { return std::to_string(v); }

static Pong g = Pong::__create();

static void snap(const std::string& label) {
    printf("%03d %s st=%s sl=%s sr=%s serve=%s play=%d winner=%s\n",
        step, padr(label,38).c_str(), padr(g.get_current_state_name(),12).c_str(), lpad(i2s(g.get_score_left()),2).c_str(), lpad(i2s(g.get_score_right()),2).c_str(),
        lpad(i2s(g.get_serve_direction()),2).c_str(), bU(g.is_playing()), padr(g.get_winner(),6).c_str());
    step++;
}
static void pointRight(Pong& x) { x.launch(); x.ball_out_left(); }
static void pointLeft(Pong& x) { x.launch(); x.ball_out_right(); }

int main() {
    snap("created (AttractMode / 0-0)");
    printf("OP  get_current_state_name=%s get_winning_score=%d\n", g.get_current_state_name().c_str(), g.get_winning_score());

    g.start(); snap("start -> Serving");
    g.pause(); snap("pause during Serving (push)");
    g.resume(); snap("resume (pop -> Serving)");
    g.launch(); snap("launch -> InPlay (playing)");
    g.pause(); snap("pause during InPlay (push)");
    g.resume(); snap("resume (pop -> InPlay)");
    g.ball_out_left(); snap("ball_out_left -> right+1, serve -1");
    pointLeft(g); snap("pointLeft -> left+1, serve +1");
    for (int i=0;i<9;i++) pointRight(g);
    snap("right at 10 (one short of 11)");
    pointRight(g); snap("right scores 11 -> GameOver [right wins]");
    printf("WIN winner=%s playing=%d sl=%d sr=%d\n", g.get_winner().c_str(), bU(g.is_playing()), g.get_score_left(), g.get_score_right());
    g.restart(); snap("restart -> AttractMode (reset)");

    Pong g2 = Pong::__create();
    g2.start();
    for (int i=0;i<11;i++) pointLeft(g2);
    printf("MIRROR left win: st=%s winner=%s sl=%d serve=%d\n", g2.get_current_state_name().c_str(), g2.get_winner().c_str(), g2.get_score_left(), g2.get_serve_direction());
    return 0;
}
