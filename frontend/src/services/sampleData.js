/** Sample 6-bus network, per-unit on a common base (e.g. 1 p.u. = 100 MW). Balanced: 3.5 p.u. generation = 3.5 p.u. demand. */
export function sampleGrid() {
  return {
    name: 'Sample 6-bus network',
    referenceBus: 'B1',
    buses: [
      { id: 'B1', name: 'North Hydro', generation: 1.8, demand: 0 },
      { id: 'B2', name: 'Riverside', generation: 1.0, demand: 0.2 },
      { id: 'B3', name: 'Old Town', generation: 0, demand: 1.1 },
      { id: 'B4', name: 'Central', generation: 0, demand: 0.9 },
      { id: 'B5', name: 'Harbour', generation: 0, demand: 1.0 },
      { id: 'B6', name: 'East Solar', generation: 0.7, demand: 0.3 },
    ],
    lines: [
      { id: 'L1', from_bus: 'B1', to_bus: 'B2', reactance: 0.2, capacity: 1.2 },
      { id: 'L2', from_bus: 'B1', to_bus: 'B4', reactance: 0.25, capacity: 1.3 },
      { id: 'L3', from_bus: 'B2', to_bus: 'B3', reactance: 0.2, capacity: 1.3 },
      { id: 'L4', from_bus: 'B2', to_bus: 'B4', reactance: 0.3, capacity: 0.6 },
      { id: 'L5', from_bus: 'B3', to_bus: 'B5', reactance: 0.25, capacity: 0.7 },
      { id: 'L6', from_bus: 'B4', to_bus: 'B5', reactance: 0.2, capacity: 0.7 },
      { id: 'L7', from_bus: 'B4', to_bus: 'B6', reactance: 0.15, capacity: 0.8 },
      { id: 'L8', from_bus: 'B5', to_bus: 'B6', reactance: 0.3, capacity: 0.5 },
      { id: 'L9', from_bus: 'B3', to_bus: 'B6', reactance: 0.35, capacity: 0.5 },
    ],
  };
}

/** A scenario that raises Harbour demand and the matching North Hydro generation. */
export function sampleScenario() {
  return {
    name: 'Evening peak',
    overrides: { B5: { generation: 0, demand: 1.2 }, B1: { generation: 2.0, demand: 0 } },
  };
}

export function emptyGrid() {
  return {
    name: 'New grid',
    referenceBus: 'B1',
    buses: [
      { id: 'B1', name: 'Bus 1', generation: 1, demand: 0 },
      { id: 'B2', name: 'Bus 2', generation: 0, demand: 1 },
    ],
    lines: [{ id: 'L1', from_bus: 'B1', to_bus: 'B2', reactance: 0.1, capacity: 1.5 }],
  };
}

/** Returns a copy of the grid with a scenario's per-bus overrides applied (the grid itself is unchanged). */
export function applyScenario(grid, scenario) {
  if (!scenario) return grid;
  return {
    ...grid,
    buses: grid.buses.map((b) => (scenario.overrides?.[b.id] ? { ...b, ...scenario.overrides[b.id] } : b)),
  };
}
