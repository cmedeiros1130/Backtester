import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  Home, CalendarCheck, FolderOpen, Images, Archive, Settings as SettingsIcon, Search,
} from 'lucide-react';

/**
 * Four sections and a search box. That is the whole application.
 */
const SECTIONS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/predict', label: 'Daily Prediction', icon: CalendarCheck },
  { to: '/library', label: 'Level Library', icon: FolderOpen },
  { to: '/examples', label: 'Market Examples', icon: Images },
  { to: '/archive', label: 'Backtest Archive', icon: Archive },
];

function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd-K from anywhere, because search is how you find anything here.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="relative px-2.5 pb-2"
    >
      <Search size={13} className="pointer-events-none absolute left-5 top-1/2 -translate-y-[60%] text-fg-faint" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search everything…"
        className="w-full rounded-md border border-ink-700 bg-ink-850 py-1.5 pl-7 pr-8 text-[12px] text-fg
                   transition-colors placeholder:text-ink-500 hover:border-ink-600 focus:border-accent focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-5 top-1/2 -translate-y-[60%] rounded border border-ink-600
                      px-1 text-[9px] text-ink-500">
        ⌘K
      </kbd>
    </form>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-[210px] shrink-0 flex-col border-r border-ink-700 bg-ink-900">
        <NavLink to="/" className="flex items-center gap-2.5 border-b border-ink-700 px-4 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-accent to-[#2a5fc4] text-[13px] font-bold text-white">
            L
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-tight tracking-tight">LevelForge</div>
            <div className="text-[9.5px] uppercase tracking-[0.13em] text-fg-faint">Research Library</div>
          </div>
        </NavLink>

        <div className="pt-2.5"><GlobalSearch /></div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-1">
          {SECTIONS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'block rounded-md px-2.5 py-[7px] text-[12.5px] font-medium transition-colors',
                  isActive
                    ? 'bg-accent-soft text-[#a7c6ff] shadow-[inset_2px_0_0_0_var(--color-accent)]'
                    : 'text-fg-muted hover:bg-ink-800 hover:text-fg'
                )
              }
            >
              <span className="flex items-center gap-2.5">
                <Icon size={15} className="shrink-0" />
                <span className="truncate">{label}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink-700 p-2.5">
          <NavLink
            to="/settings"
            className={({ isActive }) => clsx(
              'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors',
              isActive ? 'bg-ink-800 text-fg' : 'text-fg-faint hover:bg-ink-800 hover:text-fg-muted'
            )}
          >
            <SettingsIcon size={14} /> Settings
          </NavLink>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-ink-950">{children}</main>
    </div>
  );
}

export function PageHeader({
  title, subtitle, actions, back, children,
}: {
  title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode;
  back?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-ink-700 bg-ink-900/60 px-6 py-4">
      {back && <div className="mb-2">{back}</div>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold leading-tight tracking-tight text-fg">{title}</h1>
          {subtitle && <p className="mt-1 text-[12px] leading-relaxed text-fg-faint">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('px-6 py-5', className)}>{children}</div>;
}
