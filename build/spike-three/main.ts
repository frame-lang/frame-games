// Asteroids — TypeScript / three.js host. Same Frame FSM as the other ports
// (asteroids.ts), but rendered in 3D: asteroids are tumbling wireframe
// icosahedrons on the 800x600 play plane, viewed through a slightly-tilted
// perspective camera. HUD is an HTML overlay; live FSM state goes to the site's
// diagram panel via BroadcastChannel (native — TS runs in the page).
import * as THREE from "three";
import { AsteroidsGame, Vec2, IShipHost } from "./asteroids";

const COURT_W = 800;
const COURT_H = 600;

const COL_SHIP = 0x8ab4f8;
const COL_ROCK = 0x9aa4b8;
const COL_BULLET = 0xffffff;
const COL_FLAME = 0xffad42;

const SHIP_THRUST = 240, SHIP_ROT = 4, SHIP_MAX = 320, SHIP_DRAG = 0.5, SHIP_SIZE = 14;
const BULLET_SPEED = 500, BULLET_LIFE = 1.2;

// world (2D, top-left origin, y-down) -> 3D (centered, y-up, z=0 play plane)
const X = (x: number) => x - COURT_W / 2;
const Y = (y: number) => COURT_H / 2 - y;

interface Bullet { pos: Vec2; vel: Vec2; life: number; }

class RockView {
    mesh: THREE.LineSegments;
    spin: THREE.Vector3;
    constructor(scene: THREE.Scene) {
        const geo = new THREE.IcosahedronGeometry(1, 0);
        const mat = new THREE.LineBasicMaterial({ color: COL_ROCK });
        this.mesh = new THREE.LineSegments(new THREE.WireframeGeometry(geo), mat);
        this.mesh.visible = false;
        scene.add(this.mesh);
        this.spin = new THREE.Vector3(Math.random() * 0.6 - 0.3, Math.random() * 0.6 - 0.3, Math.random() * 0.6 - 0.3);
    }
}

class Game implements IShipHost {
    fsm = (AsteroidsGame as any)._create(this, 2) as any;
    court = new Vec2(COURT_W, COURT_H);
    shipPos = new Vec2(COURT_W / 2, COURT_H / 2);
    shipVel = new Vec2(0, 0);
    shipAngle = -Math.PI / 2;
    bullets: Bullet[] = [];
    keys = new Set<string>();
    lastPub = "";
    chan: BroadcastChannel | null = null;

    scene = new THREE.Scene();
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    rocks: RockView[] = [];
    bulletMeshes: THREE.Mesh[] = [];
    shipMesh: THREE.LineSegments;
    hudEl: HTMLDivElement;
    centerEl: HTMLDivElement;

    constructor(container: HTMLElement) {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 1);
        container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(45, 1, 1, 4000);
        // slightly above and behind, looking at court centre — gives depth to
        // the tumbling rocks while staying playable (near top-down).
        this.camera.position.set(0, -120, 760);
        this.camera.lookAt(0, 0, 0);

        this.scene.add(new THREE.AmbientLight(0xffffff, 1));

        // ship — a flat wireframe triangle in the play plane
        const tri = new THREE.BufferGeometry();
        tri.setAttribute("position", new THREE.Float32BufferAttribute(new Array(9).fill(0), 3));
        this.shipMesh = new THREE.LineLoop(tri,
            new THREE.LineBasicMaterial({ color: COL_SHIP })) as any;
        this.scene.add(this.shipMesh);

        // HTML text overlays
        const mk = (size: number, top: string, align: string) => {
            const d = document.createElement("div");
            d.style.cssText = `position:absolute;left:0;width:100%;top:${top};color:#fff;` +
                `font:${size}px/1.4 monospace;text-align:${align};pointer-events:none;white-space:pre-line;`;
            container.appendChild(d);
            return d;
        };
        this.hudEl = mk(15, "8px", "left");
        this.hudEl.style.left = "12px";
        this.hudEl.style.width = "auto";
        this.centerEl = mk(24, "38%", "center");

        try { this.chan = new BroadcastChannel("frame-games:state:asteroids"); } catch { /* */ }

