// =====================================================================
// 🧩 Small shared building blocks (buttons, inputs, popups, messages)
// so every screen looks and behaves the same.
// =====================================================================
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { cx } from '../lib/format';

// ---------- Buttons ----------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30',
  secondary: 'bg-white text-purple-700 border border-purple-200 hover:border-purple-300 hover:bg-purple-50',
  ghost: 'text-ink/70 hover:text-ink hover:bg-ink/5',
  danger: 'bg-danger text-white hover:bg-[#b93a3a]',
  dark: 'bg-slate-900 text-white hover:bg-slate-800',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        size === 'sm' ? 'h-8 px-3 text-xs' : size === 'lg' ? 'h-12 px-5 text-base' : 'h-10 px-4 text-sm',
        BTN[variant],
        className
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---------- Form fields ----------
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold text-ink/80">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-ink/50">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputCls =
  'h-10 w-full rounded-xl border border-foil bg-white px-3 text-sm text-ink placeholder:text-ink/35 outline-none transition focus:border-green focus:ring-4 focus:ring-green/15 disabled:bg-paper disabled:text-ink/50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => <input ref={ref} {...rest} className={cx(inputCls, className)} />
);
Input.displayName = 'Input';

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(inputCls, 'cursor-pointer pr-8', className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputCls, 'h-auto min-h-20 py-2', className)} />;
}

// ---------- Badges ----------
const BADGE = {
  green: 'bg-mint text-green-dark ring-green/20',
  amber: 'bg-amber/12 text-[#8a5f00] ring-amber/30',
  red: 'bg-danger/10 text-danger ring-danger/25',
  grey: 'bg-ink/5 text-ink/70 ring-ink/10',
  ink: 'bg-ink text-white ring-ink',
};
export function Badge({ tone = 'grey', children, className }: { tone?: keyof typeof BADGE; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', BADGE[tone], className)}>
      {children}
    </span>
  );
}

// ---------- Cards / headers ----------
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('rounded-2xl border border-foil/70 bg-white shadow-[0_1px_2px_rgba(11,42,46,.04)]', className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink/50" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-green" /> {label}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-green">{icon}</div>}
      <p className="font-display text-base font-bold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink/55">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// ---------- Popup (modal) ----------
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-lg',
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  busy?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Keep the latest onClose / busy without re-running the effect on every screen update.
  // (Before, the cursor jumped back to the first box while typing in the second box.)
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busyRef.current && closeRef.current();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first box only once, when the window opens
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>('input,select,textarea,button[data-autofocus]')?.focus(), 30);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
      <div
        ref={panel}
        className={cx('relative flex max-h-[92vh] w-full animate-scale-in flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl', width)}
      >
        <div className="flex items-start justify-between gap-3 border-b border-foil/60 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink/55">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="-mr-1 cursor-pointer rounded-lg p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-foil/60 bg-paper/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// ---------- Toast messages ----------
type Toast = { id: number; text: string; tone: 'success' | 'error' | 'info' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 5000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-5" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cx(
                'pointer-events-auto flex max-w-sm animate-slide-up items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg',
                t.tone === 'success' ? 'bg-ink text-white' : t.tone === 'error' ? 'bg-danger text-white' : 'bg-white text-ink ring-1 ring-foil'
              )}
            >
              {t.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-glow" /> : t.tone === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-green" />}
              <span>{t.text}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}

// ---------- "Are you sure?" ----------
export function Confirm({
  open,
  title,
  text,
  confirmLabel,
  tone = 'danger',
  busy,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      busy={busy}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Go back
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {text && <p className="text-sm text-ink/70">{text}</p>}
      {children}
    </Modal>
  );
}

// ---------- Stat tile ----------
export function Stat({
  label,
  value,
  note,
  icon,
  tone = 'green',
  onClick,
}: {
  label: string;
  value: string;
  note?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'green' | 'amber' | 'red' | 'ink';
  onClick?: () => void;
}) {
  const ring = { green: 'bg-mint text-green', amber: 'bg-amber/12 text-[#9a6a00]', red: 'bg-danger/10 text-danger', ink: 'bg-ink text-glow' }[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cx(
        'group rounded-2xl border border-foil/70 bg-white p-4 text-left shadow-[0_1px_2px_rgba(11,42,46,.04)]',
        onClick && 'cursor-pointer transition hover:-translate-y-0.5 hover:border-green/40 hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-ink/55">{label}</p>
        {icon && <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl', ring)}>{icon}</span>}
      </div>
      <p className="mt-1.5 break-words font-display text-xl font-bold tracking-tight text-ink tabular sm:text-2xl">{value}</p>
      {note && <div className="mt-1 text-xs text-ink/55">{note}</div>}
    </Tag>
  );
}

// ---------- Segmented choice (chips) ----------
export function Chips<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('inline-flex flex-wrap gap-1 rounded-xl bg-ink/5 p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            value === o.value ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink'
          )}
        >
          {o.label}
          {o.count !== undefined && <span className={cx('ml-1.5 tabular', value === o.value ? 'text-green' : 'text-ink/40')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Brand mark: your logo (public/logo.png). Until it is added, a purple pharmacy cross is shown. */
export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!broken) {
    return <img src="/logo.png" alt="Argya Health" className={`${className} rounded-xl bg-white object-contain`} onError={() => setBroken(true)} />;
  }
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ah-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9333ea" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#ah-g)" />
      <rect x="26" y="12" width="12" height="40" rx="4" fill="#fff" />
      <rect x="12" y="26" width="40" height="12" rx="4" fill="#fff" />
    </svg>
  );
}
