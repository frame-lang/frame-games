# Stealth (Guard AI)

> Three guards each running an HSM-with-cluster-parent AI — Aware groups the patrol / investigate / alerted / searching modes that share spot_player handling, and push$/pop$ models "investigate then resume" as a subroutine.

If you've ever wrestled with NPC AI in code, you know the wrong way: a giant `update()` method on every guard, full of nested `if`s on the guard's `state` field, each branch reading flags and twiddling them. It works for one guard. It collapses by the third.

The right way is a state machine per guard. Same idea you've seen in Pacman, but Stealth makes the AI shape clearer because the modes are easier to describe in plain English.

## What each guard is doing

A guard you can interact with is in one of these:

- **Patrolling** — walking the assigned patrol route.
- **Investigating** — paused on a noise, looking around briefly.
- **Alerted** — saw you for an instant, dashing to your last known position.
- **Searching** — gave up the chase, sweeping the area.
- **Engaged** — touched you. Game over.

All except Engaged are *awake* modes. They share a key piece of behaviour: **spot the player → become Alerted**, **touch the player → become Engaged**. Writing that on each of the four awake states is the copy-paste smell.

Frame's answer (same as Invaders and Pacman): a cluster parent called `Aware` holds those four children, and the shared handlers live on the parent. The diagram shows it as a rounded box around the awake states; the `spot_player` edge comes out of the cluster boundary, meaning "from any awake state."

## The investigate subroutine

Now imagine the guard is patrolling and hears a sound. The natural response: pause, look around for a second or two, then *continue patrolling from exactly where you left off*. Not restart the patrol — resume.

You've seen that primitive before. It's the same **push$/pop$** as Asteroids' hyperspace: from `Patrolling`, `hear_sound` does push$ (stashes the patrol compartment) and transitions to `Investigating`. When the investigate timer expires, pop$ returns to exactly the patrol step you were on.

The interruption is a function call. The guard's regular routine continues underneath, completely unaware.

## Three guards, same machine

The Stealth orchestrator instantiates three Guard machines (named guard1, guard2, guard3 in code), each independent. Different patrol routes, different positions on the map, but the same FSM driving each one. The diagram tracks the first guard; the others are state-equivalent.

## Why this is good NPC architecture

A guard with this machine has **no flags**. There's no `isInvestigating` boolean to keep in sync with the visual. The state IS the flag. The renderer reads `guard.is_aware()` (a per-state query — true in Aware, false in Engaged) and trusts the machine. When the guard transitions out of Aware (touched the player), every dependent answer changes atomically.

## Try it

Reach the green exit without being seen. Watch a guard's diagram as you sneak past — `Patrolling` stays highlighted. Walk close enough to be heard → `Investigating` lights up briefly, then pops back to `Patrolling`. Get spotted → the highlight jumps out of the cluster to `Alerted`, then `Searching` if you escape line-of-sight. Get touched → `Engaged`, and the orchestrator flips to `Caught`.

One machine. Believable AI. No flags.
