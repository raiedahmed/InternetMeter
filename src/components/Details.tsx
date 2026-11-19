import { Fragment, useEffect, useRef, useState } from 'react';
import { api, type AppRow, type Detail, type TrackerStatus } from '../api';
import { fmtBytes } from '../format';
import { useI18n } from '../i18n';

export type Range = 'today' | '7d' | 'cycle' | '30d';
const COLORS = ['#4f8cff', '#2ecc8f', '#f5a623', '#b074ff', '#ff6b9a', '#3ed0e6', '#9bd14b', '#ff8a5b'];
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function getAppCategory(name: string, exe: string) {
  const s = `${name} ${exe}`.toLowerCase();
  if (/chrome|firefox|edge|brave|opera|safari|browser/.test(s)) {
    return { key: 'browsing', labelAr: 'تصفح إنترنت', labelEn: 'Browsing', icon: '🌐' };
  }
  if (/steam|epic|riot|valorant|game|origin|ubisoft|blizzard|battle\.net|minecraft|roblox/.test(s)) {
    return { key: 'gaming', labelAr: 'ألعاب', labelEn: 'Gaming', icon: '🎮' };
  }
  if (/wuauserv|windowsupdate|tiworker|trustedinstaller|msiexec|deliveryoptimization/.test(s)) {
    return { key: 'updates', labelAr: 'تحديثات النظام', labelEn: 'Updates', icon: '🔄' };
  }
  if (/discord|teams|zoom|telegram|whatsapp|skype|slack/.test(s)) {
    return { key: 'social', labelAr: 'تواصل ومكالمات', labelEn: 'Communication', icon: '💬' };
  }
  if (/youtube|netflix|spotify|vlc|twitch|prime|media|video/.test(s)) {
    return { key: 'streaming', labelAr: 'بث وفيديو', labelEn: 'Streaming', icon: '🎬' };
  }
  if (/svchost|system|explorer|spoolsv|lsass/.test(s)) {
    return { key: 'system', labelAr: 'خدمات النظام', labelEn: 'System', icon: '⚙️' };
  }
  return { key: 'other', labelAr: 'تطبيقات أخرى', labelEn: 'Other', icon: '📦' };
}

export function rangeKeys(range: Range, cycleStart: string): [string, string] {
  const now = new Date();
  const back = (n: number) => day(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  const to = day(now);
  if (range === 'today') return [to, to];
  if (range === '7d') return [back(6), to];
  if (range === '30d') return [back(29), to];
  return [cycleStart, to];
}

/** يجلب التفاصيل ويحدّثها تلقائياً كل 3 ثوانٍ */
export function useDetail(from: string, to: string, every = 3000) {
  const [data, setData] = useState<Detail | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (busy.current) return;
      busy.current = true;
      try { const d = await api.getDetail(from, to); if (alive) setData(d); } finally { busy.current = false; }
    };
    load();
    const id = setInterval(load, every);
    return () => { alive = false; clearInterval(id); };
  }, [from, to, every]);
  return data;
}

export function useTracker() {
  const [s, setS] = useState<TrackerStatus | null>(null);
  useEffect(() => {
    api.getTrackerStatus().then(setS);
    return api.onTracker((x) => setS((p) => ({ ...p, ...x })));
  }, []);
  return s;
}

export function TrackerBanner() {
  const { t } = useI18n();
  const s = useTracker();
  if (!s || s.status === 'running') return null;
  if (s.status === 'noadmin')
    return (
      <div className="notice">
        <div><b>{t('trackerNoAdminTitle')}</b><div className="muted">{t('trackerNoAdminBody')}</div></div>
        <button className="btn primary" onClick={() => api.relaunchAsAdmin()}>🛡 {t('trackerEnable')}</button>
      </div>
    );
  const msg = s.status === 'missing' ? t('trackerMissing') : s.status === 'error' ? t('trackerError', { e: s.detail ?? '' }) : t('trackerStarting');
  return <div className="notice"><div className="muted">{msg}</div></div>;
}

const iconCache = new Map<string, string>();
export function AppIcon({ path, name, color }: { path: string; name: string; color: string }) {
  const [src, setSrc] = useState(iconCache.get(path) ?? '');
  useEffect(() => {
    if (!path || iconCache.has(path)) return;
    api.getIcon(path).then((u) => { iconCache.set(path, u); setSrc(u); });
  }, [path]);
  if (src) return <img className="appicon" src={src} alt="" />;
  return <span className="appicon fallback" style={{ background: color }}>{(name[0] || '?').toUpperCase()}</span>;
}

