import { Button, inputClass } from './UI.jsx';

const nextId = (items, prefix) => {
  let n = items.length + 1;
  while (items.some((i) => i.id === `${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
};

export function BusTable({ grid, setGrid }) {
  const update = (id, patch) => setGrid((g) => ({ ...g, buses: g.buses.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));

  const add = () => setGrid((g) => {
    const id = nextId(g.buses, 'B');
    return { ...g, buses: [...g.buses, { id, name: `Bus ${id.slice(1)}`, generation: 0, demand: 0 }] };
  });

  const remove = (id) => {
    const touching = grid.lines.filter((l) => l.from_bus === id || l.to_bus === id).length;
    const msg = touching ? `Delete bus ${id} and the ${touching} line(s) connected to it?` : `Delete bus ${id}?`;
    if (!window.confirm(msg)) return;
    setGrid((g) => {
      const buses = g.buses.filter((b) => b.id !== id);
      return {
        ...g, buses,
        lines: g.lines.filter((l) => l.from_bus !== id && l.to_bus !== id),
        referenceBus: g.referenceBus === id ? buses[0]?.id || '' : g.referenceBus,
      };
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <caption className="sr-only">Buses</caption>
        <thead>
          <tr className="border-b border-grid-200 text-left">
            <th scope="col" className="px-1 py-2">Reference</th>
            <th scope="col" className="px-1 py-2">ID</th>
            <th scope="col" className="px-1 py-2">Name</th>
            <th scope="col" className="px-1 py-2">Generation (p.u.)</th>
            <th scope="col" className="px-1 py-2">Demand (p.u.)</th>
            <th scope="col" className="px-1 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {grid.buses.map((b) => (
            <tr key={b.id} className="border-b border-grid-100">
              <td className="px-1 py-1.5">
                <input type="radio" name="reference-bus" checked={grid.referenceBus === b.id}
                  onChange={() => setGrid((g) => ({ ...g, referenceBus: b.id }))} aria-label={`Use ${b.id} as reference bus`} />
              </td>
              <td className="px-1 py-1.5 font-semibold">{b.id}</td>
              <td className="px-1 py-1.5"><input className={inputClass} value={b.name} aria-label={`Name of ${b.id}`} onChange={(e) => update(b.id, { name: e.target.value })} /></td>
              <td className="px-1 py-1.5"><input className={inputClass} type="number" step="any" min="0" value={b.generation} aria-label={`Generation at ${b.id}`} onChange={(e) => update(b.id, { generation: e.target.value })} /></td>
              <td className="px-1 py-1.5"><input className={inputClass} type="number" step="any" min="0" value={b.demand} aria-label={`Demand at ${b.id}`} onChange={(e) => update(b.id, { demand: e.target.value })} /></td>
              <td className="px-1 py-1.5"><Button variant="danger" onClick={() => remove(b.id)} aria-label={`Delete bus ${b.id}`}>Delete</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button className="mt-3" onClick={add} disabled={grid.buses.length >= 10}>Add bus</Button>
      {grid.buses.length >= 10 && <span className="ml-2 text-xs text-slate-600">Maximum of 10 buses.</span>}
    </div>
  );
}

export function LineTable({ grid, setGrid }) {
  const update = (id, patch) => setGrid((g) => ({ ...g, lines: g.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const add = () => setGrid((g) => {
    const id = nextId(g.lines, 'L');
    const [a, b] = [g.buses[0]?.id || '', g.buses[1]?.id || g.buses[0]?.id || ''];
    return { ...g, lines: [...g.lines, { id, from_bus: a, to_bus: b, reactance: 0.2, capacity: 1 }] };
  });
  const remove = (id) => {
    if (window.confirm(`Delete line ${id}?`)) setGrid((g) => ({ ...g, lines: g.lines.filter((l) => l.id !== id) }));
  };
  const select = (l, key, label) => (
    <select className={inputClass} value={l[key]} aria-label={`${label} of ${l.id}`} onChange={(e) => update(l.id, { [key]: e.target.value })}>
      {grid.buses.map((b) => <option key={b.id} value={b.id}>{b.id}</option>)}
    </select>
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <caption className="sr-only">Lines</caption>
        <thead>
          <tr className="border-b border-grid-200 text-left">
            <th scope="col" className="px-1 py-2">ID</th>
            <th scope="col" className="px-1 py-2">From bus</th>
            <th scope="col" className="px-1 py-2">To bus</th>
            <th scope="col" className="px-1 py-2">Reactance x (p.u.)</th>
            <th scope="col" className="px-1 py-2">Capacity (p.u.)</th>
            <th scope="col" className="px-1 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {grid.lines.map((l) => (
            <tr key={l.id} className="border-b border-grid-100">
              <td className="px-1 py-1.5 font-semibold">{l.id}</td>
              <td className="px-1 py-1.5">{select(l, 'from_bus', 'From bus')}</td>
              <td className="px-1 py-1.5">{select(l, 'to_bus', 'To bus')}</td>
              <td className="px-1 py-1.5"><input className={inputClass} type="number" step="any" min="0" value={l.reactance} aria-label={`Reactance of ${l.id}`} onChange={(e) => update(l.id, { reactance: e.target.value })} /></td>
              <td className="px-1 py-1.5"><input className={inputClass} type="number" step="any" min="0" value={l.capacity} aria-label={`Capacity of ${l.id}`} onChange={(e) => update(l.id, { capacity: e.target.value })} /></td>
              <td className="px-1 py-1.5"><Button variant="danger" onClick={() => remove(l.id)} aria-label={`Delete line ${l.id}`}>Delete</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button className="mt-3" onClick={add} disabled={grid.buses.length < 2}>Add line</Button>
    </div>
  );
}
