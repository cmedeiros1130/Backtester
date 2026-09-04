import React, {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X, ChevronDown, Info, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { DASH } from '@/lib/format';

// ===========================================================================
// Buttons
// ===========================================================================
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'xs' | 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
};

const BTN_VARIANT: Record<string, string> = {
  primary: 'bg-accent text-white hover:bg-[#5f9aff] border border-[#3f78dc] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]',
  secondary: 'bg-ink-700 text-fg hover:bg-ink-600 border border-ink-600',
  outline: 'bg-transparent text-fg-muted hover:text-fg hover:bg-ink-800 border border-ink-600',
  ghost: 'bg-transparent text-fg-muted hover:text-fg hover:bg-ink-800 border border-transparent',
  danger: 'bg-[#3a1d21] text-[#f0575f] hover:bg-[#4a2429] border border-[#5c2b30]',
};

const BTN_SIZE: Record<string, string> = {
  xs: 'h-6 px-2 text-[11px] gap-1 rounded-md',
  sm: 'h-7.5 px-3 text-[12px] gap-1.5 rounded-md',
  md: 'h-9 px-4 text-[13px] gap-2 rounded-lg',
};

export function Button({
  variant = 'secondary', size = 'sm', loading, icon, className, children, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium transition-colors select-none',
        'disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap',
        BTN_VARIANT[variant], BTN_SIZE[size], className
      )}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label, className, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className={clsx(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-faint',
        'hover:bg-ink-700 hover:text-fg transition-colors disabled:opacity-40', className
      )}
    />
  );
}

// ===========================================================================
// Surfaces
// ===========================================================================
export function Card({
  title, subtitle, actions, className, bodyClass, children, dense,
}: {
  title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode;
  className?: string; bodyClass?: string; children?: React.ReactNode; dense?: boolean;
}) {
  return (
    <section className={clsx('panel flex flex-col overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-ink-700/70 px-4 py-2.5">
          <div className="min-w-0">
            {title && <h3 className="text-[12px] font-semibold tracking-wide text-fg">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-fg-faint">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={clsx(dense ? 'p-0' : 'p-4', 'min-h-0 flex-1', bodyClass)}>{children}</div>
    </section>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('label-xs mb-2', className)}>{children}</div>;
}

export function EmptyState({
  icon, title, hint, action,
}: { icon?: React.ReactNode; title: string; hint?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon && <div className="text-ink-500">{icon}</div>}
      <p className="text-[13px] font-medium text-fg-muted">{title}</p>
      {hint && <p className="max-w-md text-[11.5px] leading-relaxed text-fg-faint">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ===========================================================================
// Badges
// ===========================================================================
const BADGE_TONE: Record<string, string> = {
  neutral: 'bg-ink-700 text-fg-muted border-ink-600',
  accent: 'bg-accent-soft text-[#8fb8ff] border-[#25406e]',
  good: 'bg-[#10281f] text-[#4dd39b] border-[#1d4534]',
  warn: 'bg-[#2d2410] text-[#f5be5a] border-[#4a3a16]',
  bad: 'bg-[#2e1518] text-[#f5787f] border-[#4d2429]',
  muted: 'bg-transparent text-fg-faint border-ink-700',
};

export function Badge({
  tone = 'neutral', children, className, title,
}: { tone?: keyof typeof BADGE_TONE; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        BADGE_TONE[tone], className
      )}
    >
      {children}
    </span>
  );
}


// ===========================================================================
// Form controls
// ===========================================================================
export function Field({
  label, hint, required, children, className, htmlFor, aside,
}: {
  label?: React.ReactNode; hint?: React.ReactNode; required?: boolean;
  children: React.ReactNode; className?: string; htmlFor?: string; aside?: React.ReactNode;
}) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={htmlFor} className="label-xs">
            {label}
            {required && <span className="ml-0.5 text-[#f0575f]">*</span>}
          </label>
          {aside}
        </div>
      )}
      {children}
      {hint && <p className="text-[10.5px] leading-snug text-fg-faint">{hint}</p>}
    </div>
  );
}

const INPUT_BASE =
  'w-full rounded-md border border-ink-600 bg-ink-900/80 px-2.5 py-1.5 text-[12.5px] text-fg ' +
  'transition-colors hover:border-ink-500 focus:border-accent focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} {...rest} className={clsx(INPUT_BASE, 'tnum', className)} />
  )
);
Input.displayName = 'Input';

export function Textarea({
  className, rows = 3, ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} {...rest} className={clsx(INPUT_BASE, 'resize-y leading-relaxed', className)} />;
}

