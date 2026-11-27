import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { applyScenario, sampleGrid } from '../services/sampleData.js';

const GridContext = createContext(null);

/** Holds the grid being edited plus the most recent analysis results (shared by all pages). */
export function GridProvider({ children }) {
  const [grid, setGridState] = useState(sampleGrid());
  const [dirty, setDirty] = useState(false);
  const [scenario, setScenario] = useState(null);       // scenario selected for analysis (or null = base values)
  const [analysis, setAnalysis] = useState(null);       // { result, gridName, scenarioName, at }
  const [contingency, setContingency] = useState(null);

  const setGrid = useCallback((next, { markDirty = true } = {}) => {
    setGridState((prev) => (typeof next === 'function' ? next(prev) : next));
    setDirty(markDirty);
    setAnalysis(null);
    setContingency(null);
  }, []);

  const loadGrid = useCallback((g) => {
    setGridState(g);
    setDirty(false);
    setScenario(null);
    setAnalysis(null);
    setContingency(null);
  }, []);

  const effectiveGrid = useMemo(() => applyScenario(grid, scenario), [grid, scenario]);

  const value = {
    grid, setGrid, loadGrid, dirty, setDirty, scenario, setScenario, effectiveGrid,
    analysis, setAnalysis, contingency, setContingency,
  };
  return <GridContext.Provider value={value}>{children}</GridContext.Provider>;
}

export function useGrid() {
  const ctx = useContext(GridContext);
  if (!ctx) throw new Error('useGrid must be used inside <GridProvider>');
  return ctx;
}
