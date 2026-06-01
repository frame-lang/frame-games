# Asteroids

> Two push$/pop$ patterns at different scales — a Ship subroutine (Alive → Hyperspace → back) and a top-level pause, plus HSM inheritance for the in-game children.

You've seen **push$/pop$** as pause (Pong, Breakout, Invaders): stash the current compartment, transition to `Paused`, then pop back. Asteroids uses the same primitive for something more interesting — a **subroutine** inside the Ship.

## Hyperspace as a subroutine

Press H in Asteroids and your ship blinks out for 0.4 seconds — invulnerable, invisible, you can't shoot. When the timer expires, you reappear, alive again.

The naive way to write that: add a `hyperspacing` boolean to the ship, set it on H, clear it on a timer, special-case all the rendering and collision code. Six places to update, easy to forget one.

The Frame way: model hyperspace as **its own state** — `$InHyperspace` — with its own timer (a state variable created on entry, destroyed on exit), its own `can_fire`/`can_be_hit`/`is_visible` queries (all false), and a `tick(dt)` handler that pops back when the timer expires.

The transition out of `$Alive` is **push$**: stash whatever compartment was active, transition to `$InHyperspace`. The transition out of `$InHyperspace` is **pop$**: return to exactly the prior compartment. From the caller's perspective it's a function call — invoke "hyperspace", and when it's done you're back where you started.

You can see it on the Ship diagram: the solid `hyperspace` edge from `Alive` to `InHyperspace` is the push direction; the `tick` edge to the `↩ Alive` node is the pop. The `↩` represents "back to whatever pushed."

## What's in each machine

- **Asteroids** is the orchestrator. Same shape as Invaders: an `$InGame` HSM parent holds `Playing`, `ShipDying`, `WaveClear`, all inheriting `pause`.
- **Ship** has five states: `Alive` (steerable, shoots, vulnerable), `InHyperspace` (the subroutine), `Exploding`, `Respawning`, `Dead`.

## Why subroutines beat flags

The hyperspace state owns its own data (`$.timer`, `$.duration`) and its own answers to `can_be_hit()` (false) and `is_visible()` (false). The Phaser scene doesn't have to remember any of that — it just calls `ship.is_visible()` each frame and trusts the machine. When the state changes, every dependent question changes with it, atomically.

That's the same idea as encapsulation in OO, but at the state level.

## Try it

Press H mid-rally. The Ship highlight jumps from `Alive` to `InHyperspace`; the canvas blinks the ship out. Wait 0.4s. The highlight returns to `Alive`. Two transitions, no flags.

Now do it while paused — you can't. The orchestrator is in `Paused`, the Ship handler only fires in `Alive`. The state machine *denies* invalid inputs by construction.