export function RangeTabs({ value, onChange }: { value: Range; onChange(r: Range): void }) {
  const { t } = useI18n();
  const items: [Range, string][] = [['today', t('rangeToday')], ['7d', t('range7')], ['cycle', t('rangeCycle')], ['30d', t('range30')]];
  return (
    <div className="chips">
      {items.map(([k, label]) => (
        <button key={k} className={`chip ${value === k ? 'on' : ''}`} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  );
}

const total = (x: { d: number; u: number }) => x.d + x.u;

function ShareBar({ pct, color }: { pct: number; color: string }) {
  return <div className="sbar"><i style={{ width: `${Math.max(1, Math.min(100, pct))}%`, background: color }} /></div>;
}

function Stacked({ apps, sum }: { apps: AppRow[]; sum: number }) {
  const { t } = useI18n();
  const top = apps.slice(0, 7);
  const rest = sum - top.reduce((s, a) => s + total(a), 0);
  return (
    <>
      <div className="stack">
        {top.map((a, i) => <i key={a.key} style={{ width: `${(total(a) / sum) * 100}%`, background: COLORS[i] }} title={`${a.name} · ${fmtBytes(total(a))}`} />)}
        {rest > 0 && <i style={{ width: `${(rest / sum) * 100}%`, background: '#4a5578' }} title={t('other')} />}
      </div>
      <div className="legend">
        {top.map((a, i) => <span key={a.key}><b style={{ background: COLORS[i] }} />{a.name} <em dir="ltr">{((total(a) / sum) * 100).toFixed(0)}%</em></span>)}
        {rest > 0 && <span><b style={{ background: '#4a5578' }} />{t('other')} <em dir="ltr">{((rest / sum) * 100).toFixed(0)}%</em></span>}
      </div>
    </>
  );
}

function Footer({ data }: { data: Detail }) {
  const { t } = useI18n();
  const un = Math.max(0, total(data.total) - data.attributed);
  if (un < 1024 * 1024 && !data.lan) return null;
  return <div className="note foot">{un >= 1024 * 1024 && t('unattributed', { n: fmtBytes(un) })}</div>;
}

export function AppsView({ cycleStart }: { cycleStart: string }) {
  const { t, lang } = useI18n();
  const [range, setRange] = useState<Range>('today');
  const [open, setOpen] = useState<string | null>(null);
  const [from, to] = rangeKeys(range, cycleStart);
  const data = useDetail(from, to);
  const sum = data ? data.apps.reduce((s, a) => s + total(a), 0) : 0;

  return (
    <div className="stackv">
      <TrackerBanner />
      <div className="card">
        <div className="rowbar"><h3>{t('tabApps')}</h3><RangeTabs value={range} onChange={setRange} /></div>
        {!data || data.apps.length === 0 ? <div className="muted pad">{t('noData')}</div> : (
          <>
            <Stacked apps={data.apps} sum={sum} />
            <table className="tbl">
              <thead><tr><th>{t('colApp')}</th><th className="n">{t('colDown')}</th><th className="n">{t('colUp')}</th><th className="n">{t('colTotal')}</th><th className="w">%</th></tr></thead>
              <tbody>
                {data.apps.map((a, i) => {
                  const cat = getAppCategory(a.name, a.exe);
                  return (
                    <Fragment key={a.key}>
                      <tr key={a.key} className="clk" onClick={() => setOpen(open === a.key ? null : a.key)}>
                        <td>
                          <div className="appcell">
                            <AppIcon path={a.path} name={a.name} color={COLORS[i % COLORS.length]} />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{a.name}</span>
                                <span className="pill" style={{ fontSize: '0.68rem', padding: '1px 5px', opacity: 0.9 }}>
                                  {cat.icon} {lang === 'ar' ? cat.labelAr : cat.labelEn}
                                </span>
                              </div>
                              <div className="muted xs" dir="ltr">{a.exe}</div>
                            </div>
                          </div>
                        </td>
                        <td className="n" dir="ltr">{fmtBytes(a.d)}</td>
                        <td className="n" dir="ltr">{fmtBytes(a.u)}</td>
                        <td className="n strong" dir="ltr">{fmtBytes(total(a))}</td>
                        <td className="w"><ShareBar pct={(total(a) / sum) * 100} color={COLORS[i % COLORS.length]} /></td>
                      </tr>
                      {open === a.key && (
                        <tr key={a.key + '-d'} className="sub"><td colSpan={5}>
                          <div className="muted xs">{t('appHostsTitle')}</div>
                          {a.hosts.map((h) => (
                            <div key={h.host} className="hrow">
                              <span className="hname" dir="ltr">{h.host === '*' ? t('other') : h.host}{h.lan && <em className="tag">{t('lan')}</em>}</span>
                              <span className="hbar"><ShareBar pct={(total(h) / total(a)) * 100} color={COLORS[i % COLORS.length]} /></span>
                              <span className="hval" dir="ltr">{fmtBytes(total(h))}</span>
                            </div>
                          ))}
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <Footer data={data} />
          </>
        )}
      </div>
    </div>
  );
}

export function HostsView({ cycleStart }: { cycleStart: string }) {
  const { t } = useI18n();
  const [range, setRange] = useState<Range>('today');
  const [from, to] = rangeKeys(range, cycleStart);
  const data = useDetail(from, to);
  const sum = data ? data.hosts.reduce((s, h) => s + total(h), 0) : 0;
  return (
    <div className="stackv">
      <TrackerBanner />
      <div className="card">
        <div className="rowbar"><h3>{t('hostsTitle')}</h3><RangeTabs value={range} onChange={setRange} /></div>
        <div className="note">{t('hostsNote')}</div>
        {!data || data.hosts.length === 0 ? <div className="muted pad">{t('noData')}</div> : (
          <table className="tbl">
            <thead><tr><th>{t('colHost')}</th><th>{t('colApps')}</th><th className="n">{t('colDown')}</th><th className="n">{t('colUp')}</th><th className="n">{t('colTotal')}</th><th className="w">%</th></tr></thead>
            <tbody>
              {data.hosts.map((h, i) => (
                <tr key={h.host}>
                  <td dir="ltr" className="hostc">{h.host === '*' ? t('other') : h.host}{h.lan && <em className="tag">{t('lan')}</em>}</td>
                  <td className="muted xs">{h.apps.join('، ')}</td>
                  <td className="n" dir="ltr">{fmtBytes(h.d)}</td>
                  <td className="n" dir="ltr">{fmtBytes(h.u)}</td>
                  <td className="n strong" dir="ltr">{fmtBytes(total(h))}</td>
                  <td className="w"><ShareBar pct={(total(h) / sum) * 100} color={COLORS[i % COLORS.length]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Bars({ values, labels, fmtTip }: { values: number[]; labels: string[]; fmtTip(i: number): string }) {
  const [h, setH] = useState<number | null>(null);
  const W = 800, H = 190, pb = 22, pt = 8;
  const max = Math.max(...values, 1);
  const n = values.length, bw = W / Math.max(n, 1);
  return (
    <div className="chart">
      <div className="tip" dir="ltr">{h != null ? fmtTip(h) : ' '}</div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="190" onMouseLeave={() => setH(null)}>
        {values.map((v, i) => {
          const bh = ((H - pb - pt) * v) / max;
          return (
            <g key={i} onMouseEnter={() => setH(i)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              <rect x={i * bw + bw * 0.15} y={H - pb - bh} width={bw * 0.7} height={bh} rx="3" fill="var(--accent)" opacity={h === i ? 1 : 0.85} />
              {labels[i] && <text x={i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">{labels[i]}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TimeView({ cycleStart }: { cycleStart: string }) {
  const { t, fmtHour } = useI18n();
  const [range, setRange] = useState<Range>('7d');
  const [from, to] = rangeKeys(range, cycleStart);
  const data = useDetail(from, to);
  const peak = data ? data.hours.indexOf(Math.max(...data.hours)) : -1;
  const hasHours = !!data && data.hours.some((v) => v > 0);
  return (
    <div className="stackv">
      <div className="card">
        <div className="rowbar"><h3>{t('hoursTitle')}</h3><RangeTabs value={range} onChange={setRange} /></div>
        {!data || !hasHours ? <div className="muted pad">{t('noData')}</div> : (
          <>
            <div className="note">{t('peak', { h: fmtHour(peak) })}</div>
            <Bars values={data.hours} labels={data.hours.map((_, i) => (i % 3 === 0 ? fmtHour(i) : ''))} fmtTip={(i) => `${fmtHour(i)} · ${fmtBytes(data.hours[i])}`} />
          </>
        )}
      </div>
      {data && data.days.length > 0 && (
        <div className="card">
          <h3>{t('daysTitle')}</h3>
          <Bars values={data.days.map((d) => d.d + d.u)} labels={data.days.map((d, i) => (data.days.length <= 16 || i % 3 === 0 ? d.key.slice(8) : ''))}
            fmtTip={(i) => `${data.days[i].key} · ${fmtBytes(data.days[i].d + data.days[i].u)}`} />
        </div>
      )}
    </div>
  );
}

/** بطاقة "أين ذهب استهلاك اليوم" للصفحة الرئيسية */
export function TopApps({ onMore }: { onMore(): void }) {
  const { t, lang } = useI18n();
  const k = day(new Date());
  const data = useDetail(k, k);
  const sum = data ? data.apps.reduce((s, a) => s + total(a), 0) : 0;
  return (
    <section className="card">
      <div className="rowbar"><h3>{t('topToday')}</h3><button className="btn ghost sm" onClick={onMore}>{t('seeAll')}</button></div>
      {!data || data.apps.length === 0 ? <TrackerBanner /> : (
        <div>
          {data.apps.slice(0, 5).map((a, i) => {
            const cat = getAppCategory(a.name, a.exe);
            return (
              <div key={a.key} className="toprow">
                <AppIcon path={a.path} name={a.name} color={COLORS[i]} />
                <span className="tname" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{a.name}</span>
                  <span className="pill" style={{ fontSize: '0.65rem', padding: '0 4px', opacity: 0.85 }}>
                    {cat.icon} {lang === 'ar' ? cat.labelAr : cat.labelEn}
                  </span>
                </span>
                <span className="hbar"><ShareBar pct={(total(a) / sum) * 100} color={COLORS[i]} /></span>
                <span className="hval" dir="ltr">{fmtBytes(total(a))}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
