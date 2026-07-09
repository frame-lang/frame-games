#include "breakout.cpp"
#include <cstdio>
#include <cmath>
#include <string>
static int step = 0;
static Breakout g = Breakout::__create();
static long mU(double x){ return std::lround(x*1000); }
static std::string padr(std::string s,int w){ while((int)s.size()<w) s+=" "; return s; }
static std::string padl(long v,int w){ std::string s=std::to_string(v); while((int)s.size()<w) s=" "+s; return s; }
static void snap(const char* label){
    std::string rp = g.get_state()=="playing" ? padl(mU(g.ball_respawn_progress()),4) : std::string("   -");
    printf("%03d %s st=%s sc=%s lv=%d lvl=%d br=%s | ball=%s vx=%s vy=%s rp=%s\n",
        step, padr(label,34).c_str(), padr(g.get_state(),11).c_str(), padl(g.get_score(),4).c_str(),
        g.get_lives(), g.get_level(), padl(g.bricks_remaining(),2).c_str(), padr(g.ball_state(),9).c_str(),
        padl(mU(g.ball_vx()),6).c_str(), padl(mU(g.ball_vy()),6).c_str(), rp.c_str());
    step++;
}
static void run(int n,const char* label){ char b[80]; for(int i=0;i<n;i++) g.tick(1.0/64.0); sprintf(b,"pump x%d (%s)",n,label); snap(b); }
int main(){
    snap("created"); g.start(); snap("start -> playing, ball attached");
    printf("OP  get_current_state_name=%s\n", g.get_current_state_name().c_str());
    g.launch_ball(3.5,-4.25); snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]");
    g.wall_bounce_x(); snap("wall_bounce_x -> vx negated");
    g.wall_bounce_y(); snap("wall_bounce_y -> vy negated");
    g.paddle_hit(2.75,-5.5); snap("paddle_hit -> set_velocity(2.75,-5.5)");
    g.brick_hit(0); snap("brick_hit(0): +10, vy flip, broken");
    g.brick_hit(0); g.brick_hit(999); g.brick_hit(-1); snap("brick_hit dead/oob: NO score change");
    g.brick_hit(1); g.brick_hit(2); snap("brick_hit(1,2): +20");
    g.pause(); snap("pause during PLAYING (push)"); run(64,"1.0s paused: ball frozen"); g.resume(); snap("resume (pop -> playing)");
    g.ball_fell_off(); snap("ball_fell_off -> lives-1, ball lost");
    run(64,"1.0s: respawn progress ~0.5"); run(63,"just before 2.0s: still lost"); run(1,"tick 2.0s: ball -> attached");
    g.launch_ball(3.5,-4.25); snap("re-launch (fresh in_flight)");
    for(int i=3;i<40;i++) g.brick_hit(i); snap("cleared wall -> level_clear (lvl 2)");
    g.start(); snap("start -> playing, fresh wall of 40");
    g.ball_fell_off(); snap("fell off -> lives 1"); g.ball_fell_off(); snap("fell off -> lives 0 -> game_over");
    g.restart(); snap("restart -> attract (reset)");
    Breakout g2 = Breakout::__create(); g2.start(); g2.launch_ball(1.0,-1.0); g2.ball_fell_off();
    for(int i=0;i<32;i++) g2.tick(1.0/64.0); long rpb=mU(g2.ball_respawn_progress()); g2.pause();
    for(int i=0;i<128;i++) g2.tick(1.0/64.0); g2.resume(); long rpa=mU(g2.ball_respawn_progress());
    printf("PAUSE respawn frozen: before=%ld after=%ld ball=%s (paused ticks must not advance the ball)\n", rpb, rpa, g2.ball_state().c_str());
    Breakout g3 = Breakout::__create(); g3.start();
    printf("BRICK is_broken: fresh0=%s oobNeg=%s oobBig=%s (expect false, true, true)\n",
        g3.is_brick_broken(0)?"true":"false", g3.is_brick_broken(-1)?"true":"false", g3.is_brick_broken(999)?"true":"false");
    return 0;
}
