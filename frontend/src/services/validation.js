const isNum = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));

/** Client-side mirror of the API rules, for instant feedback. The API remains the authority. */
export function validateGrid(grid) {
  const errors = [];
  const { buses, lines, referenceBus } = grid;
  if (buses.length < 2) errors.push('Add at least 2 buses.');
  if (buses.length > 10) errors.push('This educational app supports at most 10 buses.');
  if (lines.length < 1) errors.push('Add at least 1 line.');
  const ids = buses.map((b) => b.id);
  if (new Set(ids).size !== ids.length) errors.push('Bus IDs must be unique.');
  if (!ids.includes(referenceBus)) errors.push('Choose exactly one reference bus.');
  buses.forEach((b) => {
    if (!isNum(b.generation) || Number(b.generation) < 0) errors.push(`Bus ${b.id}: generation must be a number of 0 or more.`);
    if (!isNum(b.demand) || Number(b.demand) < 0) errors.push(`Bus ${b.id}: demand must be a number of 0 or more.`);
  });
  const lineIds = lines.map((l) => l.id);
  if (new Set(lineIds).size !== lineIds.length) errors.push('Line IDs must be unique.');
  lines.forEach((l) => {
    if (!ids.includes(l.from_bus) || !ids.includes(l.to_bus)) errors.push(`Line ${l.id}: choose existing buses at both ends.`);
    else if (l.from_bus === l.to_bus) errors.push(`Line ${l.id}: both ends are bus ${l.from_bus}. A line must join two different buses.`);
    if (!isNum(l.reactance) || Number(l.reactance) <= 0) errors.push(`Line ${l.id}: reactance must be greater than 0.`);
    if (!isNum(l.capacity) || Number(l.capacity) <= 0) errors.push(`Line ${l.id}: capacity must be greater than 0.`);
  });
  return errors;
}

export function totals(grid) {
  const sum = (key) => grid.buses.reduce((s, b) => s + (isNum(b[key]) ? Number(b[key]) : 0), 0);
  const generation = sum('generation');
  const demand = sum('demand');
  return { generation, demand, imbalance: generation - demand };
}

export const BALANCE_TOL = 1e-6;
export const isBalanced = (grid) => Math.abs(totals(grid).imbalance) <= BALANCE_TOL;

/** Simple connectivity check (BFS) so the editor can warn before calling the API. */
export function componentsOf(grid) {
  const adj = Object.fromEntries(grid.buses.map((b) => [b.id, []]));
  grid.lines.forEach((l) => {
    if (adj[l.from_bus] && adj[l.to_bus]) { adj[l.from_bus].push(l.to_bus); adj[l.to_bus].push(l.from_bus); }
  });
  const seen = new Set();
  const comps = [];
  Object.keys(adj).forEach((start) => {
    if (seen.has(start)) return;
    const comp = [];
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const n = queue.shift();
      comp.push(n);
      adj[n].forEach((m) => { if (!seen.has(m)) { seen.add(m); queue.push(m); } });
    }
    comps.push(comp);
  });
  return comps;
}

export const fmt = (v, d = 4) => (v === null || v === undefined || Number.isNaN(v) ? '-' : Number(v).toFixed(d));
