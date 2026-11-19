import { useEffect, useMemo, useState } from 'react';
import { computeStats, GB, type Daily, type Settings } from '../shared/calc.mjs';
import { api, type Tick } from './api';
import { fmtBytes, fmtDate, fmtSpeed, fromKey } from './format';
import Gauge from './components/Gauge';
import DailyChart from './components/DailyChart';
import SettingsDialog from './components/SettingsDialog';

const ACTIVITIES = [
  { name: 'ساعات يوتيوب (1080p)', per: 1.5 * GB, icon: '▶' },
  { name: 'ساعات مكالمات فيديو', per: 0.8 * GB, icon: '📹' },
  { name: 'أفلام HD', per: 3 * GB, icon: '🎬' },
  { name: 'ساعات موسيقى', per: 0.07 * GB, icon: '♪' },
];

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [daily, setDaily] = useState<Daily>({});
  const [speed, setSpeed] = useState({ down: 0, up: 0 });
  const [now, setNow] = useState(() => new Date());
  const [dialog, setDialog] = useState(false);

  useEffect(() => {
    api.getState().then((s) => {
      setSettings(s.settings);
      setDaily(s.daily);
      if (!s.settings.configured) setDialog(true);
    });
    const off = api.onTick((t: Tick) => {
      setSpeed({ down: t.downBps, up: t.upBps });
      setDaily((d) => ({ ...d, [t.todayKey]: t.today }));
      setNow(new Date());
    });
    return off;
  }, []);

  const stats = useMemo(() => (settings ? computeStats(settings, daily, now) : null), [settings, daily, now]);
  if (!settings || !stats) return <div className="loading">جارٍ التحميل…</div>;

  const color = { ok: 'var(--green)', warn: 'var(--amber)', danger: 'var(--red)', over: 'var(--red)' }[stats.status];

  const banner = (() => {
    if (stats.status === 'over') return { cls: 'danger', text: 'انتهت باقتك لهذه الدورة.' };
    if (stats.runOutDate && stats.runOutDate.getTime() > now.getTime())
      return { cls: 'danger', text: `بمعدل استهلاكك الحالي ستنتهي باقتك يوم ${fmtDate(stats.runOutDate)} — قبل نهاية الدورة (${fmtDate(fromKey(stats.nextKey))}).` };
    if (stats.status === 'warn') return { cls: 'warn', text: 'اقتربت من حد الباقة، لكنها ما تزال تكفي بمعدلك الحالي.' };
    return { cls: 'ok', text: 'ممتاز! باقتك ستكفيك حتى نهاية الدورة بمعدل استهلاكك الحالي.' };
  })();

  const saveSettings = async (patch: Partial<Settings>) => {
    setSettings(await api.saveSettings(patch));
    setDialog(false);
  };

  return (
    <div className="app">
      <header>
        <div className="brand"><span className="logo">↓</span> عدّاد الإنترنت</div>
        <div className="live">
          <span className="pill down" title="سرعة التحميل الآن">↓ <b dir="ltr">{fmtSpeed(speed.down)}</b></span>
          <span className="pill up" title="سرعة الرفع الآن">↑ <b dir="ltr">{fmtSpeed(speed.up)}</b></span>
          <button className="btn ghost" onClick={() => setDialog(true)}>⚙ الإعدادات</button>
        </div>
      </header>

      <div className={`banner ${banner.cls}`}>{banner.text}</div>

      <section className="hero card">
        <Gauge pct={stats.pct} color={color} label={fmtBytes(Math.max(0, stats.remaining))} sub="المتبقي" />
        <div className="hero-info">
          <div className="big" dir="ltr">{fmtBytes(stats.used)} <small>/ {settings.quotaGB} GB</small></div>
          <div className="muted">
            دورة الفوترة: {fmtDate(fromKey(stats.startKey))} ← {fmtDate(fromKey(stats.nextKey))} · متبقي {stats.daysLeft} يوم
          </div>
          <div className="bar"><i style={{ width: `${Math.min(100, stats.pct * 100)}%`, background: color }} /></div>
        </div>
      </section>

      <section className="grid">
        <Stat title="استهلاك اليوم" value={fmtBytes(stats.todayUsed)} hint={`↓ ${fmtBytes(stats.todayDown)} · ↑ ${fmtBytes(stats.todayUp)}`} />
        <Stat title="الحصة اليومية الآمنة" value={fmtBytes(stats.dailySafe)} hint="كي تكفيك الباقة حتى النهاية" accent={stats.todayUsed > stats.dailySafe ? 'var(--amber)' : undefined} />
        <Stat title="متوسط استهلاكك اليومي" value={fmtBytes(stats.avgDaily)} hint="منذ بداية الدورة" />
        <Stat title="التوقع لنهاية الدورة" value={fmtBytes(stats.projected)} hint={stats.projected > stats.quota ? 'أعلى من باقتك ⚠' : 'ضمن حدود باقتك'} accent={stats.projected > stats.quota ? 'var(--red)' : undefined} />
      </section>

      <section className="card">
        <h3>الاستهلاك اليومي خلال الدورة</h3>
        <DailyChart series={stats.series} safe={stats.dailySafe} />
      </section>

      <section className="card">
        <h3>ماذا يعني المتبقي لك؟ <small>(تقديري)</small></h3>
        <div className="acts">
          {ACTIVITIES.map((a) => (
            <div key={a.name} className="act">
              <span className="ai">{a.icon}</span>
              <b dir="ltr">{Math.max(0, Math.floor(stats.remaining / a.per))}</b>
              <span className="muted">{a.name}</span>
            </div>
          ))}
        </div>
      </section>

      {dialog && (
        <SettingsDialog
          settings={settings}
          stats={stats}
          firstRun={!settings.configured}
          onCancel={() => setDialog(false)}
          onSave={saveSettings}
        />
      )}
    </div>
  );
}

function Stat({ title, value, hint, accent }: { title: string; value: string; hint: string; accent?: string }) {
  return (
    <div className="card stat">
      <div className="muted">{title}</div>
      <div className="val" dir="ltr" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="hint">{hint}</div>
    </div>
  );
}
