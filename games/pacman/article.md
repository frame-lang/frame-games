# Pac-Man (Ghost AI)

> Ghost-mode AI as nested state machines — four ghosts each running the same FSM, with HSM-inherited frighten handling and a top-level mode cycle.

Pac-Man's ghosts are the canonical "what's good AI?" question. The answer in the 1980 arcade was elegantly simple — each ghost has a small handful of modes, and the modes cycle on a clock. This game ports that with Frame in mind: every ghost is a state machine, and there's a second machine on top of them that owns the mode cycle.

## What a Pac-Man ghost looks like as an FSM

A ghost can be:

- **InPen** — in the holding cage, waiting for a release schedule.
- **OutOfPen / Chase** — heading toward Pac-Man with the ghost's own target rule (Blinky chases directly, Pinky aims 4 tiles ahead, etc.).
- **OutOfPen / Scatter** — heading to the ghost's home corner.
- **Frightened** — blue and edible; runs away.
- **Eaten** — just the eyes, returning to the pen.

Notice the slash in `OutOfPen / Chase`. That's not a typo — `OutOfPen` is the **HSM parent** of both `Chase` and `Scatter`. Look at the Ghost diagram: there's a rounded box around `Chase` and `Scatter`, labelled `OutOfPen`. Anything either child does that's the same for both lives on the parent.

## What that buys you

Eating a power pellet should frighten any ghost that's out of the pen — whether it's currently chasing or scattering. Writing that twice (once on Chase, once on Scatter) is the copy-paste smell. Writing it ONCE on `OutOfPen` and letting both children inherit is HSM. You can see the `power_pellet_eaten` edge in the diagram leaving the cluster boundary — meaning "from whichever OutOfPen child is currently active."

And it's a **push$**: it stashes the current child (`Chase` or `Scatter`) and transitions to `Frightened`. When frighten expires, **pop$** returns to exactly where the ghost was. A ghost mid-chase resumes chasing. A ghost mid-scatter resumes scattering.

## Two machines, two scales

- **Ghost** is the per-ghost AI. Four ghosts run this same FSM independently, each with its own home corner and target rule (the diagram tracks the first one).
- **GhostGame** is the phase clock for the whole arena. The global mode cycles `Scatter ⇄ Chase` on a tick timer. Eating the pellet does push$ at the GAME scale too — stashes whichever global mode was active, transitions to `Frightened`, and pops back when the pellet's effect ends.

Two FSMs, both using push$/pop$ to model a temporary excursion. Same primitive, different scope.

## Try it

Open the pop-out diagrams. As the global mode cycles, you'll see `GhostGame` highlight flip Scatter ⇄ Chase on its own. Grab a pellet → both `GhostGame` and the individual `Ghost` highlight jump to `Frightened`. When the pellet wears off → both pop back to where they were.

Two machines, four ghosts, no flags.
