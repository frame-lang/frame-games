// Asteroids — Java host for the Frame AsteroidsGame controller. Same FSM as the
// other ports (AsteroidsGame.java, generated from AsteroidsGame.fjava); this is
// the engine layer, compiled to JavaScript by TeaVM. Rendering is HTML canvas 2D
// via TeaVM's JSO bindings; input, the requestAnimationFrame loop, and live FSM
// state (BroadcastChannel via a small JSBody bridge) all go through JSO. The
// four ShipHost callbacks are plain Java methods.
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.teavm.jso.JSBody;
import org.teavm.jso.browser.Window;
import org.teavm.jso.canvas.CanvasRenderingContext2D;
import org.teavm.jso.dom.events.KeyboardEvent;
import org.teavm.jso.dom.html.HTMLCanvasElement;
import org.teavm.jso.dom.html.HTMLDocument;

public class Main implements IShipHost {
    static final double COURT_W = 800, COURT_H = 600;
    static final String COL_SHIP = "#8ab4f8", COL_ROCK = "#9aa4b8",
                        COL_BULLET = "#ffffff", COL_FLAME = "#ffad42", COL_TEXT = "#ffffff";
    static final double SHIP_THRUST = 240, SHIP_ROT = 4, SHIP_MAX = 320, SHIP_DRAG = 0.5, SHIP_SIZE = 14;
    static final double BULLET_SPEED = 500, BULLET_LIFE = 1.2, BULLET_SIZE = 2.4;

    AsteroidsGame fsm;
    CanvasRenderingContext2D ctx;
    Vec2 court = new Vec2(COURT_W, COURT_H);
    Vec2 shipPos = new Vec2(COURT_W / 2, COURT_H / 2);
    Vec2 shipVel = new Vec2(0, 0);
    double shipAngle = -Math.PI / 2;
    List<double[]> bullets = new ArrayList<>();  // {px, py, vx, vy, life}
    Set<String> keys = new HashSet<>();
    String lastPub = "";
    double last = 0;

    // ── BroadcastChannel live-state (JSO has no binding; tiny JSBody bridge) ──
    @JSBody(params = {}, script =
        "try { window.__frameChan = new BroadcastChannel('frame-games:state:asteroids'); } catch(e) { window.__frameChan = null; }")
    static native void initChannel();

    @JSBody(params = {"g", "s"}, script =
        "if (window.__frameChan) window.__frameChan.postMessage({AsteroidsGame: g, Ship: s, AsteroidField: 'Active'});")
    static native void publish(String g, String s);

    @JSBody(params = {}, script = "return location.hash === '#autostart';")
    static native boolean autostart();

    public static void main(String[] args) {
        new Main().start();
    }

    void start() {
        HTMLDocument doc = Window.current().getDocument();
        HTMLCanvasElement canvas = (HTMLCanvasElement) doc.getElementById("game");
        ctx = (CanvasRenderingContext2D) canvas.getContext("2d");
        fsm = AsteroidsGame.__create(this, 2);
        initChannel();
        resetShip();

        Window.current().addEventListener("keydown", evt -> {
            KeyboardEvent e = (KeyboardEvent) evt;
            String code = e.getCode();
            if (code.equals("ArrowLeft") || code.equals("ArrowRight") || code.equals("ArrowUp")
                    || code.equals("ArrowDown") || code.equals("Space")) {
                e.preventDefault();
            }
            keys.add(code);
            onKeyDown(code);
        });
        Window.current().addEventListener("keyup", evt -> {
            keys.remove(((KeyboardEvent) evt).getCode());
        });

        if (autostart()) { fsm.start(); }
        Window.requestAnimationFrame(this::frame);
    }

    void frame(double now) {
        double dt = (last == 0) ? 0.016 : (now - last) / 1000.0;
        if (dt > 0.05) { dt = 0.05; }
        last = now;
        update(dt);
        publishState();
        draw(now);
        Window.requestAnimationFrame(this::frame);
    }

    // ── IShipHost ──
    public void warp_out() {
        shipPos = new Vec2(Math.random() * COURT_W, Math.random() * COURT_H);
        shipVel = new Vec2(0, 0);
    }
    public void warp_in() { }
    public void spawn_explosion() { }
    public void reset_ship() { resetShip(); }

    void resetShip() {
        shipPos = new Vec2(COURT_W / 2, COURT_H / 2);
        shipVel = new Vec2(0, 0);
        shipAngle = -Math.PI / 2;
        for (int i = 0; i < bullets.size(); i++) { fsm.bullet_expired(); }
        bullets.clear();
    }

    // ── input ──
    boolean thrustHeld() { return keys.contains("ArrowUp") || keys.contains("KeyW"); }