export function Select({
  options, className, placeholder, ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={clsx(INPUT_BASE, 'appearance-none pr-7', className)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-fg-faint" />
    </div>
  );
}


export function Segmented<T extends string>({
  value, onChange, options, size = 'sm', className,
}: {
  value: T | null; onChange: (v: T) => void;
  options: { value: T; label: string }[]; size?: 'xs' | 'sm'; className?: string;
}) {
  return (
    <div className={clsx('inline-flex rounded-md border border-ink-600 bg-ink-900/80 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded font-medium transition-colors',
            size === 'xs' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-[11.5px]',
            value === o.value ? 'bg-ink-600 text-fg shadow-sm' : 'text-fg-faint hover:text-fg-muted'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}



// ===========================================================================
// Score display
// ===========================================================================


// ===========================================================================
// Tabs
// ===========================================================================

// ===========================================================================
// Modal
// ===========================================================================
export function Modal({
  open, onClose, title, subtitle, children, footer, width = 'md',
}: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode;
  children: React.ReactNode; footer?: React.ReactNode; width?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-[2px] sm:p-8">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className={clsx('animate-in-soft panel relative z-10 my-auto w-full shadow-2xl', widths[width])}>
        <header className="flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11.5px] text-fg-faint">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}><X size={15} /></IconButton>
        </header>
        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-ink-700 bg-ink-900/40 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmButton({
  onConfirm, children, confirmLabel = 'Confirm?', ...rest
}: ButtonProps & { onConfirm: () => void; confirmLabel?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      {...rest}
      variant={armed ? 'danger' : rest.variant ?? 'ghost'}
      onClick={() => { if (armed) { onConfirm(); setArmed(false); } else setArmed(true); }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}

// ===========================================================================
// Tooltip
// ===========================================================================
export function Tooltip({
  content, children, side = 'top',
}: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      aria-describedby={show ? id : undefined}
    >
      {children}
      {show && (
        <span
          id={id}
          role="tooltip"
          className={clsx(
            'pointer-events-none absolute left-1/2 z-50 w-max max-w-xs -translate-x-1/2 rounded-md border border-ink-600',
            'bg-ink-850 px-2.5 py-1.5 text-[11px] font-normal leading-relaxed text-fg-muted shadow-xl',
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

// ===========================================================================
// Toasts
// ===========================================================================
type Toast = { id: number; kind: 'info' | 'good' | 'bad'; message: string };
const ToastCtx = createContext<(kind: Toast['kind'], message: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={clsx(
                'animate-in-soft pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[12px] shadow-xl backdrop-blur',
                t.kind === 'good' ? 'border-[#1d4534] bg-[#0f2019]/95 text-[#8fe0bb]'
                  : t.kind === 'bad' ? 'border-[#4d2429] bg-[#221214]/95 text-[#f5989d]'
                  : 'border-ink-600 bg-ink-850/95 text-fg-muted'
              )}
            >
              {t.kind === 'good' ? <Check size={13} className="mt-0.5 shrink-0" />
                : t.kind === 'bad' ? <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                : <Info size={13} className="mt-0.5 shrink-0" />}
              <span className="leading-snug">{t.message}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}

// ===========================================================================
// Misc
// ===========================================================================
export function Spinner({ className }: { className?: string }) {
  return <Loader2 size={16} className={clsx('animate-spin text-fg-faint', className)} />;
}

export function LoadingPane({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-fg-faint">
      <Spinner /> {label}
    </div>
  );
}

/** Key/value row used throughout the read-only detail panes. */
export function KV({
  k, v, mono, className,
}: { k: React.ReactNode; v: React.ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={clsx('flex items-baseline justify-between gap-4 py-1', className)}>
      <span className="shrink-0 text-[11px] text-fg-faint">{k}</span>
      <span className={clsx('text-right text-[12px] text-fg', mono && 'tnum')}>{v}</span>
    </div>
  );
}

/** Long-form answer block: label above, prose below, dash when unanswered. */
export function Prose({ label, children }: { label: React.ReactNode; children?: React.ReactNode }) {
  const empty = children === null || children === undefined || children === '';
  return (
    <div>
      <SectionLabel className="mb-1">{label}</SectionLabel>
      <p className={clsx('whitespace-pre-wrap text-[12.5px] leading-relaxed',
        empty ? 'text-ink-500' : 'text-fg-muted')}>
        {empty ? DASH : children}
      </p>
    </div>
  );
}

/** Horizontal scroll container for dense tables. Body must never scroll sideways. */
export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('w-full overflow-x-auto', className)}>{children}</div>;
}

export const TH = ({ children, className, align = 'left' }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) => (
  <th className={clsx('label-xs whitespace-nowrap border-b border-ink-700 px-2.5 py-2 font-semibold',
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left', className)}>
    {children}
  </th>
);

export const TD = ({ children, className, align = 'left', mono }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center'; mono?: boolean }) => (
  <td className={clsx('border-b border-ink-800 px-2.5 py-1.5 text-[12px]',
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
    mono && 'tnum', className)}>
    {children}
  </td>
);

// ===========================================================================
// Tags
// ===========================================================================
/**
 * Free-text tag entry. Enter or comma commits a tag; backspace on an empty
 * field removes the last one.
 */
export function TagInput({
  value, onChange, placeholder = 'Add a tag…',
}: { value: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const tags = value ?? [];

  const commit = (raw: string) => {
    const t = raw.trim().replace(/,$/, '');
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...tags, t]);
    setDraft('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-ink-600 bg-ink-900/80 px-2 py-1.5
                    transition-colors focus-within:border-accent hover:border-ink-500">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-ink-700 px-1.5 py-0.5 text-[11px] text-fg-muted">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}
            className="text-fg-faint hover:text-[#f0575f]" aria-label={`Remove ${t}`}>
            <X size={9} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(draft); }
          if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => commit(draft)}
        placeholder={tags.length ? '' : placeholder}
        className="min-w-[6rem] flex-1 bg-transparent text-[12.5px] text-fg outline-none placeholder:text-[#4e586b]"
      />
    </div>
  );
}
