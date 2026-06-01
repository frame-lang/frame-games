# Shooter (capstone)

> The capstone — four composed machines at scale: an orchestrator with waves + a boss fight, a player, parameterized enemies, and a three-phase HSM boss whose phase clusters change on HP thresholds.

Shooter is where all the patterns from the other chapters land in one game. If you've read Pong (FSM basics), Breakout (composition), Invaders (HSM), Asteroids (push$/pop$ subroutines), and Pacman (multiple instances), you've already seen every individual technique. Shooter combines them.

## What's in the controller

- **Shooter** is the orchestrator. The flow is bigger than the earlier games: `Attract → Playing` (the wave grinder where enemies spawn and you shoot them) → when the last wave clears, `BossFight` → either `Victory` (you took the boss down) or `GameOver` (the boss took you down). Pause is push$/pop$ from either Playing OR BossFight, so resume returns to exactly the phase you paused in.
- **Player** is the same shape you saw in Invaders: Alive / Exploding / Invulnerable / Dead. Different game, same machine.
- **Enemy** is **parameterized** — each enemy instance is constructed with its own `kind`, `hp`, `fire_rate`, and `points`. Many run concurrently (the diagram tracks the first one). All four-state: `Spawning → Active → Dying → Gone`.
- **Boss** is the showcase. Read on.

## The Boss as a three-phase HSM

Most boss fights have phases. The boss has full HP and does a simple attack. Get them to 2/3 HP and they upshift — new attack pattern. Get them to 1/3 HP and they upshift again — even harder pattern. Each phase has its own attack rhythm.

Phases as a flat FSM would be ugly — each phase needs its own `Idle` and its own attack pattern, and you'd write them as eight unrelated states.

The HSM answer: each phase is a **cluster parent** holding two children (`Idle` and an attack). Look at the Boss diagram — there are three rounded boxes, `PhaseOne` / `PhaseTwo` / `PhaseThree`, each containing a P1Idle/P1Firing pair, a P2Idle/P2Spread pair, a P3Idle/P3Spray pair. The `hit` handler lives on the **phase parent**: when the boss's HP drops past a threshold inside any phase, the cluster transition leaves the whole phase and enters the next phase's Idle child.

That means each phase can be designed independently — its own attack rhythm, its own ticks — and the cross-phase transitions are written once on the parent, not on every leaf.

## Where it all comes together

Look at this game's panel. You can see HSM (Boss), composition (4 machines), push$/pop$ pause (Shooter), and many instances of the same FSM (Enemy). Every technique from every prior chapter, in one controller. That's deliberate — it's the capstone.

## Try it

Survive the wave grinder. Watch `Shooter` flip from `Playing` to `BossFight`. Watch `Boss` start in `PhaseOne` and stay there until you do enough damage — then transition out of the whole `PhaseOne` cluster into `PhaseTwo`. Different attack pattern, same machine.
