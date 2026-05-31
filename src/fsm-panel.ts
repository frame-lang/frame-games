import { StateChart } from "../vendor/frame-arcade-js/src/visualizer";

// Frame's `framec -l graphviz` emits one file containing a separate
// `digraph <System> { … }` per @@system. The live state-chart primitive
// (StateChart) renders a single digraph, so the panel splits the file and
// composes one chart per system — the "detailed overview of the FSMs that
// comprise the controller".

export interface SystemDot {
  system: string; // the digraph name, e.g. "Ball" / "Breakout"
  dot: string; // a standalone single-digraph DOT source
}

// Split a multi-system DOT file into its per-system digraphs. Brace-matched,
// since Frame's HTML-table node labels use <…> (never { }), so the only braces
// are the digraph delimiters themselves.
export function splitSystems(dot: string): SystemDot[] {
  const systems: SystemDot[] = [];
  const opener = /digraph\s+(\w+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(dot))) {
    const start = m.index;
    let depth = 0;
    let i = dot.indexOf("{", start);
    for (; i < dot.length; i++) {
      if (dot[i] === "{") depth++;
      else if (dot[i] === "}" && --depth === 0) {
        i++;
        break;
      }
    }
    systems.push({ system: m[1], dot: dot.slice(start, i) });
    opener.lastIndex = i;
  }
  return systems;
}

// Collapse each node's HTML-table label (state name + its full event-handler /
// state-variable list) down to just the state name, so a diagram shows states +
// transitions only and all of a controller's machines fit on one screen. The
// node id (and thus the SVG <title> the highlighter matches) is unchanged.
export function compactStateLabels(dot: string): string {
  return dot.replace(
    /(\w+)\s*\[label = <[\s\S]*?> margin=0 shape=none\]/g,
    (_match, name) => `${name} [label="${name}"]`,
  );
}

