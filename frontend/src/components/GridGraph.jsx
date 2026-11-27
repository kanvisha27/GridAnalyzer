import { useMemo } from 'react';
import { Handle, MarkerType, Position, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { fmt } from '../services/validation.js';

const COLORS = { normal: '#34d399', warning: '#fbbf24', overloaded: '#fb7185', plain: '#22d3ee', out: '#64748b' };

function BusNode({ data }) {
  return (
    <div
      className={`rounded-md border-2 bg-white px-3 py-1.5 text-center shadow-[0_0_18px_rgba(34,211,238,0.14)] ${data.isRef ? 'border-cyan-300' : 'border-grid-200'}`}
      style={{ minWidth: 92 }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, left: '50%', top: '50%' }} isConnectable={false} />
      <p className="text-sm font-semibold leading-tight">{data.id}{data.isRef ? ' (ref)' : ''}</p>
      <p className="text-[11px] leading-tight text-slate-600">{data.name}</p>
      <p className="num text-[11px] leading-tight">G {fmt(data.generation, 2)} / D {fmt(data.demand, 2)}</p>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, left: '50%', top: '50%' }} isConnectable={false} />
    </div>
  );
}
const nodeTypes = { bus: BusNode };

/**
 * Network diagram. `results` (optional) is an array of {line_id, signed_flow, loading_pct, status}
 * and colours/labels the lines. `outageLineId` draws that line dashed and grey.
 */
export default function GridGraph({ grid, results, outageLineId, height = 380 }) {
  const { nodes, edges } = useMemo(() => {
    const n = grid.buses.length;
    const radius = Math.max(110, 34 * n);
    const nodes = grid.buses.map((b, i) => {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      return {
        id: b.id, type: 'bus', draggable: false,
        position: { x: radius * 1.5 * Math.cos(a), y: radius * Math.sin(a) },
        data: { id: b.id, name: b.name, generation: b.generation, demand: b.demand, isRef: b.id === grid.referenceBus },
      };
    });
    const byId = Object.fromEntries((results || []).map((r) => [r.line_id, r]));
    const edges = grid.lines
      .filter((l) => grid.buses.some((b) => b.id === l.from_bus) && grid.buses.some((b) => b.id === l.to_bus))
      .map((l) => {
        const r = byId[l.id];
        const out = l.id === outageLineId;
        const color = out ? COLORS.out : r ? COLORS[r.status] || COLORS.plain : COLORS.plain;
        const reverse = r && r.signed_flow < 0;
        const arrow = { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };
        let label = `${l.id}  x=${l.reactance}  cap ${l.capacity}`;
        if (out) label = `${l.id} OUT`;
        else if (r) label = `${l.id}  ${fmt(Math.abs(r.signed_flow), 3)}/${l.capacity} (${fmt(r.loading_pct, 0)}%)`;
        return {
          id: l.id, source: l.from_bus, target: l.to_bus, label,
          markerEnd: r && !reverse && !out ? arrow : undefined,
          markerStart: r && reverse && !out ? arrow : undefined,
          style: { stroke: color, strokeWidth: r ? 2 + Math.min(r.loading_pct, 120) / 40 : 2, strokeDasharray: out ? '6 5' : undefined },
          labelStyle: { fontSize: 11, fill: '#cfe4f5' },
          labelBgStyle: { fill: '#0d2036', fillOpacity: 0.96, stroke: 'rgba(103, 232, 249, 0.24)' },
          labelBgPadding: [4, 2], labelBgBorderRadius: 3,
        };
      });
    return { nodes, edges };
  }, [grid, results, outageLineId]);

  return (
    <div style={{ height }} className="rounded-md border border-grid-200 bg-grid-50" role="img"
      aria-label={`Network diagram with ${grid.buses.length} buses and ${grid.lines.length} lines`}>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        zoomOnScroll={false} preventScrolling={false} minZoom={0.3}
      />
    </div>
  );
}

export function GraphLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
      {[['normal', 'Below 80% of capacity'], ['warning', '80-100%'], ['overloaded', 'Above 100%'], ['out', 'Outaged line']].map(([k, t]) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5" style={{ background: COLORS[k], height: 3 }} />{t}
        </li>
      ))}
      <li>Arrow = direction of power flow. Blue border = reference bus.</li>
    </ul>
  );
}
