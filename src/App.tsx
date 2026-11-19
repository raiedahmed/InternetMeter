import { useEffect, useMemo, useState } from 'react';
import { computeStats, GB, type Daily, type Settings } from '../shared/calc.mjs';
import { api, type Tick } from './api';
import { fmtBytes, fmtSpeed, fromKey } from './format';
import { I18nContext, detectLang, makeI18n, type Key, type Lang } from './i18n';
import Gauge from './components/Gauge';
import DailyChart from './components/DailyChart';
import SettingsDialog from './components/SettingsDialog';
import { AppsView, HostsView, TimeView, TopApps } from './components/Details';
import NetworkView from './components/NetworkView';
import ReportView from './components/ReportView';
import Widget from './components/Widget';

type Tab = 'overview' | 'apps' | 'hosts' | 'time' | 'network' | 'report';
const TABS: [Tab, Key][] = [
  ['overview', 'tabOverview'],
  ['apps', 'tabApps'],
  ['hosts', 'tabHosts'],
  ['time', 'tabTime'],
  ['network', 'tabNetwork'],
  ['report', 'tabReport'],
];

const ACTIVITIES: { name: Key; per: number; icon: string }[] = [
  { name: 'actYoutube', per: 1.5 * GB, icon: '▶' },
  { name: 'actCalls', per: 0.8 * GB, icon: '📹' },
  { name: 'actMovies', per: 3 * GB, icon: '🎬' },
  { name: 'actMusic', per: 0.07 * GB, icon: '♪' },
];

