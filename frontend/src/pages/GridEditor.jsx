import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGrid } from '../context/GridContext.jsx';
import { BusTable, LineTable } from '../components/EditorTables.jsx';
import GridGraph, { GraphLegend } from '../components/GridGraph.jsx';
import ScenarioPanel from '../components/ScenarioPanel.jsx';
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Notice, Spinner, inputClass } from '../components/UI.jsx';
import { deleteGrid, listGrids, saveGrid, storageMode } from '../services/storage.js';
import { emptyGrid, sampleGrid } from '../services/sampleData.js';
import { componentsOf, fmt, isBalanced, totals, validateGrid } from '../services/validation.js';

const fromDoc = (d) => ({ id: d.id, name: d.name, referenceBus: d.referenceBus, buses: d.buses, lines: d.lines });

export default function GridEditor() {
  const { grid, setGrid, loadGrid, dirty, scenario, setScenario } = useGrid();
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setSaved(await listGrids()); } catch (e) { setError(`Could not load saved grids: ${e.message}`); } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const errors = validateGrid(grid);
  const t = totals(grid);
  const balanced = isBalanced(grid);
  const comps = errors.length === 0 ? componentsOf(grid) : [];

  const guard = async (fn, okMsg) => {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); if (okMsg) setMessage(okMsg); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const confirmDiscard = () => !dirty || window.confirm('You have unsaved changes. Discard them?');

  const save = () => guard(async () => {
    const id = await saveGrid(grid);
    setGrid((g) => ({ ...g, id }), { markDirty: false });
    await refresh();
  }, 'Grid saved.');

  const duplicate = (g) => guard(async () => {
    const id = await saveGrid({ ...fromDoc(g), id: undefined, name: `${g.name} (copy)` });
    await refresh();
    return id;
  }, `Duplicated "${g.name}".`);

  const remove = (g) => {
    if (!window.confirm(`Delete "${g.name}" with its scenarios and saved results? This cannot be undone.`)) return;
    guard(async () => {
      await deleteGrid(g.id);
      if (grid.id === g.id) setGrid((cur) => ({ ...cur, id: undefined }), { markDirty: true });
      await refresh();
    }, `Deleted "${g.name}".`);
  };

  const balanceViaRef = () => {
    const ref = grid.buses.find((b) => b.id === grid.referenceBus);
    const target = Number(ref.generation) - t.imbalance;
    if (target < 0) { setError(`Cannot balance using bus ${ref.id}: its generation would become negative (${fmt(target, 3)}). Edit demand or generation manually.`); return; }
    setGrid((g) => ({ ...g, buses: g.buses.map((b) => (b.id === ref.id ? { ...b, generation: Number(target.toFixed(6)) } : b)) }));
    setMessage(`Set generation at ${ref.id} to ${fmt(target, 4)} so net injection is zero. Review and save if you want to keep it.`);
  };

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Grid editor</h1>
        <p className="text-sm text-slate-600">Build a network of 2 to 10 buses. All values are per-unit on one common base.</p>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {message && <Notice tone="ok">{message}</Notice>}

      <Card title="Current grid" action={<Badge status={dirty ? 'warning' : 'info'}>{dirty ? 'Unsaved changes' : grid.id ? 'Saved' : 'Not saved yet'}</Badge>}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Field label="Grid name" id="grid-name">
              <input id="grid-name" className={inputClass} value={grid.name} onChange={(e) => setGrid((g) => ({ ...g, name: e.target.value }))} />
            </Field>
          </div>
          <Button variant="primary" onClick={save} disabled={busy || !grid.name.trim() || errors.length > 0}>Save grid</Button>
          <Button onClick={() => confirmDiscard() && loadGrid(emptyGrid())}>New grid</Button>
          <Button onClick={() => confirmDiscard() && loadGrid(sampleGrid())}>Load sample network</Button>
          {grid.id && <Button onClick={() => duplicate(grid)} disabled={busy}>Duplicate</Button>}
        </div>
        {errors.length > 0 && <p className="mt-2 text-xs text-slate-600">Fix the problems below before saving.</p>}
      </Card>

      <Card title="Saved grids" subtitle={storageMode === 'firestore' ? 'Stored in Firebase Firestore' : 'Demo mode: stored in this browser only'}>
        {loading ? <Spinner label="Loading saved grids..." /> : saved.length === 0 ? (
          <EmptyState title="No saved grids yet">Load the sample network or build your own, then click "Save grid".</EmptyState>
        ) : (
          <ul className="divide-y divide-grid-100">
            {saved.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{g.name}</span>
                  <span className="ml-2 text-xs text-slate-600">{g.buses.length} buses, {g.lines.length} lines, updated {new Date(g.updatedAt).toLocaleString()}</span>
                  {grid.id === g.id && <span className="ml-2"><Badge>Open</Badge></span>}
                </span>
                <span className="flex gap-2">
                  <Button onClick={() => confirmDiscard() && loadGrid(fromDoc(g))}>Load</Button>
                  <Button onClick={() => duplicate(g)} disabled={busy}>Duplicate</Button>
                  <Button variant="danger" onClick={() => remove(g)} disabled={busy}>Delete</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Check before analysing">
        {errors.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-800">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        ) : (
          <ul className="space-y-1 text-sm">
            <li>Inputs are valid.</li>
            <li className={balanced ? '' : 'font-medium text-red-800'}>
              Total generation {fmt(t.generation, 3)} p.u., total demand {fmt(t.demand, 3)} p.u.
              {balanced ? ' Balanced.' : ` Out of balance by ${fmt(t.imbalance, 4)} p.u. The analysis will refuse to run.`}
            </li>
            <li className={comps.length > 1 ? 'font-medium text-red-800' : ''}>
              {comps.length > 1 ? `The network is split into ${comps.length} islands: ${comps.map((c) => `{${c.join(', ')}}`).join(' ')}` : 'All buses are connected.'}
            </li>
          </ul>
        )}
        {errors.length === 0 && !balanced && (
          <Button className="mt-3" onClick={balanceViaRef}>Set reference-bus generation to balance</Button>
        )}
        {errors.length === 0 && balanced && comps.length === 1 && (
          <Link to="/analysis" className="mt-3 inline-block text-sm font-semibold text-grid-600 underline">Go to analysis</Link>
        )}
      </Card>

      <Card title="Buses" subtitle="Net injection = generation - demand. Select exactly one reference bus (angle fixed at 0).">
        <BusTable grid={grid} setGrid={setGrid} />
      </Card>
      <Card title="Lines" subtitle="Reactance and capacity must both be greater than 0.">
        <LineTable grid={grid} setGrid={setGrid} />
      </Card>

      <Card title="Network diagram">
        <div className="space-y-2">
          <GridGraph grid={grid} />
          <GraphLegend />
        </div>
      </Card>

      <Card title="Demand and generation scenarios" subtitle="Saved with this grid and selectable on the Analysis page.">
        <ScenarioPanel grid={grid} scenario={scenario} onSelect={setScenario} />
      </Card>
    </>
  );
}
