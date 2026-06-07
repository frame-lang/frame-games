import { StateChart } from "./state-chart";

// Frame's `framec -l graphviz` emits one file containing a separate
// `digraph <System> { … }` per @@system. The live state-chart primitive
// (StateChart) renders a single digraph, so the panel splits the file and
// composes one chart per system — the "detailed overview of the FSMs that
// comprise the controller".

export interface SystemDot {
  system: string; // the digraph name, e.g. "Ball" / "Breakout"
  dot: string; // a standalone single-digraph DOT source
}

// Split a Frame source file into its per-system source blocks. Each entry is
// the @@system block (with the optional @@[main] annotation if present
// immediately above) — handy for showing the Frame snippet alongside the
// diagram for a particular system, instead of the whole file in one dump.
export interface SystemSource {
  system: string;
  source: string;
}
export function splitFrameSystems(fjs: string): SystemSource[] {
  const out: SystemSource[] = [];
  // System header forms accepted:
  //   @@system Ball {                         (the .fjs JS target)
  //   @@system Ball : RefCounted {            (the .fgd GDScript target)
  //   @@system Ball(arg: int) { ... }         (parameterized)
  //   @@[main]\n@@system Ball ...             (main-system attribute)
  const re = /(?:@@\[main\][^\n]*\n\s*)?@@system\s+(\w+)(?:\s*\([^)]*\))?(?:\s*:\s*\w+)?\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fjs))) {
    const start = m.index;
    let depth = 0;
    let i = fjs.indexOf("{", m.index);
    for (; i < fjs.length; i++) {
      const c = fjs[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    out.push({ system: m[1], source: fjs.slice(start, i) });
    re.lastIndex = i;
  }
  return out;
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
// as a box around its children. The HTML label itself contains <…> tags
// (<table>, <tr>, <td>, <br/>), so we anchor the end on `</table>\s*>` rather
// than the first stray `>` — otherwise the match stops inside the opening
// <table> tag and leaves a malformed dot fragment that breaks viz-js.
export function compactClusterLabels(dot: string): string {
  return dot.replace(
    /(subgraph\s+cluster_(\w+)\s*\{\s*)label\s*=\s*<[\s\S]*?<\/table>\s*>/g,
    (_match, prefix, name) => `${prefix}label = "${name}"`,
  );
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
  source?: string; // Frame source for this system, rendered below the chart
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
      card.dataset.system = view.system;

      if (this.reorderable) card.appendChild(this.buildMoveBar(card));

      // Card heading is the system name + " Controller" suffix — labels
      // these as the Frame-authored *controllers* (FSMs), not just abstract
      // system names. Explanations live in the article below, not the card.
      const h = document.createElement("h3");
      h.textContent = `${view.system} Controller`;
      card.appendChild(h);

      const chartEl = document.createElement("div");
      chartEl.className = "fsm-chart";
      card.appendChild(chartEl);

      // Per-card Frame source: the @@system block this diagram was generated
      // from, rendered as a scrollable monospace block under the chart.
      if (view.source) {
        const sourceEl = document.createElement("pre");
        sourceEl.className = "fsm-source";
        const codeEl = document.createElement("code");
        codeEl.textContent = view.source;
        sourceEl.appendChild(codeEl);
        card.appendChild(sourceEl);
      }

      this.container.appendChild(card);

      const processedDot = compactClusterLabels(compactStateLabels(dot));
      const chart = new StateChart(chartEl, processedDot);
      await chart.render();
      this.charts.push({ system: view.system, chart, getState: view.getState });
    }

    if (this.reorderable) this.refreshMoveButtons();
  }

  // Swap the per-card Frame source text in-place (e.g., when the user toggles
  // between the JS runtime's .fjs and the Godot runtime's .fgd). Leaves the
  // SVG diagrams alone — the state names match across targets, so the chart
  // (and any live highlight) keeps working without a re-render.
  setSources(sources: ReadonlyMap<string, string>): void {
    for (const card of Array.from(this.container.children) as HTMLElement[]) {
      const sys = card.dataset.system;
      if (!sys) continue;
      const src = sources.get(sys);
      if (src == null) continue;
      let code = card.querySelector(".fsm-source code") as HTMLElement | null;
      if (!code) {
        // Card was rendered without a source initially; build it on demand.
        const sourceEl = document.createElement("pre");
        sourceEl.className = "fsm-source";
        code = document.createElement("code");
        sourceEl.appendChild(code);
        card.appendChild(sourceEl);
      }
      code.textContent = src;
    }
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
