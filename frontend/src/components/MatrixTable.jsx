import { fmt } from '../services/validation.js';

export default function MatrixTable({ matrix, rowLabels, colLabels, caption, digits = 3 }) {
  return (
    <div className="overflow-x-auto">
      <table className="num min-w-full border-collapse font-mono text-xs">
        <caption className="mb-1 text-left font-sans text-sm text-slate-700">{caption}</caption>
        <thead>
          <tr>
            <th className="p-1" />
            {colLabels.map((c) => <th key={c} scope="col" className="px-2 py-1 text-right font-semibold">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={rowLabels[i]} className="border-t border-grid-100">
              <th scope="row" className="px-2 py-1 text-left font-semibold">{rowLabels[i]}</th>
              {row.map((v, j) => (
                <td key={colLabels[j]} className={`px-2 py-1 text-right ${Math.abs(v) < 1e-12 ? 'text-slate-400' : ''}`}>
                  {fmt(v, digits)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VectorTable({ values, labels, caption, digits = 3 }) {
  return (
    <div className="overflow-x-auto">
      <table className="num border-collapse font-mono text-xs">
        <caption className="mb-1 text-left font-sans text-sm text-slate-700">{caption}</caption>
        <tbody>
          {values.map((v, i) => (
            <tr key={labels[i]} className="border-t border-grid-100">
              <th scope="row" className="px-2 py-1 text-left font-semibold">{labels[i]}</th>
              <td className="px-2 py-1 text-right">{fmt(v, digits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
