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
}

// Renders a stack of state-chart cards (one per machine) and live-highlights
// each from its own getState() on every tick().
export class FsmPanel {
  private readonly charts: Array<{ chart: StateChart; getState?: () => string | null }> = [];

  constructor(private readonly container: HTMLElement) {}

  async render(fullDot: string, views: MachineView[]): Promise<void> {
    const byName = new Map(splitSystems(fullDot).map((s) => [s.system, s.dot]));
    this.container.replaceChildren();
    this.charts.length = 0;

    for (const view of views) {
      const dot = byName.get(view.system);
      if (!dot) continue;

      const card = document.createElement("section");
      card.className = "fsm-card";

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

      const chart = new StateChart(chartEl, dot);
      await chart.render();
      this.charts.push({ chart, getState: view.getState });
    }
  }

  // Read each live machine and repaint its active node. Cheap to call every
  // frame — StateChart.highlight() is a no-op when the state is unchanged.
  tick(): void {
    for (const { chart, getState } of this.charts) {
      const s = getState?.();
      if (s) chart.highlight(s);
    }
  }
}
