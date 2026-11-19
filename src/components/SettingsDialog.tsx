import { useState, type ReactNode } from 'react';
import { GB, cycleBounds, dateKey, type Settings, type Stats } from '../../shared/calc.mjs';
import { useI18n, type Key, type Lang } from '../i18n';

interface Props {
  settings: Settings;
  stats: Stats;
  firstRun: boolean;
  onCancel(): void;
  onSave(patch: Partial<Settings>): void;
}

function Section({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="sec">
      <h3><span className="sec-ic">{icon}</span>{title}</h3>
      <div className="sec-body">{children}</div>
    </section>
  );
}

function Field({ label, hint, error, children, wide }: { label: string; hint?: string; error?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`fld ${wide ? 'wide' : ''}`}>
      <span className="fld-l">{label}</span>
      {children}
      {error ? <span className="fld-e">{error}</span> : hint ? <span className="note">{hint}</span> : null}
    </label>
  );
}

function Switch({ checked, onChange, title, desc }: { checked: boolean; onChange(v: boolean): void; title: string; desc?: string }) {
  return (
    <label className="sw">
      <span className="sw-t"><b>{title}</b>{desc && <small>{desc}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden />
    </label>
  );
}

export default function SettingsDialog({ settings, stats, firstRun, onCancel, onSave }: Props) {
  const { t, lang, fmtHour } = useI18n();
  const [newLang, setNewLang] = useState<Lang>(lang);
  const [quota, setQuota] = useState(String(settings.quotaGB));
  const [day, setDay] = useState(String(settings.cycleDay));
  const [isp, setIsp] = useState('');
  const [alerts, setAlerts] = useState<number[]>(settings.alerts);
  const [autoStart, setAutoStart] = useState(settings.autoStart);
  const [showWidget, setShowWidget] = useState(!!settings.showWidget);
  const [leakAlert, setLeakAlert] = useState(settings.leakAlert ?? true);
  const [cost, setCost] = useState(settings.cost ? String(settings.cost) : '');
  const [currency, setCurrency] = useState(settings.currency || (lang === 'en' ? 'EGP' : 'ج.م'));
  const [nightEnabled, setNightEnabled] = useState(!!settings.nightEnabled);
  const [nightStart, setNightStart] = useState(settings.nightStart ?? 2);
  const [nightEnd, setNightEnd] = useState(settings.nightEnd ?? 8);
  const [nightFree, setNightFree] = useState(!settings.nightDeduct);
  const [ecoMode, setEcoMode] = useState(!!settings.ecoMode);

  const toggle = (v: number) => setAlerts((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));
  const q = Number(quota), d = Number(day);
  const quotaOk = q > 0, dayOk = Number.isInteger(d) && d >= 1 && d <= 31;
  const valid = quotaOk && dayOk;

  const save = () => {
    const patch: Partial<Settings> = {
      quotaGB: q, cycleDay: d, alerts, autoStart, lang: newLang, showWidget, leakAlert,
      cost: cost ? Number(cost) : 0, currency,
      nightEnabled, nightStart, nightEnd, nightDeduct: !nightFree, ecoMode,
    };
    // معايرة مع رقم شركة الإنترنت: الفرق عمّا قاسه البرنامج يُحفظ كإزاحة للدورة الحالية
    if (isp.trim() !== '' && Number(isp) >= 0) {
      const { start } = cycleBounds(d, new Date());
      patch.offset = { cycle: dateKey(start), bytes: Number(isp) * GB - stats.tracked };
    }
    onSave(patch);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const HourSelect = ({ value, onChange }: { value: number; onChange(v: number): void }) => (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {hours.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
    </select>
  );

  const switchLang = (l: Lang) => {
    setNewLang(l);
    if (!cost) setCurrency(l === 'ar' ? 'ج.م' : 'EGP');
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !firstRun && onCancel()}>
      <div className="dialog wide-dialog" role="dialog" aria-modal="true">
        <header className="dlg-head">
          <h2>{firstRun ? t('welcome') : t('settingsTitle')}</h2>
          {!firstRun && <button className="x" onClick={onCancel} aria-label={t('close' as Key)}>✕</button>}
        </header>

        <div className="dlg-body">
          <Section icon="📦" title={t('secPlan' as Key)}>
            <div className="grid2">
              <Field label={t('quota')} error={quotaOk ? undefined : t('quotaInvalid' as Key)}>
                <div className="unit"><input type="number" min="1" className={quotaOk ? '' : 'bad'} value={quota} onChange={(e) => setQuota(e.target.value)} autoFocus /><em>GB</em></div>
              </Field>
              <Field label={t('renewDay')} hint={t('renewHint' as Key)} error={dayOk ? undefined : t('dayInvalid' as Key)}>
                <input type="number" min="1" max="31" className={dayOk ? '' : 'bad'} value={day} onChange={(e) => setDay(e.target.value)} />
              </Field>
              <Field wide label={t('ispUsage')} hint={t('ispNote')}>
                <div className="unit"><input type="number" min="0" step="0.01" placeholder={t('ispPlaceholder')} value={isp} onChange={(e) => setIsp(e.target.value)} /><em>GB</em></div>
              </Field>
            </div>
          </Section>

          <Section icon="🔔" title={t('secAlerts' as Key)}>
            <div className="fld-l">{t('alertsAt')}</div>
            <div className="chips">
              {[50, 80, 90, 95].map((v) => (
                <button key={v} type="button" className={`chip ${alerts.includes(v) ? 'on' : ''}`} onClick={() => toggle(v)}>{v}%</button>
              ))}
            </div>
            <Switch checked={leakAlert} onChange={setLeakAlert} title={t('leakAlert')} desc={t('leakDesc' as Key)} />
            <Switch checked={ecoMode} onChange={setEcoMode} title={t('ecoMode')} desc={t('ecoModeDesc')} />
          </Section>

          <Section icon="🌙" title={t('secNight' as Key)}>
            <Switch checked={nightEnabled} onChange={setNightEnabled} title={t('nightEnabled')} desc={t('nightDesc' as Key)} />
            {nightEnabled && (
              <>
                <div className="grid2">
                  <Field label={t('fromHour' as Key)}><HourSelect value={nightStart} onChange={setNightStart} /></Field>
                  <Field label={t('toHour' as Key)}><HourSelect value={nightEnd} onChange={setNightEnd} /></Field>
                </div>
                <Switch checked={nightFree} onChange={setNightFree} title={t('nightFree')} />
              </>
            )}
          </Section>

          <Section icon="💰" title={t('secMoney' as Key)}>
            <div className="grid2 money">
              <Field label={t('planCost')} hint={t('costDesc' as Key)}>
                <input type="number" min="0" placeholder={t('costPlaceholder' as Key)} value={cost} onChange={(e) => setCost(e.target.value)} />
              </Field>
              <Field label={t('currency')}>
                <input type="text" maxLength={8} value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section icon="⚙️" title={t('secApp' as Key)}>
            <div className="fld-l">{t('language')}</div>
            <div className="seg">
              <button type="button" className={newLang === 'ar' ? 'on' : ''} onClick={() => switchLang('ar')}>العربية</button>
              <button type="button" className={newLang === 'en' ? 'on' : ''} onClick={() => switchLang('en')}>English</button>
            </div>
            <Switch checked={showWidget} onChange={setShowWidget} title={t('widgetTitle')} desc={t('widgetDesc')} />
            <Switch checked={autoStart} onChange={setAutoStart} title={t('autoStart')} desc={t('autoStartDesc' as Key)} />
          </Section>
        </div>

        <footer className="dlg-foot">
          {!firstRun && <button className="btn ghost" onClick={onCancel}>{t('cancel')}</button>}
          <button className="btn primary" disabled={!valid} onClick={save}>{t('save')}</button>
        </footer>
      </div>
    </div>
  );
}