    void onKeyDown(String code) {
        String state = fsm.get_current_state_name();
        if (state.equals("Attract")) { fsm.start(); bullets.clear(); return; }
        if (state.equals("GameOver")) {
            if (code.equals("KeyR")) { fsm.restart(); fsm.start(); bullets.clear(); }
            return;
        }
        if (code.equals("KeyP")) {
            if (fsm.is_paused()) { fsm.resume(); } else { fsm.pause(); }
            return;
        }
        if (fsm.is_paused()) { return; }
        if (code.equals("KeyH") && fsm.ship.can_hyperspace()) { fsm.ship_hyperspace(); }
    }

    // ── frame ──
    void update(double dt) {
        String state = fsm.get_current_state_name();
        if (state.equals("Attract") || state.equals("GameOver") || fsm.is_paused()) { return; }
        handleInput(dt);
        fsm.tick(dt, court);
        updateShip(dt);
        updateBullets(dt);
        checkCollisions();
    }

    void handleInput(double dt) {
        if (!fsm.ship.is_visible()) { return; }
        if (keys.contains("ArrowLeft") || keys.contains("KeyA")) { shipAngle -= SHIP_ROT * dt; }
        if (keys.contains("ArrowRight") || keys.contains("KeyD")) { shipAngle += SHIP_ROT * dt; }
        String ss = fsm.ship.get_current_state_name();
        if ((ss.equals("Alive") || ss.equals("Respawning")) && thrustHeld()) {
            shipVel = shipVel.add(new Vec2(Math.cos(shipAngle), Math.sin(shipAngle)).scale(SHIP_THRUST * dt));
            if (shipVel.length() > SHIP_MAX) { shipVel = shipVel.scale(SHIP_MAX / shipVel.length()); }
        }
        if (fsm.ship.can_fire() && fsm.get_bullets_in_flight() < fsm.get_max_bullets() && keys.contains("Space")) {
            tryFire();
        }
    }

    void tryFire() {
        fsm.ship.fire();
        double dx = Math.cos(shipAngle), dy = Math.sin(shipAngle);
        bullets.add(new double[]{
            shipPos.x + dx * SHIP_SIZE, shipPos.y + dy * SHIP_SIZE,
            dx * BULLET_SPEED + shipVel.x, dy * BULLET_SPEED + shipVel.y, 0});
        fsm.bullet_fired();
    }

    void wrapXY(double[] b) {
        if (b[0] < 0) { b[0] += COURT_W; }
        if (b[0] > COURT_W) { b[0] -= COURT_W; }
        if (b[1] < 0) { b[1] += COURT_H; }
        if (b[1] > COURT_H) { b[1] -= COURT_H; }
    }

    void updateShip(double dt) {
        if (!fsm.ship.is_visible()) { return; }
        shipVel = shipVel.scale(1.0 - SHIP_DRAG * dt);
        shipPos = shipPos.add(shipVel.scale(dt));
        if (shipPos.x < 0) { shipPos.x += COURT_W; }
        if (shipPos.x > COURT_W) { shipPos.x -= COURT_W; }
        if (shipPos.y < 0) { shipPos.y += COURT_H; }
        if (shipPos.y > COURT_H) { shipPos.y -= COURT_H; }
    }

    void updateBullets(double dt) {
        for (int i = bullets.size() - 1; i >= 0; i--) {
            double[] b = bullets.get(i);
            b[0] += b[2] * dt;
            b[1] += b[3] * dt;
            b[4] += dt;
            wrapXY(b);
            if (b[4] >= BULLET_LIFE) { bullets.remove(i); fsm.bullet_expired(); }
        }
    }

    void checkCollisions() {
        int total = fsm.field.count();
        for (int bi = bullets.size() - 1; bi >= 0; bi--) {
            double[] b = bullets.get(bi);
            Vec2 bp = new Vec2(b[0], b[1]);
            int hit = -1;
            for (int i = 0; i < total; i++) {
                if (fsm.field.is_alive(i) && fsm.field.position(i).distanceTo(bp) < fsm.field.radius_of(i)) {
                    hit = i;
                    break;
                }
            }
            if (hit >= 0) { fsm.bullet_hit_asteroid(hit); bullets.remove(bi); fsm.bullet_expired(); }
        }
        if (fsm.ship.can_be_hit()) {
            for (int i = 0; i < total; i++) {
                if (fsm.field.is_alive(i) && fsm.field.position(i).distanceTo(shipPos) < fsm.field.radius_of(i) + SHIP_SIZE * 0.6) {
                    fsm.ship_hit_asteroid(i);
                    break;
                }
            }
        }
    }

