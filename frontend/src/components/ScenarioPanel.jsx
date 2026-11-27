import { useCallback, useEffect, useState } from 'react';
import { Button, EmptyState, ErrorBox, Field, Spinner, inputClass } from './UI.jsx';
import { deleteScenario, listScenarios, saveScenario } from '../services/storage.js';
import { sampleScenario } from '../services/sampleData.js';

/** Demand/generation scenarios: named per-bus overrides of the grid's base values. */
export default function ScenarioPanel({ grid, scenario, onSelect }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null); // {id?, name, overrides}

  const refresh = useCallback(async () => {
    if (!grid.id) { setList([]); return; }
    setLoading(true); setError('');
    try { setList(await listScenarios(grid.id)); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [grid.id]);
  useEffect(() => { refresh(); }, [refresh]);

  const startNew = () => setDraft({
    name: 'New scenario',
    overrides: Object.fromEntries(grid.buses.map((b) => [b.id, { generation: Number(b.generation), demand: Number(b.demand) }])),
  });
  const startSample = () => {
    const s = sampleScenario();
    setDraft({ name: s.name, overrides: Object.fromEntries(grid.buses.map((b) => [b.id, s.overrides[b.id] || { generation: Number(b.generation), demand: Number(b.demand) }])) });
  };
  const setOv = (busId, key, value) => setDraft((d) => ({ ...d, overrides: { ...d.overrides, [busId]: { ...d.overrides[busId], [key]: value } } }));

  const save = async () => {
    setError('');
    const ov = {};
    for (const b of grid.buses) {
      const o = draft.overrides[b.id] || {};
      const g = Number(o.generation); const d = Number(o.demand);
      if (!Number.isFinite(g) || g < 0 || !Number.isFinite(d) || d < 0) { setError(`Bus ${b.id}: generation and demand must be numbers of 0 or more.`); return; }
      ov[b.id] = { generation: g, demand: d };
    }
    if (!draft.name.trim()) { setError('Give the scenario a name.'); return; }
    try {
      await saveScenario({ id: draft.id, gridId: grid.id, name: draft.name.trim(), overrides: ov });
      setDraft(null);
      await refresh();
    } catch (e) { setError(e.message); }
  };
  const remove = async (s) => {
    if (!window.confirm(`Delete scenario "${s.name}"?`)) return;
    try { await deleteScenario(s.id); if (scenario?.id === s.id) onSelect(null); await refresh(); } catch (e) { setError(e.message); }
  };

  if (!grid.id) return <EmptyState title="Save the grid first">Scenarios are stored against a saved grid. Click "Save grid" above, then add scenarios here.</EmptyState>;

  return (
    <div className="space-y-3">
      <ErrorBox>{error}</ErrorBox>
      {loading && <Spinner label="Loading scenarios..." />}
      {!loading && list.length === 0 && !draft && <EmptyState title="No scenarios yet">A scenario overrides generation and demand on some buses, for example an evening peak. The saved grid stays unchanged.</EmptyState>}
      <ul className="divide-y divide-grid-100">
        {list.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="font-medium">{s.name}</span>
            <span className="flex gap-2">
              <Button variant={scenario?.id === s.id ? 'primary' : 'secondary'} onClick={() => onSelect(scenario?.id === s.id ? null : s)}>
                {scenario?.id === s.id ? 'In use for analysis' : 'Use for analysis'}
              </Button>
              <Button onClick={() => setDraft({ ...s })}>Edit</Button>
              <Button variant="danger" onClick={() => remove(s)}>Delete</Button>
            </span>
          </li>
        ))}
      </ul>
      {draft ? (
        <div className="space-y-3 rounded-md border border-grid-200 bg-grid-50 p-3">
          <Field label="Scenario name" id="scenario-name">
            <input id="scenario-name" className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {grid.buses.map((b) => (
              <fieldset key={b.id} className="rounded border border-grid-200 bg-white p-2">
                <legend className="px-1 text-sm font-semibold">{b.id} {b.name}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Generation" id={`sg-${b.id}`}><input id={`sg-${b.id}`} className={inputClass} type="number" step="any" min="0" value={draft.overrides[b.id]?.generation ?? 0} onChange={(e) => setOv(b.id, 'generation', e.target.value)} /></Field>
                  <Field label="Demand" id={`sd-${b.id}`}><input id={`sd-${b.id}`} className={inputClass} type="number" step="any" min="0" value={draft.overrides[b.id]?.demand ?? 0} onChange={(e) => setOv(b.id, 'demand', e.target.value)} /></Field>
                </div>
              </fieldset>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={save}>Save scenario</Button>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={startNew}>New scenario</Button>
          {grid.buses.some((b) => b.id === 'B5') && <Button onClick={startSample}>New scenario from sample "Evening peak"</Button>}
        </div>
      )}
      <p className="text-xs text-slate-600">Scenarios must keep total generation equal to total demand; the analysis reports an error otherwise.</p>
    </div>
  );
}
