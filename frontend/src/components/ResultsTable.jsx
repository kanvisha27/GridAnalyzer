import { useState } from 'react';
import { Badge, LoadingBar } from './UI.jsx';
import { fmt } from '../services/validation.js';

/** Base-case line table. Rows arrive sorted by loading (descending) from the API. */
export default function ResultsTable({ lines }) {
  const [asc, setAsc] = useState(false);
  const rows = asc ? [...lines].reverse() : lines;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <caption className="sr-only">Line flows sorted by loading</caption>
        <thead>
          <tr className="border-b border-grid-200 text-left">
            <th scope="col" className="px-2 py-2">Line</th>
            <th scope="col" className="px-2 py-2">Direction</th>
            <th scope="col" className="px-2 py-2 text-right">Signed flow</th>
            <th scope="col" className="px-2 py-2 text-right">|Flow|</th>
            <th scope="col" className="px-2 py-2 text-right">Capacity</th>
            <th scope="col" className="px-2 py-2" aria-sort={asc ? 'ascending' : 'descending'}>
              <button type="button" onClick={() => setAsc((a) => !a)} className="font-semibold underline decoration-dotted">
                Loading {asc ? '(low to high)' : '(high to low)'}
              </button>
            </th>
            <th scope="col" className="px-2 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const hot = (asc ? lines.length - 1 - i : i) < 3 && r.loading_pct > 0;
            return (
              <tr key={r.line_id} className={`border-b border-grid-100 ${r.status === 'overloaded' ? 'bg-red-50' : hot ? 'bg-amber-50/50' : ''}`}>
                <th scope="row" className="px-2 py-2 text-left font-semibold">{r.line_id} <span className="font-normal text-slate-600">({r.from_bus}-{r.to_bus})</span></th>
                <td className="px-2 py-2">{r.direction}</td>
                <td className="num px-2 py-2 text-right">{fmt(r.signed_flow, 4)}</td>
                <td className="num px-2 py-2 text-right">{fmt(r.abs_flow, 4)}</td>
                <td className="num px-2 py-2 text-right">{fmt(r.capacity, 3)}</td>
                <td className="px-2 py-2"><LoadingBar pct={r.loading_pct} status={r.status} /></td>
                <td className="px-2 py-2"><Badge status={r.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-600">Tinted rows are the three most heavily loaded lines. Flow is in per-unit; a positive signed flow runs from the first to the second bus of the line.</p>
    </div>
  );
}

export function ComparisonTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <caption className="sr-only">Line flows before and after the outage, sorted by loading after the outage</caption>
        <thead>
          <tr className="border-b border-grid-200 text-left">
            <th scope="col" className="px-2 py-2">Line</th>
            <th scope="col" className="px-2 py-2 text-right">Flow before</th>
            <th scope="col" className="px-2 py-2">Loading before</th>
            <th scope="col" className="px-2 py-2 text-right">Flow after</th>
            <th scope="col" className="px-2 py-2">Loading after</th>
            <th scope="col" className="px-2 py-2 text-right">Change in |flow|</th>
            <th scope="col" className="px-2 py-2">Status after</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.line_id} className={`border-b border-grid-100 ${r.outage_status === 'overloaded' ? 'bg-red-50' : r.is_outaged ? 'bg-slate-100' : ''}`}>
              <th scope="row" className="px-2 py-2 text-left font-semibold">{r.line_id} <span className="font-normal text-slate-600">({r.from_bus}-{r.to_bus})</span></th>
              <td className="num px-2 py-2 text-right">{fmt(r.base_signed_flow, 4)}</td>
              <td className="px-2 py-2"><LoadingBar pct={r.base_loading_pct} status={r.base_status} /></td>
              <td className="num px-2 py-2 text-right">{r.is_outaged ? '-' : fmt(r.outage_signed_flow, 4)}</td>
              <td className="px-2 py-2">{r.is_outaged ? <span className="text-slate-600">removed</span> : <LoadingBar pct={r.outage_loading_pct} status={r.outage_status} />}</td>
              <td className={`num px-2 py-2 text-right ${r.delta_abs_flow > 1e-9 ? 'text-red-700' : r.delta_abs_flow < -1e-9 ? 'text-emerald-700' : ''}`}>
                {r.delta_abs_flow > 0 ? '+' : ''}{fmt(r.delta_abs_flow, 4)}
              </td>
              <td className="px-2 py-2"><Badge status={r.outage_status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
