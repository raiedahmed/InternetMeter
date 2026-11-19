import { useState } from 'react';
import { fmtBytes } from '../format';
import { useI18n } from '../i18n';

interface Pt { key: string; d: number; u: number; total: number }

export default function DailyChart({ series, safe }: { series: Pt[]; safe: number }) {
  const { t } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const W = 800, H = 220, padL = 8, padB = 24, padT = 14;
  const max = Math.max(safe * 1.2, ...series.map((s) => s.total), 1);
  const n = Math.max(series.length, 1);
  const bw = (W - padL) / n;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const h = hover != null ? series[hover] : null;

  return (
    <div className="chart">
      <div className="tip" dir="ltr">
        {h ? `${h.key} · ${fmtBytes(h.total)} (↓ ${fmtBytes(h.d)} ↑ ${fmtBytes(h.u)})` : t('hoverHint')}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="220" onMouseLeave={() => setHover(null)}>
        {series.map((s, i) => {
          const x = padL + i * bw;
          const over = s.total > safe;
          return (
            <g key={s.key} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={0} width={bw} height={H} fill="transparent" />
              <rect
                x={x + bw * 0.15} y={y(s.total)} width={bw * 0.7} height={H - padB - y(s.total)} rx="3"
                fill={over ? 'var(--amber)' : 'var(--accent)'} opacity={hover === i ? 1 : 0.85}
              />
              {(n <= 16 || i % 2 === 0) && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">{s.key.slice(8)}</text>
              )}
            </g>
          );
        })}
        <line x1={padL} x2={W} y1={y(safe)} y2={y(safe)} stroke="var(--green)" strokeDasharray="6 5" strokeWidth="1.5" />
        <text x={W - 4} y={y(safe) - 5} textAnchor="end" fontSize="11" fill="var(--green)">{t('safeLabel')}</text>
      </svg>
    </div>
  );
}