        window.addEventListener("keydown", (e) => this.onKeyDown(e));
        window.addEventListener("keyup", (e) => { this.keys.delete(e.code); });
        window.addEventListener("resize", () => this.resize(container));
        this.resize(container);
        this.resetShip();
    }

    resize(container: HTMLElement) {
        const w = container.clientWidth, h = container.clientHeight;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        // frame the 800x600 plane: pull the camera back if the viewport is narrow
        const fit = Math.max(1, (COURT_W / COURT_H) / (w / h));
        this.camera.position.z = 760 * fit;
        this.camera.updateProjectionMatrix();
    }

    // ── IShipHost ──
    warpOut() { this.shipPos = new Vec2(Math.random() * COURT_W, Math.random() * COURT_H); this.shipVel = new Vec2(0, 0); }
    warpIn() { }
    spawnExplosion() { }
    resetShip() {
        this.shipPos = new Vec2(COURT_W / 2, COURT_H / 2);
        this.shipVel = new Vec2(0, 0);
        this.shipAngle = -Math.PI / 2;
        for (const _ of this.bullets) this.fsm.bullet_expired();
        this.bullets = [];
    }

    onKeyDown(e: KeyboardEvent) {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
        const state = this.fsm.get_current_state_name();
        if (state === "Attract") { this.fsm.start(); this.bullets = []; return; }
        if (state === "GameOver") {
            if (e.code === "KeyR") { this.fsm.restart(); this.fsm.start(); this.bullets = []; }
            return;
        }
        if (e.code === "KeyP") {
            if (this.fsm.is_paused()) this.fsm.resume(); else this.fsm.pause();
            return;
        }
        if (this.fsm.is_paused()) return;
        if (e.code === "KeyH" && this.fsm.ship.can_hyperspace()) this.fsm.ship_hyperspace();
        this.keys.add(e.code);
    }

    thrustHeld() { return this.keys.has("ArrowUp") || this.keys.has("KeyW"); }

    update(dt: number) {
        const state = this.fsm.get_current_state_name();
        if (state === "Attract" || state === "GameOver" || this.fsm.is_paused()) return;
        this.handleInput(dt);
        this.fsm.tick(dt, this.court);
        this.updateShip(dt);
        this.updateBullets(dt);
        this.checkCollisions();
    }

    handleInput(dt: number) {
        if (!this.fsm.ship.is_visible()) return;
        if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) this.shipAngle -= SHIP_ROT * dt;
        if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) this.shipAngle += SHIP_ROT * dt;
        const ss = this.fsm.ship.get_current_state_name();
        if ((ss === "Alive" || ss === "Respawning") && this.thrustHeld()) {
            this.shipVel = this.shipVel.add(new Vec2(Math.cos(this.shipAngle), Math.sin(this.shipAngle)).scale(SHIP_THRUST * dt));
            if (this.shipVel.length() > SHIP_MAX) this.shipVel = this.shipVel.scale(SHIP_MAX / this.shipVel.length());
        }
        if (this.fsm.ship.can_fire() && this.fsm.get_bullets_in_flight() < this.fsm.get_max_bullets() && this.keys.has("Space")) this.tryFire();
    }

    tryFire() {
        this.fsm.ship.fire();
        const d = new Vec2(Math.cos(this.shipAngle), Math.sin(this.shipAngle));
        this.bullets.push({ pos: this.shipPos.add(d.scale(SHIP_SIZE)), vel: d.scale(BULLET_SPEED).add(this.shipVel), life: 0 });
        this.fsm.bullet_fired();
    }

    wrap(p: Vec2) {
        if (p.x < 0) p.x += COURT_W; if (p.x > COURT_W) p.x -= COURT_W;
        if (p.y < 0) p.y += COURT_H; if (p.y > COURT_H) p.y -= COURT_H;
    }

    updateShip(dt: number) {
        if (!this.fsm.ship.is_visible()) return;
        this.shipVel = this.shipVel.scale(1 - SHIP_DRAG * dt);
        this.shipPos = this.shipPos.add(this.shipVel.scale(dt));
        this.wrap(this.shipPos);
    }

    updateBullets(dt: number) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.pos = b.pos.add(b.vel.scale(dt)); b.life += dt; this.wrap(b.pos);
            if (b.life >= BULLET_LIFE) { this.bullets.splice(i, 1); this.fsm.bullet_expired(); }
        }
    }

    checkCollisions() {
        const total = this.fsm.field.count();
        for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
            const bp = this.bullets[bi].pos;
            let hit = -1;
            for (let i = 0; i < total; i++) {
                if (this.fsm.field.is_alive(i) && this.fsm.field.position(i).distanceTo(bp) < this.fsm.field.radius_of(i)) { hit = i; break; }
            }
            if (hit >= 0) { this.fsm.bullet_hit_asteroid(hit); this.bullets.splice(bi, 1); this.fsm.bullet_expired(); }
        }
        if (this.fsm.ship.can_be_hit()) {
            for (let i = 0; i < total; i++) {
                if (this.fsm.field.is_alive(i) && this.fsm.field.position(i).distanceTo(this.shipPos) < this.fsm.field.radius_of(i) + SHIP_SIZE * 0.6) {
                    this.fsm.ship_hit_asteroid(i); break;
                }
            }
        }
    }

    publishState() {
        const g = this.fsm.get_current_state_name();
        const s = this.fsm.ship.get_current_state_name();
        const snap = g + "|" + s;
        if (snap === this.lastPub) return;
        this.lastPub = snap;
        this.chan?.postMessage({ AsteroidsGame: g, Ship: s, AsteroidField: "Active" });
    }

    render(dt: number) {
        const state = this.fsm.get_current_state_name();
        const total = this.fsm.field.count();
        // asteroids (pooled icosahedrons)
        let used = 0;
        for (let i = 0; i < total; i++) {
            if (!this.fsm.field.is_alive(i)) continue;
            while (this.rocks.length <= used) this.rocks.push(new RockView(this.scene));
            const rv = this.rocks[used++];
            const p = this.fsm.field.position(i), r = this.fsm.field.radius_of(i);
            rv.mesh.visible = true;
            rv.mesh.position.set(X(p.x), Y(p.y), 0);
            rv.mesh.scale.setScalar(r);
            rv.mesh.rotation.x += rv.spin.x * dt;
            rv.mesh.rotation.y += rv.spin.y * dt;
            rv.mesh.rotation.z += rv.spin.z * dt;
        }
        for (let k = used; k < this.rocks.length; k++) this.rocks[k].mesh.visible = false;

        // bullets (pooled spheres)
        for (let i = 0; i < this.bullets.length; i++) {
            while (this.bulletMeshes.length <= i) {
                const m = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), new THREE.MeshBasicMaterial({ color: COL_BULLET }));
                this.bulletMeshes.push(m); this.scene.add(m);
            }
            const m = this.bulletMeshes[i]; m.visible = true;
            m.position.set(X(this.bullets[i].pos.x), Y(this.bullets[i].pos.y), 0);
        }
        for (let k = this.bullets.length; k < this.bulletMeshes.length; k++) this.bulletMeshes[k].visible = false;

        // ship — flat triangle in the play plane
        let showShip = state !== "Attract" && state !== "GameOver" && this.fsm.ship.is_visible();
        const ss = this.fsm.ship.get_current_state_name();
        if (showShip && ss === "Respawning" && Math.floor(performance.now() / 100) % 2 !== 0) showShip = false;
        this.shipMesh.visible = showShip && ss !== "Exploding";
        if (this.shipMesh.visible) {
            const a = this.shipAngle, at = this.shipPos;
            const pts = [a, a + 2.5, a - 2.5].map((ang) =>
                new THREE.Vector3(X(at.x + Math.cos(ang) * SHIP_SIZE), Y(at.y + Math.sin(ang) * SHIP_SIZE), 0));
            (this.shipMesh.geometry as THREE.BufferGeometry).setFromPoints(pts);
        }

        this.renderer.render(this.scene, this.camera);
        this.drawHUD(state);
    }

    drawHUD(state: string) {
        this.hudEl.textContent =
            `SCORE  ${String(this.fsm.get_score()).padStart(5, "0")}     LIVES  ${this.fsm.get_lives()}` +
            `     WAVE  ${this.fsm.get_wave()}     DIFF  ${this.fsm.get_difficulty()}` +
            `     WARP  ${this.fsm.ship.get_hyperspaces_remaining()}`;
        let msg = "";
        if (state === "Attract") msg = "A S T E R O I D S\n\nPress any key to start\n(H hyperspace · P pause)";
        else if (state === "WaveClear") msg = "WAVE CLEAR";
        else if (state === "Paused") msg = "PAUSED";
        else if (state === "GameOver") msg = "GAME OVER\n\nPress R to restart";
        this.centerEl.textContent = msg;
    }
}

const container = document.getElementById("app")!;
const game = new Game(container);
if (location.hash === "#autostart") { game.fsm.start(); }  // dev/headless capture
let last = performance.now();
function loop(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.publishState();
    game.render(dt);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
