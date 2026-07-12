#include "platformer.c"
#include <stdio.h>
#include <math.h>
static int step = 0;
static Platformer* g;
static long mU(double x) { return lround(x * 1000); }
static int bU(bool x) { return x ? 1 : 0; }
static void padr(char* o, const char* s, int w) { int n=(int)strlen(s); strcpy(o,s); while(n<w) o[n++]=' '; o[n]='\0'; }
static void padln(char* o, long v, int w) { char t[32]; sprintf(t,"%ld",v); int n=(int)strlen(t),p=w-n; if(p<0)p=0; int k=0; while(k<p)o[k++]=' '; strcpy(o+k,t); }
static void snap(const char* label) {
    char lab[64], st[16], lo[16], fm[16], vx[16], fa[8], hb[8];
    padr(lab,label,40); padr(st,Platformer_get_current_state_name(g),7);
    padr(lo,Platformer_locomotion_state(g),8); padr(fm,Platformer_form(g),5);
    padln(vx,mU(Platformer_wants_velocity_x(g)),7); padln(fa,Platformer_facing(g),2); padln(hb,Platformer_hit_box_height(g),2);
    printf("%03d %s st=%s loco=%s form=%s vx=%s face=%s gnd=%d air=%d jimp=%d hbox=%s shoot=%d paused=%d\n",
        step, lab, st, lo, fm, vx, fa,
        bU(Platformer_is_grounded(g)), bU(Platformer_is_in_air(g)), bU(Platformer_wants_jump_impulse(g)),
        hb, bU(Platformer_can_shoot(g)), bU(Platformer_is_paused(g)));
    step++;
}
static void run(int n, const char* label) { char b[80]; for(int i=0;i<n;i++) Platformer_tick(g,1.0/64.0); sprintf(b,"pump x%d (%s)",n,label); snap(b); }
int main(void) {
    g = Platformer_create();
    snap("created (Playing / idle / small)");
    printf("OP  get_current_state_name=%s\n", Platformer_get_current_state_name(g));

    Platformer_press_right(g); snap("press_right -> walking, face+1");
    Platformer_press_sprint(g); snap("press_sprint -> running (vx 260)");
    Platformer_release_sprint(g); snap("release_sprint -> walking (vx 140)");
    Platformer_press_left(g); snap("press_left -> face-1, vx -140");
    Platformer_release_horizontal(g); snap("release_horizontal -> idle");

    Platformer_press_jump(g); snap("press_jump -> jumping, jimp=1");
    Platformer_consume_jump_impulse(g); snap("consume_jump_impulse -> jimp=0");
    Platformer_press_right(g); snap("press_right in air -> vx 180 (air_speed)");
    run(22, "0.34s held: still jumping");
    run(1, "tick 23 (0.35s) -> falling");

    Platformer_ground_contact(g); snap("ground_contact -> landing");
    run(5, "0.078s: still landing");
    run(1, "tick 6 (0.08s): input_x!=0 -> walking");
    Platformer_release_horizontal(g); snap("release_horizontal -> idle");

    Platformer_press_jump(g); snap("press_jump -> jumping (fresh)");
    Platformer_release_jump(g); snap("release_jump -> timer frozen");
    run(40, "0.625s released: STILL jumping (no auto-fall)");
    Platformer_ground_contact(g); snap("ground_contact -> landing (input_x=0)");
    run(6, "0.08s: input_x==0 -> idle");

    Platformer_left_ground(g); snap("left_ground -> falling (walked off)");
    Platformer_ground_contact(g); snap("ground_contact -> landing");
    run(6, "recover -> idle");

    Platformer_pickup_mushroom(g); snap("pickup_mushroom -> big (hbox 48)");
    Platformer_pickup_flower(g); snap("pickup_flower -> fiery (can_shoot 1)");
    Platformer_take_damage(g); snap("take_damage -> big [ret-then-transition]");
    Platformer_take_damage(g); snap("take_damage -> small (hbox 24)");
    Platformer_take_damage(g); snap("take_damage in small -> no transition");
    Platformer_pickup_flower(g); snap("pickup_flower from small -> fiery");

    printf("RET take_damage(fiery)=%d form_now=%s (expect 1 / big)\n", bU(Platformer_take_damage(g)), Platformer_form(g));
    printf("RET take_damage(big)=%d form_now=%s (expect 1 / small)\n", bU(Platformer_take_damage(g)), Platformer_form(g));
    printf("RET take_damage(small)=%d form_now=%s (expect 0 / small)\n", bU(Platformer_take_damage(g)), Platformer_form(g));

    Platformer_pickup_mushroom(g); Platformer_press_right(g); snap("re-arm: big + walking before pause");
    Platformer_pause(g); snap("pause -> Paused (push), paused=1");
    run(64, "1.0s paused: locomotion frozen");
    Platformer_resume(g); snap("resume -> Playing (pop), paused=0");

    Platformer* g2 = Platformer_create();
    Platformer_press_right(g2); Platformer_press_sprint(g2);
    const char* loco_before = Platformer_locomotion_state(g2);
    char lb[16]; strcpy(lb, loco_before);
    Platformer_pickup_mushroom(g2); Platformer_pickup_flower(g2);
    printf("ORTHO loco stable across powerups: before=%s after=%s form=%s (expect running/running/fiery)\n", lb, Platformer_locomotion_state(g2), Platformer_form(g2));

    Platformer* g3 = Platformer_create();
    Platformer_press_jump(g3);
    for (int i=0;i<10;i++) Platformer_tick(g3,1.0/64.0);
    Platformer_pause(g3);
    for (int i=0;i<128;i++) Platformer_tick(g3,1.0/64.0);
    Platformer_resume(g3);
    char lr[16]; strcpy(lr, Platformer_locomotion_state(g3));
    for (int i=0;i<12;i++) Platformer_tick(g3,1.0/64.0);
    char sj[16]; strcpy(sj, Platformer_locomotion_state(g3));
    Platformer_tick(g3,1.0/64.0);
    printf("PAUSE ticks dropped: resumed=%s at22=%s at23=%s (expect jumping/jumping/falling)\n", lr, sj, Platformer_locomotion_state(g3));
    return 0;
}
