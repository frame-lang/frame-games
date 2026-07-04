// Asteroids — Dart/Flame host for the Frame AsteroidsGame controller.
// A FlameGame that owns the FSM, handles ship physics + input + collisions,
// renders the scene, and implements the four ShipHost effects the Ship FSM
// fires on state changes. Mirrors the Rust/gdext gameplay driver.
import 'dart:math';
import 'dart:ui' hide TextStyle;
import 'package:flame/game.dart';
import 'package:flame/components.dart' show Anchor;
import 'package:flutter/material.dart' show runApp;
import 'package:flutter/painting.dart' show TextStyle;
import 'package:flutter/services.dart';
import 'package:web/web.dart' as web;
import 'dart:js_interop';

import 'asteroids.dart';

const Color colBg = Color(0xFF000000);
const Color colShip = Color(0xFF8AB4F8);
const Color colRock = Color(0xFF9AA4B8);
const Color colBullet = Color(0xFFFFFFFF);
const Color colFlame = Color(0xFFFFAD42);

const double shipThrust = 240.0;
const double shipRotationSpeed = 4.0;
const double shipMaxSpeed = 320.0;
const double shipDrag = 0.5;
const double shipSize = 14.0;
const double bulletSpeed = 500.0;
const double bulletLifetime = 1.2;
const double bulletSize = 2.0;

final Random _rng = Random();
double _rf() => _rng.nextDouble();

class Bullet {
  Vector2 pos;
  Vector2 vel;
  double life;
  Bullet(this.pos, this.vel, this.life);
}

class AsteroidsFlame extends FlameGame implements ShipHost {
  late AsteroidsGame fsm;
  Vector2 shipPos = Vector2.zero();
  Vector2 shipVel = Vector2.zero();
  double shipAngle = -pi * 0.5;
  final List<Bullet> bullets = [];
  bool pWasDown = false;
  bool hWasDown = false;
  final Vector2 court = Vector2(800.0, 600.0);
  final int difficulty = 2;
  String lastPub = '';

  late final bool _touch;
  late final web.BroadcastChannel _chan;

  late final TextPaint _hudPaint;
  late final TextPaint _centerPaint;

  @override
  Future<void> onLoad() async {
    fsm = AsteroidsGame.create(this, difficulty);
    _touch = web.window
        .matchMedia('(hover: none) and (pointer: coarse)')
        .matches;
    _chan = web.BroadcastChannel('frame-games:state:asteroids');
    _hudPaint = TextPaint(
      style: const TextStyle(color: Color(0xFFFFFFFF), fontSize: 18),
    );
    _centerPaint = TextPaint(
      style: const TextStyle(color: Color(0xFFFFFFFF), fontSize: 28),
    );
    _resetShip();
  }

  // ---- Host surface — the Ship FSM fires these ----
  @override
  void warpOut() {
    shipPos = Vector2(_rf() * court.x, _rf() * court.y);
    shipVel = Vector2.zero();
  }

  @override
  void warpIn() {}

  @override
  void spawnExplosion() {}

  @override
  void resetShip() => _resetShip();

  void _resetShip() {
    shipPos = court * 0.5;
    shipVel = Vector2.zero();
    shipAngle = -pi * 0.5;
    final n = bullets.length;
    for (var i = 0; i < n; i++) {
      fsm.bullet_expired();
    }
    bullets.clear();
  }

  // ---- Frame loop ----
  @override
  void update(double dt) {
    super.update(dt);
    _handleInput(dt);
    final state = fsm.get_current_state_name();
    final paused = fsm.is_paused();
    if (!paused && state != 'Attract' && state != 'GameOver') {
      fsm.tick(dt, court);
      _updateShip(dt);
      _updateBullets(dt);
      _checkCollisions();
    }
    _publishState();
  }

  bool _keyDown(LogicalKeyboardKey k) =>
      HardwareKeyboard.instance.isLogicalKeyPressed(k);

  bool get _thrustHeld =>
      _keyDown(LogicalKeyboardKey.arrowUp) || _keyDown(LogicalKeyboardKey.keyW);

