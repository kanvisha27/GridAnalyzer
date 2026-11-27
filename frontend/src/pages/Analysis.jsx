import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BaseResults, ContingencyResults } from '../components/AnalysisPanels.jsx';
import { Button, Card, EmptyState, ErrorBox, Field, Notice, Spinner, inputClass } from '../components/UI.jsx';
import { useGrid } from '../context/GridContext.jsx';
import { API_BASE_URL, runAnalysis, runContingency } from '../services/api.js';
import { listScenarios, saveResult } from '../services/storage.js';
import { validateGrid } from '../services/validation.js';

export default function Analysis() {
  const { grid, effectiveGrid, scenario, setScenario, analysis, setAnalysis, contingency, setContingency } = useGrid();
  const [tab, setTab] = useState('base');
  const [scenarios, setScenarios] = useState([]);
  const [lineId, setLineId] = useState(grid.lines[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    if (grid.id) listScenarios(grid.id).then((s) => alive && setScenarios(s)).catch(() => alive && setScenarios([]));
    else setScenarios([]);
    return () => { alive = false; };
  }, [grid.id]);

  useEffect(() => {
    if (!grid.lines.some((l) => l.id === lineId)) setLineId(grid.lines[0]?.id || '');
  }, [grid.lines, lineId]);

  const problems = validateGrid(effectiveGrid);
  const scenarioName = scenario?.name || 'Base values';

  const run = async (kind) => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (kind === 'base') {
        const result = await runAnalysis(effectiveGrid);
        setAnalysis({ result, grid: effectiveGrid, gridName: grid.name, scenarioName, at: new Date().toISOString() });
      } else {
        const result = await runContingency(effectiveGrid, lineId);
        setContingency({ result, grid: effectiveGrid, lineId, gridName: grid.name, scenarioName, at: new Date().toISOString() });
      }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const save = async (kind) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const entry = kind === 'base' ? analysis : contingency;
      await saveResult({ grid: { ...entry.grid, id: grid.id, name: grid.name }, scenario, type: kind, result: entry.result, outageLineId: kind === 'contingency' ? entry.lineId : null });
      setMessage('Result saved. Find it under Saved results.');
    } catch (e) { setError(`Could not save the result: ${e.message}`); } finally { setBusy(false); }
  };

  if (!API_BASE_URL) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Analysis</h1>
        <Notice>Base-case and outage calculations will be available once the analysis API is connected.</Notice>
        <Link className="inline-block text-sm font-semibold text-grid-600 underline" to="/editor">Open grid editor</Link>
      </>
    );
  }

  const tabBtn = (id, label) => (
    <button type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      className={`rounded-md px-4 py-2 text-sm font-semibold ${tab === id ? 'border-cyan-300/35 bg-cyan-400/15 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.10)]' : 'border-grid-200 bg-white text-slate-300 hover:border-cyan-400/30 hover:bg-cyan-300/5'}`}>
      {label}
    </button>
  );

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Analysis</h1>
        <p className="text-sm text-slate-600">Grid: <strong>{grid.name}</strong>. The analysis runs on the Python API; nothing is stored until you click Save result.</p>
      </div>

      <Card title="Inputs">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem]">
            <Field label="Scenario" id="scenario-select" hint={grid.id ? undefined : 'Save the grid in the editor to use scenarios.'}>
              <select id="scenario-select" className={inputClass} value={scenario?.id || ''} onChange={(e) => setScenario(scenarios.find((s) => s.id === e.target.value) || null)}>
                <option value="">Base values</option>
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          {problems.length > 0 && <Link className="text-sm font-semibold text-grid-600 underline" to="/editor">Fix {problems.length} problem(s) in the editor</Link>}
        </div>
      </Card>

      <div role="tablist" aria-label="Analysis type" className="flex gap-2">
        {tabBtn('base', 'Base case')}
        {tabBtn('contingency', 'Line outage (contingency)')}
      </div>

      <ErrorBox title="Analysis could not run">{error}</ErrorBox>
      {message && <Notice tone="ok">{message}</Notice>}
      {busy && <Spinner label="Working..." />}

      {tab === 'base' ? (
        <div role="tabpanel" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => run('base')} disabled={busy || problems.length > 0}>Run base analysis</Button>
            <Button onClick={() => save('base')} disabled={busy || !analysis}>Save result</Button>
          </div>
          {analysis
            ? <BaseResults result={analysis.result} grid={analysis.grid} />
            : <EmptyState title="No base-case results yet">Click "Run base analysis" to build the matrices, solve for the angles and see every line's loading.</EmptyState>}
        </div>
      ) : (
        <div role="tabpanel" className="space-y-4">
          <Card title="Choose a line to remove">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[14rem]">
                <Field label="Line to take out of service" id="outage-line">
                  <select id="outage-line" className={inputClass} value={lineId} onChange={(e) => setLineId(e.target.value)}>
                    {grid.lines.map((l) => <option key={l.id} value={l.id}>{l.id}: {l.from_bus} to {l.to_bus}</option>)}
                  </select>
                </Field>
              </div>
              <Button variant="primary" onClick={() => run('contingency')} disabled={busy || problems.length > 0 || !lineId}>Simulate outage</Button>
              <Button onClick={() => save('contingency')} disabled={busy || !contingency}>Save result</Button>
            </div>
          </Card>
          {contingency
            ? <ContingencyResults data={contingency.result} grid={contingency.grid} />
            : <EmptyState title="No outage simulated yet">Pick a line and click "Simulate outage". The saved grid is not changed.</EmptyState>}
        </div>
      )}
    </>
  );
}
