/**
 * Persistence layer. Uses Firebase Firestore (with anonymous auth) when VITE_FIREBASE_* are set,
 * otherwise "demo mode": the same API backed by this browser's localStorage.
 * Collections: grids, demandscenarios, analysisresults.
 */
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db, ensureUid, isFirebaseConfigured } from './firebase.js';

export const storageMode = isFirebaseConfigured ? 'firestore' : 'demo';
export const COL = { grids: 'grids', scenarios: 'demandscenarios', results: 'analysisresults' };

const clean = (obj) => JSON.parse(JSON.stringify(obj)); // drops undefined, which Firestore rejects
const now = () => new Date().toISOString();
const byNewest = (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt));

// ---------------------------------------------------------------- demo mode
const lsKey = (col) => `gridanalyzer:${col}`;
const lsRead = (col) => {
  try { return JSON.parse(localStorage.getItem(lsKey(col)) || '[]'); } catch { return []; }
};
const lsWrite = (col, rows) => localStorage.setItem(lsKey(col), JSON.stringify(rows));
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const demo = {
  async list(col) { return lsRead(col).sort(byNewest); },
  async create(col, data) {
    const id = newId();
    lsWrite(col, [...lsRead(col), { ...clean(data), id, createdAt: now(), updatedAt: now() }]);
    return id;
  },
  async update(col, id, data) {
    lsWrite(col, lsRead(col).map((r) => (r.id === id ? { ...r, ...clean(data), updatedAt: now() } : r)));
    return id;
  },
  async remove(col, id) { lsWrite(col, lsRead(col).filter((r) => r.id !== id)); },
};

// ---------------------------------------------------------------- Firestore
const remote = {
  async list(col) {
    const uid = await ensureUid();
    const snap = await getDocs(query(collection(db, col), where('ownerId', '==', uid)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);
  },
  async create(col, data) {
    const uid = await ensureUid();
    const ref = await addDoc(collection(db, col), { ...clean(data), ownerId: uid, createdAt: now(), updatedAt: now() });
    return ref.id;
  },
  async update(col, id, data) {
    await ensureUid();
    await updateDoc(doc(db, col, id), { ...clean(data), updatedAt: now() });
    return id;
  },
  async remove(col, id) {
    await ensureUid();
    await deleteDoc(doc(db, col, id));
  },
};

const backend = isFirebaseConfigured ? remote : demo;

// ------------------------------------------------------------------- grids
const gridDoc = (g) => ({
  name: g.name, referenceBus: g.referenceBus,
  buses: g.buses.map((b) => ({ id: b.id, name: b.name || '', generation: Number(b.generation), demand: Number(b.demand) })),
  lines: g.lines.map((l) => ({
    id: l.id, from_bus: l.from_bus, to_bus: l.to_bus, reactance: Number(l.reactance), capacity: Number(l.capacity),
  })),
});

export const listGrids = () => backend.list(COL.grids);
export const saveGrid = (grid) => (grid.id ? backend.update(COL.grids, grid.id, gridDoc(grid)) : backend.create(COL.grids, gridDoc(grid)));

export async function deleteGrid(id) {
  const [scenarios, results] = await Promise.all([listScenarios(id), listResults(id)]);
  await Promise.all([
    ...scenarios.map((s) => backend.remove(COL.scenarios, s.id)),
    ...results.map((r) => backend.remove(COL.results, r.id)),
  ]);
  await backend.remove(COL.grids, id);
}

// --------------------------------------------------------------- scenarios
export async function listScenarios(gridId) {
  return (await backend.list(COL.scenarios)).filter((s) => s.gridId === gridId);
}
export const saveScenario = (s) => {
  const data = { gridId: s.gridId, name: s.name, overrides: s.overrides };
  return s.id ? backend.update(COL.scenarios, s.id, data) : backend.create(COL.scenarios, data);
};
export const deleteScenario = (id) => backend.remove(COL.scenarios, id);

// ----------------------------------------------------------------- results
/** Firestore forbids nested arrays, so full matrices/grids are stored as JSON strings in `payload` / `gridSnapshot`. */
export async function listResults(gridId) {
  const all = await backend.list(COL.results);
  return gridId ? all.filter((r) => r.gridId === gridId) : all;
}

export function saveResult({ grid, scenario, type, result, outageLineId }) {
  const analysis = type === 'contingency' ? result.base : result;
  const doc_ = {
    gridId: grid.id || null,
    gridName: grid.name,
    type,
    scenarioId: scenario?.id || null,
    scenarioName: scenario?.name || 'Base values',
    outageLineId: outageLineId || null,
    summary: type === 'contingency'
      ? { ...result.summary, islanded: result.islanded, message: result.message }
      : result.summary,
    lineFlows: (type === 'contingency' ? result.comparison : analysis.lines).map((r) => ({ ...r })),
    payload: JSON.stringify(result),
    gridSnapshot: JSON.stringify(gridDoc(grid)),
  };
  return backend.create(COL.results, doc_);
}
export const deleteResult = (id) => backend.remove(COL.results, id);
