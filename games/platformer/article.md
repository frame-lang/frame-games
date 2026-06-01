# Platformer

> Orthogonal-state composition — two independent sub-FSMs (motion + form) run in parallel under one orchestrator, instead of flattening into a 6×3 matrix.

The classic platformer has two concerns the player can think about independently. **What is the character doing?** — standing, walking, running, jumping, falling, landing. And **what form are they in?** — small, big (mushroom), fiery (flower).

You can be a small mario who's jumping. You can be a fiery mario who's running. You can be a small mario who's running. Or a big mario who's idle. Six motion states × three forms = **eighteen** possible combinations.

If you wrote that as one flat state machine, you'd have eighteen states. `SmallIdle`, `SmallWalking`, `SmallRunning`, `BigJumping`, `FieryFalling`... and every transition would have to specify both axes. "When the small idle mario grabs a mushroom, transition to big idle." "When the small walking mario grabs a mushroom, transition to big walking." And on and on.

That's the **state explosion** problem, and the answer is **orthogonal composition**.

## Two machines, running in parallel

- **Locomotion** has six states: `Idle`, `Walking`, `Running`, `Jumping`, `Falling`, `Landing`. It knows nothing about powerups.
- **PowerUp** has three states: `Small`, `Big`, `Fiery`. It knows nothing about motion.

Both run **at the same time**, independently, under one Platformer orchestrator. Press right and Locomotion goes `Idle → Walking`. Grab a mushroom and PowerUp goes `Small → Big`. They don't interfere. The whole 6×3 matrix is implicit — you can read off any cell ("a Fiery character who's Falling") by reading both machines together.

## Why this is a big deal

Adding a fourth form (say, an Ice form) means adding ONE state to PowerUp — not six more states to the flat machine. Adding a new motion mode (say, Swimming) means adding ONE state to Locomotion. Each dimension grows linearly. The flat version grows multiplicatively.

The cost of orthogonal composition is that the two machines need to be genuinely independent — the form shouldn't dictate motion, and motion shouldn't dictate form. When that's true (and in a platformer it almost always is), composition is a huge win.

## What the orchestrator does

Platformer itself is small: just `Playing` and `Paused`. Its job is event-routing — when the scene says "press_right", it forwards to `Locomotion`. When the scene says "power_up_mushroom", it forwards to `PowerUp`. The orchestrator doesn't make decisions; it just connects inputs to the right sub-machine.

## Try it

Move around. Watch the Locomotion highlight flip Idle → Walking → Running as you hold Shift, then Jumping when you press Space. Now grab a mushroom — Locomotion is unchanged, PowerUp flips Small → Big. The two diagrams are doing different things at the same time.

Two FSMs, eighteen behaviours, no matrix.
