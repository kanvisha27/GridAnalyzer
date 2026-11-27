import axios from 'axios';

const localApi = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (localApi ? 'http://localhost:8000' : '');
const client = axios.create({ baseURL: `${API_BASE_URL}/api`, timeout: 20000 });

const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

/** Converts the editor's grid into the exact JSON the Python API expects. */
export function toPayload(grid) {
  return {
    buses: grid.buses.map((b) => ({ id: b.id, name: b.name || b.id, generation: num(b.generation), demand: num(b.demand) })),
    lines: grid.lines.map((l) => ({
      id: l.id, from_bus: l.from_bus, to_bus: l.to_bus, reactance: num(l.reactance), capacity: num(l.capacity),
    })),
    reference_bus: grid.referenceBus,
  };
}

function explain(err) {
  if (err.response?.data?.error) {
    const e = new Error(err.response.data.error.message);
    e.code = err.response.data.error.code;
    return e;
  }
  if (err.response) return new Error(`The API answered with status ${err.response.status}.`);
  return new Error(`Cannot reach the analysis API at ${API_BASE_URL}. Is the backend running (uvicorn main:app --reload)?`);
}

async function call(fn) {
  try {
    return (await fn()).data;
  } catch (err) {
    throw explain(err);
  }
}

export const checkHealth = () => call(() => client.get('/health'));
export const runAnalysis = (grid) => call(() => client.post('/analyze', toPayload(grid)));
export const runContingency = (grid, lineId) =>
  call(() => client.post('/contingency', { grid: toPayload(grid), line_id: lineId }));
