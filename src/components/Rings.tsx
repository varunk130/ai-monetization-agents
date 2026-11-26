/** Nested circles for market sizing (TAM / SAM / first slice). Areas are not to scale; labels carry the numbers. */
export function Rings({ layers }: { layers: { label: string; value: string; color: string }[] }) {
  const size = 360;
  const c = size / 2;
  const radii = [170, 118, 70];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={layers.map((l) => `${l.label} ${l.value}`).join(', ')}>
      <defs>
        {layers.map((l, i) => (
          <radialGradient key={i} id={`ring${i}`} cx="50%" cy="35%" r="75%">
            <stop offset="0%" stopColor={l.color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={l.color} stopOpacity={0.95} />
          </radialGradient>
        ))}
      </defs>
      {layers.map((l, i) => {
        const r = radii[i];
        const cy = size - r - 10;
        return (
          <g key={l.label}>
            <circle cx={c} cy={cy} r={r} fill={`url(#ring${i})`} stroke="var(--surface)" strokeWidth={3} />
            <text x={c} y={cy - r + (i === 2 ? r - 4 : 30)} textAnchor="middle" fill="#fff" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em' }}>
              {l.label}
            </text>
            <text x={c} y={cy - r + (i === 2 ? r + 20 : 56)} textAnchor="middle" fill="#fff" style={{ fontSize: i === 2 ? 22 : 24, fontWeight: 850 }}>
              {l.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
