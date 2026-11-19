export default function Gauge({ pct, color, label, sub }: { pct: number; color: string; label: string; sub: string }) {
  const r = 78, c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, pct));
  return (
    <div className="gauge">
      <svg viewBox="0 0 200 200" width="200" height="200">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--track)" strokeWidth="16" />
        <circle
          cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dasharray .6s ease, stroke .3s' }}
        />
      </svg>
      <div className="gauge-text">
        <div className="gp" dir="ltr">{(pct * 100).toFixed(1)}%</div>
        <div className="gl" dir="ltr">{label}</div>
        <div className="muted">{sub}</div>
      </div>
    </div>
  );
}
