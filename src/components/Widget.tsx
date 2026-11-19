import { useEffect, useState } from 'react';
import { api, type Tick } from '../api';
import { fmtSpeed, fmtBytes } from '../format';

export default function Widget() {
  const [speed, setSpeed] = useState({ down: 0, up: 0 });
  const [today, setToday] = useState(0);

  useEffect(() => {
    api.getState().then((s) => {
      const todayRec = s.daily[s.todayKey];
      if (todayRec) setToday(todayRec.d + todayRec.u);
    });
    const off = api.onTick((t: Tick) => {
      setSpeed({ down: t.downBps, up: t.upBps });
      if (t.today) setToday(t.today.d + t.today.u);
    });
    return off;
  }, []);

  const openMain = () => {
    api.focusWindow();
  };

  const closeWidget = (e: React.MouseEvent) => {
    e.stopPropagation();
    api.toggleWidget(false);
  };

  return (
    <div
      className="floating-widget"
      onDoubleClick={openMain}
      title="انقر نقراً مزدوجاً لفتح عدّاد الإنترنت · Double click to open"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '8px 12px',
        background: 'rgba(11, 16, 32, 0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 12,
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
        WebkitAppRegion: 'drag',
        cursor: 'move',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        height: '100vh',
        boxSizing: 'border-box',
      } as React.CSSProperties}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#38bdf8', fontWeight: 'bold' }}>↓</span>
          <span style={{ fontSize: 13, fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{fmtSpeed(speed.down)}</span>
          <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 'bold', marginInlineStart: 4 }}>↑</span>
          <span style={{ fontSize: 13, fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{fmtSpeed(speed.up)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={openMain}
            title="فتح النافذة الرئيسية"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0 2px',
              fontSize: 12,
            }}
          >
            ↗
          </button>
          <button
            onClick={closeWidget}
            title="إخفاء الويدجت"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0 2px',
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
        <span>اليوم: <b style={{ color: '#e2e8f0' }}>{fmtBytes(today)}</b></span>
        <span style={{ fontSize: 10, color: '#38bdf8' }}>عدّاد الإنترنت</span>
      </div>
    </div>
  );
}