// HSM parent states are emitted as `subgraph cluster_<Parent> { label = <html> … }`
// in Frame's graphviz output, with the same heavy method-list table as nodes
// use. Collapse it to a plain quoted parent name so the cluster reads cleanly
// as a box around its children.
export function compactClusterLabels(dot: string): string {
  return dot.replace(
    /(subgraph\s+cluster_(\w+)\s*\{\s*)label\s*=\s*<[\s\S]*?>/g,
    (_match, prefix, name) => `${prefix}label = "${name}"`,
  );
}

// Frame's graphviz output renders `push$ -> $X` and the matching `-> pop$` via
// a shared H* (Stack) pseudostate: the resume edge is drawn as `X -> Stack`,
// but the forward push edge is silent (Stack has no incoming arrow). Without
// Frame background that reads as "Paused is unreachable", which is wrong.
// This injects a dashed forward edge for each declared push$/pop$ pair and
// relabels the H* node with the state it returns to.
export interface PushPopEdge {
  from: string; // pushing state (e.g. "Playing")
  to: string; // pushed-to state (e.g. "Paused")
  pushEvent: string; // the event that triggers push$ (e.g. "pause")
}

export function annotatePushPop(dot: string, edges: readonly PushPopEdge[]): string {
  if (edges.length === 0) return dot;
  let result = dot;
  const fromStates = Array.from(new Set(edges.map((e) => e.from)));
  // Relabel Stack with the state(s) the resume edge pops back to.
  result = result.replace(
    /Stack\[shape="circle" label="H\*"/,
    `Stack[shape="circle" label="↩ ${fromStates.join(" / ")}"`,
  );
  // Inject a dashed forward edge per declared push so the push$ path is
  // visible — UNLESS Frame already drew it. Inline `push$ -> $X` syntax is
  // silent in graphviz; the split form (`push$` then `-> $X` on its own line)
  // is drawn as a normal edge, and an injected dashed one would duplicate it.
  const inserts = edges
    .filter((e) => !new RegExp(`${e.from}\\s*->\\s*${e.to}\\b`).test(result))
    .map((e) => `    ${e.from} -> ${e.to} [label=" ${e.pushEvent} (push$) " style="dashed"]`)
    .join("\n");
  if (inserts) result = result.replace(/\}\s*$/, inserts + "\n}");
  return result;
}

// The current Frame state name of any generated machine — equals `current_state()`
// for the main system, and works uniformly for sub-machines (which don't expose
// that method). Returns the PascalCase state name that matches the .dot titles.
export function liveState(machine: unknown): string | null {
  const c = (machine as { __compartment?: { state?: string } } | null | undefined)?.__compartment;
  return c?.state ?? null;
}

export interface MachineView {
  system: string; // must match a digraph name in the DOT file
  title?: string; // heading (defaults to `system`)
  blurb?: string; // prose shown under the heading
  getState?: () => string | null; // live state name; omit for a static diagram
  pushPop?: readonly PushPopEdge[]; // synthetic push$/pop$ edges (see annotatePushPop)
}

// Renders a stack of state-chart cards (one per machine) and live-highlights
// each from its own getState() on every tick(). The system name is tracked per
// chart so an external source (e.g. a BroadcastChannel from another window)
// can drive highlights via applyStates({ systemName: stateName }).
export class FsmPanel {
  private readonly charts: Array<{
    system: string;
    chart: StateChart;
    getState?: () => string | null;
  }> = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly reorderable = false,
  ) {}

  async render(fullDot: string, views: MachineView[]): Promise<void> {
    const byName = new Map(splitSystems(fullDot).map((s) => [s.system, s.dot]));
    this.container.replaceChildren();
    this.charts.length = 0;

    for (const view of views) {
      const dot = byName.get(view.system);
      if (!dot) continue;

      const card = document.createElement("section");
      card.className = "fsm-card";

      if (this.reorderable) card.appendChild(this.buildMoveBar(card));

      const h = document.createElement("h3");
      h.textContent = view.title ?? view.system;
      card.appendChild(h);

      if (view.blurb) {
        const p = document.createElement("p");
        p.className = "fsm-blurb";
        p.textContent = view.blurb;
        card.appendChild(p);
      }

      const chartEl = document.createElement("div");
      chartEl.className = "fsm-chart";
      card.appendChild(chartEl);
      this.container.appendChild(card);

      const processedDot = annotatePushPop(
        compactClusterLabels(compactStateLabels(dot)),
        view.pushPop ?? [],
      );
      const chart = new StateChart(chartEl, processedDot);
      await chart.render();
      this.charts.push({ system: view.system, chart, getState: view.getState });
    }

    if (this.reorderable) this.refreshMoveButtons();
  }

  private buildMoveBar(card: HTMLElement): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "fsm-move-bar";

    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "move-prev";
    prev.textContent = "←";
    prev.setAttribute("aria-label", "Move left");
    prev.onclick = () => this.moveCard(card, -1);

    const label = document.createElement("span");
    label.textContent = "Move";

    const next = document.createElement("button");
    next.type = "button";
    next.className = "move-next";
    next.textContent = "→";
    next.setAttribute("aria-label", "Move right");
    next.onclick = () => this.moveCard(card, 1);

    bar.append(prev, label, next);
    return bar;
  }

  private moveCard(card: HTMLElement, dir: -1 | 1): void {
    if (dir === -1 && card.previousElementSibling) {
      this.container.insertBefore(card, card.previousElementSibling);
    } else if (dir === 1 && card.nextElementSibling) {
      this.container.insertBefore(card.nextElementSibling, card);
    }
    this.refreshMoveButtons();
  }

  private refreshMoveButtons(): void {
    const cards = Array.from(this.container.children) as HTMLElement[];
    const last = cards.length - 1;
    cards.forEach((card, i) => {
      const prev = card.querySelector(".move-prev") as HTMLButtonElement | null;
      const next = card.querySelector(".move-next") as HTMLButtonElement | null;
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === last;
    });
  }

  // Read each live machine and repaint its active node. Cheap to call every
  // frame — StateChart.highlight() is a no-op when the state is unchanged.
  tick(): void {
    for (const { chart, getState } of this.charts) {
      const s = getState?.();
      if (s) chart.highlight(s);
    }
  }

  // Highlight each machine from an external state snapshot — the pop-out FSM
  // window receives these via BroadcastChannel from the running game page.
  applyStates(states: Readonly<Record<string, string>>): void {
    for (const { system, chart } of this.charts) {
      const s = states[system];
      if (s) chart.highlight(s);
    }
  }
}
