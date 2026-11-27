import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GridGraph from '../components/GridGraph.jsx';
import { Badge, Card, EmptyState, Notice, Spinner, Stat } from '../components/UI.jsx';
import { useGrid } from '../context/GridContext.jsx';
import { listResults, storageMode } from '../services/storage.js';
import { componentsOf, fmt, isBalanced, totals, validateGrid } from '../services/validation.js';

export default function Dashboard() {
  const { grid, dirty, analysis } = useGrid();
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    listResults().then((r) => alive && setRecent(r.slice(0, 4))).catch((e) => { if (alive) { setError(e.message); setRecent([]); } });
    return () => { alive = false; };
  }, []);

  const errors = validateGrid(grid);
  const t = totals(grid);
  const comps = errors.length ? [] : componentsOf(grid);
  const ready = errors.length === 0 && isBalanced(grid) && comps.length === 1;
  const s = analysis?.result.summary;

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-600">DC power-flow check of <strong>{grid.name}</strong>{dirty && ' (unsaved changes)'}.</p>
      </div>

      {storageMode === 'demo' && (
        <Notice tone="warn">
          Demo mode: Firebase is not configured, so grids and results are kept in this browser only. Add your Firebase settings to <code>frontend/.env</code> to use Firestore (see the README).
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Buses" value={grid.buses.length} />
        <Stat label="Lines" value={grid.lines.length} />
        <Stat label="Total generation (p.u.)" value={fmt(t.generation, 2)} />
        <Stat label="Total demand (p.u.)" value={fmt(t.demand, 2)} />
        <Stat label="Overloads (latest run)" value={s ? s.overload_count : '-'} tone={s ? (s.overload_count ? 'bad' : 'good') : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Grid status" action={<Badge status={ready ? 'normal' : 'overloaded'}>{ready ? 'Ready to analyse' : 'Needs attention'}</Badge>}>
          {ready ? (
            <p className="text-sm">Inputs are valid, generation matches demand and all buses are connected.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-red-800">
              {errors.map((e) => <li key={e}>{e}</li>)}
              {errors.length === 0 && !isBalanced(grid) && <li>Generation and demand differ by {fmt(t.imbalance, 4)} p.u.</li>}
              {comps.length > 1 && <li>The grid is split into {comps.length} islands.</li>}
            </ul>
          )}
          <div className="mt-3 flex gap-4 text-sm font-semibold text-grid-600">
            <Link to="/editor" className="underline">Edit grid</Link>
            <Link to="/analysis" className="underline">Run analysis</Link>
          </div>
        </Card>

        <Card title="Latest analysis">
          {analysis ? (
            <div className="space-y-1 text-sm">
              <p>Scenario: <strong>{analysis.scenarioName}</strong></p>
              <p>Most loaded line: <strong>{s.max_loading_line}</strong> at {fmt(s.max_loading_pct, 1)}% of capacity.</p>
              <p>{s.overload_count} overloaded, {s.warning_count} near limit.</p>
              <p className="text-xs text-slate-600">Run at {new Date(analysis.at).toLocaleTimeString()}</p>
            </div>
          ) : (
            <EmptyState title="No analysis in this session">Open the Analysis page and run the base case to see a summary here.</EmptyState>
          )}
        </Card>
      </div>

      <Card title="Network"><GridGraph grid={grid} results={analysis?.result.lines} height={340} /></Card>

      <Card title="Recent saved results" action={<Link className="text-sm font-semibold text-grid-600 underline" to="/history">View all</Link>}>
        {error && <p className="text-sm text-red-800">Could not load results: {error}</p>}
        {recent === null ? <Spinner /> : recent.length === 0 ? (
          <EmptyState title="Nothing saved yet">Run an analysis and click "Save result" to keep a snapshot.</EmptyState>
        ) : (
          <ul className="divide-y divide-grid-100 text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><strong>{r.gridName}</strong> - {r.type === 'contingency' ? `outage of ${r.outageLineId}` : 'base case'} ({r.scenarioName})</span>
                <span className="text-xs text-slate-600">{new Date(r.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
