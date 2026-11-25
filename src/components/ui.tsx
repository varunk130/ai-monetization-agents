import type { ReactNode, SVGProps } from 'react';

const icon = (d: string) => (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d={d} />
  </svg>
);
export const IconBrief = icon('M4 4h16v16H4zM8 9h8M8 13h8M8 17h5');
export const IconAds = icon('M3 11l15-6v14L3 13v-2ZM7 13v5a2 2 0 0 0 4 0v-3');
export const IconBudget = icon('M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6');
export const IconResults = icon('M3 3v18h18M7 15l4-4 3 3 6-7');
export const IconSparkle = icon('M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z');
export const IconCheck = icon('M20 6 9 17l-5-5');
export const IconAlert = icon('M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z');
export const IconArrow = icon('M5 12h14M12 5l7 7-7 7');
export const IconPlus = icon('M12 5v14M5 12h14');

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? 'var(--good)' : score >= 50 ? 'var(--warn)' : 'var(--bad)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Ad score ${score} out of 100`} style={{ flex: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: 'var(--ink)' }}>
        {score}
      </text>
    </svg>
  );
}

export function BarList({ data, format }: { data: { label: ReactNode; value: number; title: string; sub?: string }[]; format: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1e-9);
  return (
    <div className="bars" role="list">
      {data.map((d) => (
        <div className="bar-row" key={d.title} role="listitem" title={d.title}>
          <span className="small ink2">{d.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="val">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export const usd = (n: number, digits = 0) => `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
