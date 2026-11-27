import GridGraph, { GraphLegend } from './GridGraph.jsx';
import MatrixTable, { VectorTable } from './MatrixTable.jsx';
import ResultsTable, { ComparisonTable } from './ResultsTable.jsx';
import { Badge, Card, Disclosure, ErrorBox, Notice, Stat } from './UI.jsx';
import { fmt } from '../services/validation.js';

/** Educational panels: matrices, vectors, angles, adjacency list. */
export function MatrixPanels({ result }) {
  const ids = result.bus_ids;
  const rest = result.non_reference_bus_ids;
  return (
    <div className="space-y-2">
      <Disclosure title={`1. Susceptance matrix B (${ids.length} x ${ids.length}), symmetric`}>
        <p className="mb-2 text-sm text-slate-700">Diagonal = sum of 1/x of lines at the bus. Off-diagonal = -1/x of the line joining two buses (0 if none). Every row sums to 0, which is why the full matrix is singular.</p>
        <MatrixTable matrix={result.b_matrix} rowLabels={ids} colLabels={ids} caption="B" />
      </Disclosure>
      <Disclosure title={`2. Net injection vector P (generation - demand)`}>
        <VectorTable values={result.injections} labels={ids} caption="P in per-unit. Entries add up to 0." />
      </Disclosure>
      <Disclosure title={`3. Reduced system: remove reference bus ${result.reference_bus}`}>
        <p className="mb-2 text-sm text-slate-700">Row and column of the reference bus are deleted from B, and its entry from P. The result is invertible when the network is connected.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <MatrixTable matrix={result.reduced_matrix} rowLabels={rest} colLabels={rest} caption="Reduced B" />
          <VectorTable values={result.reduced_injections} labels={rest} caption="Reduced P" />
        </div>
      </Disclosure>
      <Disclosure title="4. Reduced inverse (for study only)">
        <p className="mb-2 text-sm text-slate-700">Computed by Gauss-Jordan elimination. The angles below are NOT found by multiplying by this inverse: solving B x = P directly by Gaussian elimination with partial pivoting is faster and numerically safer than forming an inverse.</p>
        <MatrixTable matrix={result.reduced_inverse} rowLabels={rest} colLabels={rest} caption="Reduced B inverse" digits={4} />
      </Disclosure>
      <Disclosure title="5. Voltage angles">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Voltage angles</caption>
            <thead><tr className="border-b border-grid-200 text-left"><th scope="col" className="px-2 py-1">Bus</th><th scope="col" className="px-2 py-1">Name</th><th scope="col" className="px-2 py-1 text-right">Angle (rad)</th><th scope="col" className="px-2 py-1 text-right">Angle (deg)</th></tr></thead>
            <tbody>
              {result.angles.map((a) => (
                <tr key={a.bus_id} className="border-b border-grid-100">
                  <th scope="row" className="px-2 py-1 text-left">{a.bus_id}{a.is_reference && ' (reference)'}</th>
                  <td className="px-2 py-1">{a.name}</td>
                  <td className="num px-2 py-1 text-right">{fmt(a.angle_rad, 5)}</td>
                  <td className="num px-2 py-1 text-right">{fmt(a.angle_deg, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-600">Solver: {result.solver}. Largest residual |B x - P| = {result.residual.toExponential(2)}.</p>
      </Disclosure>
      <Disclosure title="6. Graph adjacency list">
        <ul className="space-y-1 font-mono text-xs">
          {Object.entries(result.adjacency).map(([bus, nbrs]) => <li key={bus}><span className="font-semibold">{bus}</span>: {nbrs.join(', ') || 'no lines'}</li>)}
        </ul>
        <p className="mt-2 text-xs text-slate-600">Connectivity was checked with breadth-first search before solving.</p>
      </Disclosure>
    </div>
  );
}

export function BaseResults({ result, grid }) {
  const s = result.summary;
  const top = result.lines[0];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total generation (p.u.)" value={fmt(s.total_generation, 3)} />
        <Stat label="Total demand (p.u.)" value={fmt(s.total_demand, 3)} />
        <Stat label="Overloaded lines" value={s.overload_count} tone={s.overload_count ? 'bad' : 'good'} />
        <Stat label="Most loaded line" value={top ? `${top.line_id} ${fmt(top.loading_pct, 1)}%` : '-'} />
      </div>
      <Notice tone={s.overload_count ? 'warn' : 'ok'}>
        {s.overload_count
          ? `${s.overload_count} line(s) exceed capacity. `
          : 'No line exceeds its capacity. '}
        {s.warning_count ? `${s.warning_count} more line(s) are within 20% of their limit. ` : ''}
        Reference bus: {result.reference_bus}.
      </Notice>
      <Card title="Line flows" subtitle="Sorted by loading percentage">
        <ResultsTable lines={result.lines} />
      </Card>
      <Card title="Network with flows">
        <div className="space-y-2"><GridGraph grid={grid} results={result.lines} /><GraphLegend /></div>
      </Card>
      <Card title="How the answer was calculated" subtitle="Open each step to see the numbers">
        <MatrixPanels result={result} />
      </Card>
    </div>
  );
}

export function ContingencyResults({ data, grid }) {
  const s = data.summary;
  if (data.islanded) {
    return (
      <div className="space-y-4">
        <ErrorBox title={`Outage of ${data.line_id} disconnects the network`}>
          <p>{data.message}</p>
          <p className="mt-1">No flows were calculated because the result would be misleading. Islands: {data.components.map((c) => `{${c.join(', ')}}`).join(' ')}</p>
        </ErrorBox>
        <Card title="Network after outage"><GridGraph grid={grid} outageLineId={data.line_id} /></Card>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Outaged line" value={`${data.line_id} (${data.outage_line.from_bus}-${data.outage_line.to_bus})`} />
        <Stat label="Overloads before" value={s.overloads_before} />
        <Stat label="Overloads after" value={s.overloads_after} tone={s.overloads_after ? 'bad' : 'good'} />
        <Stat label="Worst line after" value={`${s.worst_line} ${fmt(s.worst_loading_pct, 1)}%`} />
      </div>
      <Notice tone={s.new_overloads.length ? 'warn' : 'ok'}>{data.message}</Notice>
      <Card title="Before and after" subtitle="Sorted by loading after the outage. Only a temporary copy of the grid was changed.">
        <ComparisonTable rows={data.comparison} />
      </Card>
      <Card title="Network after outage">
        <div className="space-y-2"><GridGraph grid={grid} results={data.outage.lines} outageLineId={data.line_id} /><GraphLegend /></div>
      </Card>
      <Card title="Matrices after the outage" subtitle="B was rebuilt and re-reduced without the outaged line">
        <MatrixPanels result={data.outage} />
      </Card>
      <p className="text-xs text-slate-600"><Badge status="info">Tip</Badge> Compare the matrices with the base case: only the entries touching the outaged line's two buses change.</p>
    </div>
  );
}