export default function App() {
  // إذا كان الرابط هو #widget، اعرض الويدجت العائم مباشرة
  if (typeof window !== 'undefined' && window.location.hash === '#widget') {
    return <Widget />;
  }

  const [settings, setSettings] = useState<Settings | null>(null);
  const [daily, setDaily] = useState<Daily>({});
  const [speed, setSpeed] = useState({ down: 0, up: 0 });
  const [now, setNow] = useState(() => new Date());
  const [dialog, setDialog] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [lang, setLang] = useState<Lang>(detectLang);
  const i18n = useMemo(() => makeI18n(lang), [lang]);
  const { t, fmtDate } = i18n;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('appName');
  }, [lang, t]);

  useEffect(() => {
    api.getState().then((s) => {
      setSettings(s.settings);
      if (s.settings.lang) setLang(s.settings.lang);
      setDaily(s.daily);
      if (!s.settings.configured) setDialog(true);
    });
    const off = api.onTick((tk: Tick) => {
      setSpeed({ down: tk.downBps, up: tk.upBps });
      setDaily((d) => ({ ...d, [tk.todayKey]: tk.today }));
      setNow(new Date());
    });
    return off;
  }, []);

  const stats = useMemo(() => (settings ? computeStats(settings, daily, now) : null), [settings, daily, now]);
  if (!settings || !stats) return <div className="loading">{t('loading')}</div>;

  const color = { ok: 'var(--green)', warn: 'var(--amber)', danger: 'var(--red)', over: 'var(--red)' }[stats.status];

  const banner = (() => {
    if (stats.status === 'over') return { cls: 'danger', text: t('bannerOver') };
    if (stats.runOutDate && stats.runOutDate.getTime() > now.getTime())
      return { cls: 'danger', text: t('bannerRunOut', { date: fmtDate(stats.runOutDate), end: fmtDate(fromKey(stats.nextKey)) }) };
    if (stats.status === 'warn') return { cls: 'warn', text: t('bannerWarn') };
    return { cls: 'ok', text: t('bannerOk') };
  })();

  const saveSettings = async (patch: Partial<Settings>) => {
    const s = await api.saveSettings(patch);
    setSettings(s);
    if (s.lang) setLang(s.lang);
    setDialog(false);
  };

  const toggleLang = async () => {
    const next: Lang = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    if (settings.configured) setSettings(await api.saveSettings({ lang: next }));
  };

  const toggleWidget = async () => {
    const next = !settings.showWidget;
    await api.toggleWidget(next);
    setSettings({ ...settings, showWidget: next });
  };

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app">
        <header>
          <div className="brand">
            <span className="logo">↓</span> {t('appName')}
            {settings.ecoMode && (
              <span className="pill ok" style={{ fontSize: '0.75rem', marginInlineStart: 8 }}>
                🌱 {t('ecoMode')}
              </span>
            )}
          </div>
          <div className="live">
            <span className="pill down" title={t('downNow')}>↓ <b dir="ltr">{fmtSpeed(speed.down)}</b></span>
            <span className="pill up" title={t('upNow')}>↑ <b dir="ltr">{fmtSpeed(speed.up)}</b></span>
            <button className="btn ghost" onClick={toggleWidget} title={t('widgetDesc')}>
              🪟 {t('widgetTitle')}
            </button>
            <button className="btn ghost" onClick={toggleLang}>{t('switchLang')}</button>
            <button className="btn ghost" onClick={() => setDialog(true)}>{t('settings')}</button>
          </div>
        </header>

        <nav className="tabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{t(label)}</button>
          ))}
        </nav>

        {tab === 'apps' && <AppsView cycleStart={stats.startKey} />}
        {tab === 'hosts' && <HostsView cycleStart={stats.startKey} />}
        {tab === 'time' && <TimeView cycleStart={stats.startKey} />}
        {tab === 'network' && <NetworkView />}
        {tab === 'report' && <ReportView settings={settings} stats={stats} />}

        {tab === 'overview' && <>
        <div className={`banner ${banner.cls}`}>{banner.text}</div>

        <section className="hero card">
          <Gauge pct={stats.pct} color={color} label={fmtBytes(Math.max(0, stats.remaining))} sub={t('remaining')} />
          <div className="hero-info">
            <div className="big" dir="ltr">{fmtBytes(stats.used)} <small>/ {settings.quotaGB} GB</small></div>
            <div className="muted">
              {t('cycle', { a: fmtDate(fromKey(stats.startKey)), b: fmtDate(fromKey(stats.nextKey)), n: stats.daysLeft })}
            </div>
            <div className="bar"><i style={{ width: `${Math.min(100, stats.pct * 100)}%`, background: color }} /></div>
          </div>
        </section>

        <section className="grid">
          <Stat title={t('today')} value={fmtBytes(stats.todayUsed)} hint={`↓ ${fmtBytes(stats.todayDown)} · ↑ ${fmtBytes(stats.todayUp)}`} />
          <Stat title={t('safeDaily')} value={fmtBytes(stats.dailySafe)} hint={t('safeHint')} accent={stats.todayUsed > stats.dailySafe ? 'var(--amber)' : undefined} />
          <Stat title={t('avgDaily')} value={fmtBytes(stats.avgDaily)} hint={t('sinceStart')} />
          <Stat title={t('forecast')} value={fmtBytes(stats.projected)} hint={stats.projected > stats.quota ? t('overPlan') : t('withinPlan')} accent={stats.projected > stats.quota ? 'var(--red)' : undefined} />
          {settings.cost ? (
            <Stat title={t('todayCost')} value={`${stats.todayCost.toFixed(2)} ${stats.currency}`} hint={`سعر الجيجا: ${stats.costPerGB.toFixed(2)} ${stats.currency}`} />
          ) : null}
          {settings.nightEnabled ? (
            <Stat title={t('nightStat')} value={fmtBytes(stats.nightUsed)} hint={settings.nightDeduct ? 'مخصومة من الباقة' : 'ساعات مجانية غير مخصومة'} />
          ) : null}
        </section>

        <TopApps onMore={() => setTab('apps')} />

        <section className="card">
          <h3>{t('dailyChart')}</h3>
          <DailyChart series={stats.series} safe={stats.dailySafe} />
        </section>

        <section className="card">
          <h3>{t('meaning')} <small>{t('approx')}</small></h3>
          <div className="acts">
            {ACTIVITIES.map((a) => (
              <div key={a.name} className="act">
                <span className="ai">{a.icon}</span>
                <b dir="ltr">{Math.max(0, Math.floor(stats.remaining / a.per))}</b>
                <span className="muted">{t(a.name)}</span>
              </div>
            ))}
          </div>
        </section>
        </>}

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
    </I18nContext.Provider>
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