  void _handleInput(double dt) {
    final state = fsm.get_current_state_name();
    if (state == 'Attract') {
      if (HardwareKeyboard.instance.logicalKeysPressed.isNotEmpty) {
        fsm.start();
        bullets.clear();
      }
      return;
    }
    if (state == 'GameOver') {
      if (_keyDown(LogicalKeyboardKey.keyR)) {
        fsm.restart();
        fsm.start();
        bullets.clear();
      }
      return;
    }

    final pDown = _keyDown(LogicalKeyboardKey.keyP);
    if (pDown && !pWasDown) {
      pWasDown = true;
      if (fsm.is_paused()) {
        fsm.resume();
      } else {
        fsm.pause();
      }
    } else if (!pDown) {
      pWasDown = false;
    }

    if (fsm.is_paused()) return;
    if (!fsm.ship.is_visible()) return;

    if (_keyDown(LogicalKeyboardKey.arrowLeft) ||
        _keyDown(LogicalKeyboardKey.keyA)) {
      shipAngle -= shipRotationSpeed * dt;
    }
    if (_keyDown(LogicalKeyboardKey.arrowRight) ||
        _keyDown(LogicalKeyboardKey.keyD)) {
      shipAngle += shipRotationSpeed * dt;
    }

    final shipState = fsm.ship.get_current_state_name();
    if (shipState == 'Alive' || shipState == 'Respawning') {
      if (_thrustHeld) {
        shipVel += Vector2(cos(shipAngle), sin(shipAngle)) * shipThrust * dt;
        if (shipVel.length > shipMaxSpeed) {
          shipVel = shipVel.normalized() * shipMaxSpeed;
        }
      }
    }

    if (fsm.ship.can_fire() &&
        fsm.get_bullets_in_flight() < fsm.get_max_bullets() &&
        _keyDown(LogicalKeyboardKey.space)) {
      _tryFire();
    }

    final hDown = _keyDown(LogicalKeyboardKey.keyH);
    if (hDown && !hWasDown) {
      hWasDown = true;
      if (fsm.ship.can_hyperspace()) {
        fsm.ship_hyperspace();
      }
    } else if (!hDown) {
      hWasDown = false;
    }
  }

  void _updateShip(double dt) {
    if (!fsm.ship.is_visible()) return;
    shipVel *= 1.0 - shipDrag * dt;
    shipPos += shipVel * dt;
    if (shipPos.x < 0.0) shipPos.x += court.x;
    if (shipPos.x > court.x) shipPos.x -= court.x;
    if (shipPos.y < 0.0) shipPos.y += court.y;
    if (shipPos.y > court.y) shipPos.y -= court.y;
  }

  void _tryFire() {
    fsm.ship.fire();
    final dir = Vector2(cos(shipAngle), sin(shipAngle));
    final muzzle = shipPos + dir * shipSize;
    bullets.add(Bullet(muzzle, dir * bulletSpeed + shipVel, 0.0));
    fsm.bullet_fired();
  }

  void _updateBullets(double dt) {
    for (var i = bullets.length - 1; i >= 0; i--) {
      final b = bullets[i];
      b.pos += b.vel * dt;
      b.life += dt;
      if (b.pos.x < 0.0) b.pos.x += court.x;
      if (b.pos.x > court.x) b.pos.x -= court.x;
      if (b.pos.y < 0.0) b.pos.y += court.y;
      if (b.pos.y > court.y) b.pos.y -= court.y;
      if (b.life >= bulletLifetime) {
        bullets.removeAt(i);
        fsm.bullet_expired();
      }
    }
  }

  void _checkCollisions() {
    final total = fsm.field.count();
    for (var bi = bullets.length - 1; bi >= 0; bi--) {
      final bpos = bullets[bi].pos;
      var hit = -1;
      for (var i = 0; i < total; i++) {
        if (fsm.field.is_alive(i) &&
            fsm.field.position(i).distanceTo(bpos) < fsm.field.radius_of(i)) {
          hit = i;
          break;
        }
      }
      if (hit >= 0) {
        fsm.bullet_hit_asteroid(hit);
        bullets.removeAt(bi);
        fsm.bullet_expired();
      }
    }

    if (fsm.ship.can_be_hit()) {
      for (var i = 0; i < total; i++) {
        if (fsm.field.is_alive(i) &&
            fsm.field.position(i).distanceTo(shipPos) <
                fsm.field.radius_of(i) + shipSize * 0.6) {
          fsm.ship_hit_asteroid(i);
          break;
        }
      }
    }
  }

  // ---- Render ----
  @override
  void render(Canvas canvas) {
    super.render(canvas);
    canvas.drawColor(colBg, BlendMode.src);
    // Fixed 800x600 design, letterboxed to the canvas (aspect kept) — the
    // Flame equivalent of Godot's canvas_items/keep stretch.
    final s = min(size.x / court.x, size.y / court.y);
    final ox = (size.x - court.x * s) / 2.0;
    final oy = (size.y - court.y * s) / 2.0;
    canvas.save();
    canvas.translate(ox, oy);
    canvas.scale(s);
    canvas.clipRect(Rect.fromLTWH(0, 0, court.x, court.y));
    canvas.drawRect(
        Rect.fromLTWH(0, 0, court.x, court.y), Paint()..color = colBg);

    final state = fsm.get_current_state_name();

    final total = fsm.field.count();
    for (var i = 0; i < total; i++) {
      if (fsm.field.is_alive(i)) {
        _drawAsteroid(canvas, fsm.field.position(i), fsm.field.radius_of(i));
      }
    }
    for (final b in bullets) {
      canvas.drawCircle(
          Offset(b.pos.x, b.pos.y), bulletSize, Paint()..color = colBullet);
    }

    if (state != 'Attract' && state != 'GameOver' && fsm.ship.is_visible()) {
      final shipState = fsm.ship.get_current_state_name();
      if (shipState == 'Exploding') {
        _drawExplosion(canvas, shipPos);
      } else {
        var visible = true;
        if (shipState == 'Respawning') {
          final t = DateTime.now().millisecondsSinceEpoch;
          visible = (t ~/ 100) % 2 == 0;
        }
        if (visible) {
          _drawShip(canvas, shipPos, shipAngle,
              _thrustHeld && (shipState == 'Alive' || shipState == 'Respawning'));
        }
      }
    }

    _drawHud(canvas, state);
    canvas.restore();
  }

