import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { storageMode } from '../services/storage.js';
import { useGrid } from '../context/GridContext.jsx';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/editor', label: 'Grid editor' },
  { to: '/analysis', label: 'Analysis' },
  { to: '/history', label: 'Saved results' },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { grid, dirty } = useGrid();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm font-medium border ${isActive ? 'border-cyan-400/30 bg-cyan-300/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.12)]' : 'border-transparent text-slate-300 hover:border-cyan-400/15 hover:bg-cyan-300/5'}`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">Skip to content</a>

      <header className="flex items-center justify-between bg-grid-900 px-4 py-3 text-white md:hidden">
        <span className="font-semibold">Grid Analyzer</span>
        <button
          type="button" aria-expanded={open} aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
          className="rounded border border-white/40 px-3 py-1 text-sm"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </header>
      {open && <div id="mobile-nav" className="bg-grid-900 px-3 pb-3 md:hidden">{nav}</div>}

      <aside className="hidden w-60 shrink-0 flex-col bg-grid-900 p-4 text-white md:flex">
        <p className="text-lg font-semibold">Grid Analyzer</p>
        <p className="mb-5 text-xs text-grid-200">DC power flow &amp; contingency</p>
        {nav}
        <div className="mt-auto space-y-1 border-t border-white/15 pt-3 text-xs text-grid-200">
          <p>Editing: <span className="font-semibold text-white">{grid.name}</span>{dirty && ' (unsaved)'}</p>
          <p>
            Storage:{' '}
            <span className="font-semibold text-white">{storageMode === 'firestore' ? 'Firebase Firestore' : 'Demo mode (this browser)'}</span>
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 md:p-6">
          <Outlet />
        </main>
        <footer className="border-t border-grid-200 bg-white px-4 py-3 text-xs text-slate-600">
          Educational DC power-flow approximation. Not a real operational power-grid control or safety system.
          Values are per-unit on one common system base.
        </footer>
      </div>
    </div>
  );
}
