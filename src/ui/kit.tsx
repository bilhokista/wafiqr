// Shared UI primitives. Every surface is a double-bezel: an outer tray holding an
// inner core, so cards read as machined objects instead of flat rectangles.
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

const FLUID = 'transition-all duration-700 ease-fluid';

export function Shell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`shell ${className}`}>
      <div className="core h-full">{children}</div>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

type Variant = 'primary' | 'ghost' | 'quiet';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:bg-spice-deep',
  ghost: 'bg-paper text-ink ring-1 ring-ink/[0.08] hover:ring-ink/20',
  quiet: 'bg-transparent text-ink-mute hover:text-ink',
};

interface ActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  trailing?: ReactNode;
  full?: boolean;
}

/** Pill CTA. A trailing glyph always sits in its own nested circle, flush right. */
export function Action({
  variant = 'primary',
  trailing,
  full,
  children,
  className = '',
  ...rest
}: ActionProps) {
  return (
    <button
      {...rest}
      className={`group inline-flex items-center justify-center gap-3 rounded-full px-6 py-3
        text-sm font-medium ${FLUID} active:scale-[0.98]
        disabled:cursor-not-allowed disabled:opacity-40
        ${variants[variant]} ${full ? 'w-full' : ''} ${className}`}
    >
      <span>{children}</span>
      {trailing && (
        <span
          className={`-mr-3 flex h-8 w-8 items-center justify-center rounded-full
            ${variant === 'primary' ? 'bg-paper/15' : 'bg-ink/[0.06]'} ${FLUID}
            group-hover:translate-x-1 group-hover:-translate-y-px group-hover:scale-105`}
        >
          {trailing}
        </span>
      )}
    </button>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-ink/[0.05] text-ink-soft',
    good: 'bg-sage/12 text-sage-deep',
    warn: 'bg-amber/15 text-amber',
    bad: 'bg-spice/12 text-spice-deep',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1
      text-[10px] font-medium uppercase tracking-[0.16em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-ink-mute">{hint}</span>}
    </label>
  );
}

/** Fades content up as it enters the viewport. IntersectionObserver, never scroll events. */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const node = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={node} className={`reveal ${shown ? 'is-in' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
  );
}

export function Notice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  const tones = {
    error: 'bg-spice/[0.07] text-spice-deep ring-spice/20',
    info: 'bg-ink/[0.03] text-ink-soft ring-ink/[0.07]',
  } as const;
  return <div className={`rounded-2xl px-4 py-3 text-sm ring-1 ${tones[tone]}`}>{children}</div>;
}

export const shortAddress = (a: string) => (a && a.length > 12 ? `${a.slice(0, 5)}…${a.slice(-5)}` : a || '—');
export const usdc = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC`;
export const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
