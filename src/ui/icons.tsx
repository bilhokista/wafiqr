// Hairline icon set — 1px strokes, drawn inline so nothing pulls a heavy icon font.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Svg({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true">
      {children}
    </svg>
  );
}

export const ArrowUpRight = (p: { size?: number }) => (
  <Svg {...p}><path d="M7 17 17 7M9 7h8v8" /></Svg>
);
export const ArrowRight = (p: { size?: number }) => (
  <Svg {...p}><path d="M4 12h16M14 6l6 6-6 6" /></Svg>
);
export const Shield = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6L12 3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></Svg>
);
export const Leaf = (p: { size?: number }) => (
  <Svg {...p}><path d="M4 20c0-8 6-14 16-14 0 10-6 14-12 14H4Z" /><path d="M9 15c2-3 5-5 8-6" /></Svg>
);
export const Ship = (p: { size?: number }) => (
  <Svg {...p}><path d="M3 15.5 5 10h14l2 5.5" /><path d="M8 10V6h8v4" /><path d="M3 15.5c2.5 2 4 2 6 0s3.5-2 6 0 3.5 2 6 0" /></Svg>
);
export const Scale = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 4v16M7 20h10M4 9h16M4 9l-2 5a3.2 3.2 0 0 0 4 0L4 9ZM20 9l-2 5a3.2 3.2 0 0 0 4 0l-2-5Z" /></Svg>
);
export const Plus = (p: { size?: number }) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const Wallet = (p: { size?: number }) => (
  <Svg {...p}><path d="M4 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" /><path d="M16 12.5h3.5" /></Svg>
);
export const Clock = (p: { size?: number }) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
);