  void _drawHud(Canvas canvas, String state) {
    final hud = 'SCORE  ${fsm.get_score().toString().padLeft(5, '0')}'
        '     LIVES  ${fsm.get_lives()}'
        '     WAVE  ${fsm.get_wave()}'
        '     DIFF  ${fsm.get_difficulty()}'
        '     WARP  ${fsm.ship.get_hyperspaces_remaining()}';
    _hudPaint.render(canvas, hud, Vector2(10, 6));

    // Device-aware hints: touch shows glyphs, keyboard shows keys.
    final rtok = _touch ? '↻' : 'R';
    final htok = _touch ? '⚡' : 'H';
    final ptok = _touch ? '⏸' : 'P';
    final verb = _touch ? 'Tap' : 'Press';
    final startMsg = _touch ? 'Tap to start' : 'Press any key to start';
    String center;
    switch (state) {
      case 'Attract':
        center =
            'A S T E R O I D S\n\n$startMsg\n($htok hyperspace · $ptok pause)';
        break;
      case 'WaveClear':
        center = 'WAVE CLEAR';
        break;
      case 'Paused':
        center = 'PAUSED';
        break;
      case 'GameOver':
        center = 'GAME OVER\n\n$verb $rtok to restart';
        break;
      default:
        center = '';
    }
    if (center.isNotEmpty) {
      // Render line-by-line, each anchored top-center, so EVERY line is
      // horizontally centered (TextPaint left-aligns lines within a multi-line
      // block; the Godot ports use HORIZONTAL_ALIGNMENT_CENTER per line).
      var y = court.y * 0.42;
      for (final line in center.split('\n')) {
        if (line.isNotEmpty) {
          _centerPaint.render(canvas, line, Vector2(court.x * 0.5, y),
              anchor: Anchor.topCenter);
        }
        y += 36;
      }
    }
  }

  void _drawAsteroid(Canvas canvas, Vector2 at, double radius) {
    canvas.drawCircle(
        Offset(at.x, at.y),
        radius,
        Paint()
          ..color = colRock
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5);
  }

  void _drawShip(Canvas canvas, Vector2 at, double angle, bool flame) {
    final nose = at + Vector2(cos(angle), sin(angle)) * shipSize;
    final left = at + Vector2(cos(angle + 2.5), sin(angle + 2.5)) * shipSize;
    final right = at + Vector2(cos(angle - 2.5), sin(angle - 2.5)) * shipSize;
    final path = Path()
      ..moveTo(nose.x, nose.y)
      ..lineTo(left.x, left.y)
      ..lineTo(right.x, right.y)
      ..close();
    canvas.drawPath(path, Paint()..color = colShip);
    if (flame) {
      final tailBase = (left + right) * 0.5;
      final tailTip = at - Vector2(cos(angle), sin(angle)) * shipSize * 1.4;
      canvas.drawLine(Offset(tailBase.x, tailBase.y),
          Offset(tailTip.x, tailTip.y), Paint()
            ..color = colFlame
            ..strokeWidth = 2);
    }
  }

  void _drawExplosion(Canvas canvas, Vector2 at) {
    for (var i = 0; i < 8; i++) {
      final t = i / 8.0 * 2.0 * pi;
      final p1 = at + Vector2(cos(t), sin(t)) * 4.0;
      final p2 = at + Vector2(cos(t), sin(t)) * 14.0;
      canvas.drawLine(Offset(p1.x, p1.y), Offset(p2.x, p2.y),
          Paint()
            ..color = colShip
            ..strokeWidth = 1.5);
    }
  }

  // Live FSM state -> BroadcastChannel (the site's diagram panel listens on
  // frame-games:state:asteroids). Posts a snapshot on change.
  void _publishState() {
    final g = fsm.get_current_state_name();
    final s = fsm.ship.get_current_state_name();
    final snap = '$g|$s';
    if (snap == lastPub) return;
    lastPub = snap;
    _chan.postMessage(<String, String>{
      'AsteroidsGame': g,
      'Ship': s,
      'AsteroidField': 'Active',
    }.jsify());
  }
}

void main() {
  runApp(GameWidget(game: AsteroidsFlame()));
}
