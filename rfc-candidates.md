# RFC candidates

Notebook of suggestions for future Frame RFCs, surfaced during frame-games showcase work. Each entry is a sketch — capture the idea so it isn't lost, refine into a full RFC later.

---

## RFC-CANDIDATE-001 — Inherited `push$` handlers should emit a cluster-boundary edge in graphviz output

### Status

Candidate. Workaround (synthetic edges in JS post-processing) was removed; the showcase now displays framec's actual output and references this RFC for the gap.

Filed against framec as **FRAMEC_BUGS Issue #46** (`~/projects/framec/_scratch/FRAMEC_BUGS.md`) with a verified minimal reproducer.

### Motivation

When an HSM parent declares a handler that several children inherit, framec's graphviz output should make it clear the transition lives **on the parent**, not on each child. Today this is inconsistent depending on whether the handler is a normal transition or a `push$`.

For **normal inherited transitions**, framec already does the right thing — it emits a single edge from the parent's cluster boundary using graphviz's `ltail` attribute:

    OutOfPen -> Frightened [label=" power_pellet_eaten " ltail="cluster_OutOfPen"]

Graphviz then renders the line as starting at the cluster's outer rounded box, not at any one child node. The reader sees "this transition fires from inside OutOfPen, regardless of which child is active."

For **inline `push$ -> $Target` transitions** (e.g. `pause() { push$ -> $Paused }` declared on `$InGame`), framec emits **no edge at all**. The push direction is silent in the diagram. Readers see `$Paused` as unreachable.

Asteroids is the cleanest example. `$InGame.pause()` does `push$ -> $Paused`; `$Playing / $ShipDying / $WaveClear` all inherit. Framec's current Asteroids diagram has zero edges going **into** `$Paused` — only the resume edge coming out. Without context the reader concludes the FSM is broken.

### Proposed

Emit the same cluster-boundary pattern for inherited `push$` handlers, with `style="dashed"` to distinguish push$ from normal transitions:

    InGame -> Paused [label=" pause (push$) " ltail="cluster_InGame" style="dashed"]

That's one edge, drawn from the cluster border, dashed to mark it as push$. Symmetric with the existing solid cluster-edge pattern for non-push transitions. Pop$ continues to flow through the existing `Stack` (H\*) pseudostate.

For non-HSM cases where `push$` originates from a single state (no inheritance), framec should still emit a dashed forward edge from that state — currently it emits nothing.

### Workaround that was in place

`frame-games/src/fsm-panel.ts` had an `annotatePushPop()` function that injected synthetic dashed edges into the dot string before rendering, based on per-manifest `pushPop` declarations. It worked but was load-bearing for the diagram's correctness — and it modelled `pause` as three separate child→Paused edges, which **misrepresents the semantics** (the handler lives on the parent, not the children). Removed.

### Related follow-up

The `H*` Stack pseudostate framec emits for `pop$` is functionally correct (UML history pseudostate notation) but cryptic for readers new to Frame. A follow-up RFC could relabel it to `↩ <parent>` automatically based on which cluster's handler did the push, so the diagram is self-explanatory.

---
