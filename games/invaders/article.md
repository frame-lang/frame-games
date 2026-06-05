# Space Invaders

> Three composed machines plus Frame's hierarchical-state-machine feature — pause() lives on the $InGame parent and Playing, PlayerDying, and WaveComplete all inherit it.

Breakout taught you composition: orchestrator + sub-machines. Invaders adds the next pattern — **HSM (hierarchical state machine)** — where the orchestrator's own states form a tree.

## The problem HSM solves

Imagine you're writing the pause logic and you have three "in-game" states: `Playing`, `PlayerDying` (the brief stun after a hit), and `WaveComplete` (between waves). The player can hit P in any of them. Without HSM, you write the same `pause()` handler three times — copy-pasted across three states.

HSM says: declare a *parent* state, `$InGame`, that holds the pause handler ONCE. Then say "Playing inherits from InGame", "PlayerDying inherits from InGame", "WaveComplete inherits from InGame". When the machine is in `Playing` and gets `pause()`, the handler on the parent fires automatically. No copy-paste.

In Frame's syntax it looks like `$Playing => $InGame { ... }` — the `=>` reads as "is a child of".

## What's in each machine

- **Invaders** is the orchestrator. `Attract → Playing → PlayerDying / WaveComplete → ... → GameOver`. The three in-game children all live under `$InGame` in the diagram (the rounded box), and the `pause (push$)` edge comes out of the cluster boundary — meaning "from anything inside InGame".
- **Player** has its own four-state machine: `Alive`, `Exploding` (the death animation), `Invulnerable` (a grace window after respawn so a stray bullet doesn't insta-kill you), `Dead`. The orchestrator routes hits and respawns; Player decides what they mean.
- **Fleet** tracks the alien formation: `Marching` (steady horizontal sweep), `Stepping` (the brief downward shift at the edge before reversing), `Defeated` (the wave is cleared).

## What happens when you press P

The orchestrator might be in `Playing`, `PlayerDying`, or `WaveComplete`. All three inherit `pause()` from `$InGame`. The handler does **push$** → stashes whichever child was active, transitions to `Paused`. Pop returns to whichever child you paused in.

You'll notice the diagram shows `Paused` with no incoming edge — framec doesn't currently emit a graphviz edge for inline `push$ -> $X` handlers (it does emit one for normal inherited transitions). The pop edge to the `H*` history pseudostate is what restores the stashed child. See [rfc-candidates.md](../../rfc-candidates.md) for the fix proposal.

## Try it

Start a round. The diagram highlights `Playing` inside the InGame box. Get hit by a bullet → the highlight moves to `PlayerDying`. Press P during either of those — you'll see push to `Paused`. Hit P again — back to exactly where you were. The inherited handler means pause "just works" in every in-game state without you writing it three times.

Composition gives you scale. HSM gives you reuse.