    void publishState() {
        String g = fsm.get_current_state_name();
        String s = fsm.ship.get_current_state_name();
        String snap = g + "|" + s;
        if (snap.equals(lastPub)) { return; }
        lastPub = snap;
        publish(g, s);
    }

    // ── render ──
    void draw(double now) {
        ctx.setFillStyle("#000000");
        ctx.fillRect(0, 0, COURT_W, COURT_H);
        String state = fsm.get_current_state_name();
        int total = fsm.field.count();

        ctx.setStrokeStyle(COL_ROCK);
        ctx.setLineWidth(1.5);
        for (int i = 0; i < total; i++) {
            if (fsm.field.is_alive(i)) {
                Vec2 p = fsm.field.position(i);
                ctx.beginPath();
                ctx.arc(p.x, p.y, fsm.field.radius_of(i), 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        ctx.setFillStyle(COL_BULLET);
        for (double[] b : bullets) {
            ctx.beginPath();
            ctx.arc(b[0], b[1], BULLET_SIZE, 0, Math.PI * 2);
            ctx.fill();
        }

        if (!state.equals("Attract") && !state.equals("GameOver") && fsm.ship.is_visible()) {
            String ss = fsm.ship.get_current_state_name();
            if (ss.equals("Exploding")) {
                drawExplosion();
            } else {
                boolean visible = true;
                if (ss.equals("Respawning")) { visible = ((int) (now / 100) % 2 == 0); }
                if (visible) { drawShip(); }
            }
        }

        drawHud(state);
    }

    void drawShip() {
        double a = shipAngle;
        Vec2 at = shipPos;
        Vec2 nose  = at.add(new Vec2(Math.cos(a), Math.sin(a)).scale(SHIP_SIZE));
        Vec2 left  = at.add(new Vec2(Math.cos(a + 2.5), Math.sin(a + 2.5)).scale(SHIP_SIZE));
        Vec2 right = at.add(new Vec2(Math.cos(a - 2.5), Math.sin(a - 2.5)).scale(SHIP_SIZE));
        ctx.setStrokeStyle(COL_SHIP);
        ctx.setLineWidth(1.5);
        ctx.beginPath();
        ctx.moveTo(nose.x, nose.y);
        ctx.lineTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.closePath();
        ctx.stroke();
        if (thrustHeld()) {
            String ss = fsm.ship.get_current_state_name();
            if (ss.equals("Alive") || ss.equals("Respawning")) {
                Vec2 tb = left.add(right).scale(0.5);
                Vec2 tt = at.add(new Vec2(Math.cos(a), Math.sin(a)).scale(-SHIP_SIZE * 1.4));
                ctx.setStrokeStyle(COL_FLAME);
                ctx.beginPath();
                ctx.moveTo(tb.x, tb.y);
                ctx.lineTo(tt.x, tt.y);
                ctx.stroke();
            }
        }
    }

    void drawExplosion() {
        Vec2 at = shipPos;
        ctx.setStrokeStyle(COL_SHIP);
        for (int i = 0; i < 8; i++) {
            double t = i / 8.0 * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(at.x + Math.cos(t) * 4, at.y + Math.sin(t) * 4);
            ctx.lineTo(at.x + Math.cos(t) * 14, at.y + Math.sin(t) * 14);
            ctx.stroke();
        }
    }

    void drawHud(String state) {
        ctx.setFillStyle(COL_TEXT);
        ctx.setTextAlign("left");
        ctx.setFont("16px monospace");
        String hud = String.format("SCORE  %05d     LIVES  %d     WAVE  %d     DIFF  %d     WARP  %d",
                fsm.get_score(), fsm.get_lives(), fsm.get_wave(),
                fsm.get_difficulty(), fsm.ship.get_hyperspaces_remaining());
        ctx.fillText(hud, 12, 24);

        String[] msg = null;
        if (state.equals("Attract")) {
            msg = new String[]{"A S T E R O I D S", "", "Press any key to start", "(H hyperspace - P pause)"};
        } else if (state.equals("WaveClear")) {
            msg = new String[]{"WAVE CLEAR"};
        } else if (state.equals("Paused")) {
            msg = new String[]{"PAUSED"};
        } else if (state.equals("GameOver")) {
            msg = new String[]{"GAME OVER", "", "Press R to restart"};
        }
        if (msg == null) { return; }
        ctx.setTextAlign("center");
        ctx.setFont("26px monospace");
        int y = (int) (COURT_H * 0.4);
        for (String line : msg) {
            if (!line.isEmpty()) { ctx.fillText(line, COURT_W / 2, y); }
            y += 38;
        }
    }
}
