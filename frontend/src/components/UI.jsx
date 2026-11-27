import { fmt } from '../services/validation.js';

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-grid-200 bg-white ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-grid-100 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const variants = {
  primary: 'border border-cyan-300/40 bg-cyan-400 text-grid-900 shadow-[0_0_18px_rgba(34,211,238,0.16)] hover:bg-cyan-300 disabled:border-grid-200 disabled:bg-slate-700 disabled:text-slate-400',
  secondary: 'border border-grid-200 bg-white text-cyan-100 hover:border-cyan-400/40 hover:bg-cyan-300/5 disabled:text-slate-400',
  danger: 'border border-red-400/30 bg-red-400/5 text-red-300 hover:border-red-400/50 hover:bg-red-400/10 disabled:text-slate-400',
};

export function Button({ variant = 'secondary', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

const badgeStyles = {
  normal: 'border border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  warning: 'border border-amber-400/25 bg-amber-400/10 text-amber-300',
  overloaded: 'border border-red-400/25 bg-red-400/10 text-red-300',
  out: 'border border-slate-400/25 bg-slate-400/10 text-slate-300',
  info: 'border border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
};
const badgeText = { normal: 'Normal', warning: 'Near limit', overloaded: 'Overloaded', out: 'Out of service' };

export function Badge({ status = 'info', children }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${badgeStyles[status] || badgeStyles.info}`}>
      {children || badgeText[status] || status}
    </span>
  );
}

export function Field({ label, id, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-md border border-grid-200 bg-grid-50 px-2 py-1.5 text-sm num focus:border-cyan-400';

export function Spinner({ label = 'Loading...' }) {
  return (
    <div role="status" className="flex items-center gap-2 py-6 text-sm text-slate-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-grid-200 border-t-grid-600" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-lg border border-dashed border-cyan-400/20 bg-grid-50 px-4 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorBox({ title = 'Something went wrong', children }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      <p className="font-semibold">{title}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

export function Notice({ tone = 'info', children }) {
  const tones = {
    info: 'border-cyan-400/20 bg-cyan-400/5 text-cyan-100',
    warn: 'border-amber-400/25 bg-amber-400/8 text-amber-200',
    ok: 'border-emerald-400/25 bg-emerald-400/8 text-emerald-200',
  };
  return <div className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>;
}

export function Stat({ label, value, tone }) {
  const color = tone === 'bad' ? 'text-red-300' : tone === 'good' ? 'text-emerald-300' : 'text-cyan-100';
  return (
    <div className="rounded-lg border border-grid-200 bg-white px-4 py-3">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`num text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export function Disclosure({ title, children, defaultOpen = false }) {
  return (
    <details open={defaultOpen} className="group rounded-md border border-grid-200 bg-white">
      <summary className="cursor-pointer select-none rounded-md px-3 py-2 text-sm font-semibold hover:bg-grid-50">
        {title}
      </summary>
      <div className="border-t border-grid-100 p-3">{children}</div>
    </details>
  );
}

export function LoadingBar({ pct, status }) {
  const color = status === 'overloaded' ? 'bg-red-600' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-600';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded bg-slate-200" aria-hidden="true">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="num w-14 text-right">{fmt(pct, 1)}%</span>
    </div>
  );
}
