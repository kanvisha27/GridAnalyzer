import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BaseResults, ContingencyResults } from '../components/AnalysisPanels.jsx';
import { Badge, Button, Card, EmptyState, ErrorBox, Spinner } from '../components/UI.jsx';
import { useGrid } from '../context/GridContext.jsx';
import { deleteResult, listResults } from '../services/storage.js';
import { fmt } from '../services/validation.js';

export default function History() {
  const { loadGrid, dirty } = useGrid();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const refresh = useCallback(async () => {
    setError('');
    try { setRows(await listResults()); } catch (e) { setError(`Could not load saved results: ${e.message}`); setRows([]); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const remove = async (r) => {
    if (!window.confirm('Delete this saved result?')) return;
    try { await deleteResult(r.id); if (openId === r.id) setOpenId(null); await refresh(); } catch (e) { setError(e.message); }
  };

  const restore = (r) => {
    if (dirty && !window.confirm('You have unsaved changes. Discard them and load this snapshot?')) return;
    const g = JSON.parse(r.gridSnapshot);
    loadGrid({ ...g, id: r.gridId || undefined });
    navigate('/editor');
  };

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Saved results</h1>
        <p className="text-sm text-slate-600">Snapshots of earlier base-case and outage analyses, newest first.</p>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {rows === null ? <Spinner label="Loading saved results..." /> : rows.length === 0 ? (
        <EmptyState title="No saved results yet">Run a base case or outage on the Analysis page, then click "Save result".</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const open = openId === r.id;
            const payload = open ? JSON.parse(r.payload) : null;
            const snapshot = open ? JSON.parse(r.gridSnapshot) : null;
            const sm = r.summary;
            return (
              <li key={r.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <p className="font-semibold">
                        {r.gridName} <Badge status={r.type === 'contingency' ? 'warning' : 'info'}>{r.type === 'contingency' ? `Outage of ${r.outageLineId}` : 'Base case'}</Badge>
                      </p>
                      <p className="text-slate-600">
                        {r.scenarioName} - saved {new Date(r.createdAt).toLocaleString()} -{' '}
                        {r.type === 'contingency'
                          ? (sm.islanded ? 'network split into islands' : `${sm.overloads_after} overload(s) after outage`)
                          : `${sm.overload_count} overload(s), max loading ${fmt(sm.max_loading_pct, 1)}%`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => setOpenId(open ? null : r.id)} aria-expanded={open}>{open ? 'Hide' : 'View'}</Button>
                      <Button onClick={() => restore(r)}>Restore grid</Button>
                      <Button variant="danger" onClick={() => remove(r)}>Delete</Button>
                    </div>
                  </div>
                  {open && (
                    <div className="mt-4 border-t border-grid-100 pt-4">
                      {r.type === 'contingency'
                        ? <ContingencyResults data={payload} grid={snapshot} />
                        : <BaseResults result={payload} grid={snapshot} />}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
