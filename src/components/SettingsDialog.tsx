import { useState } from 'react';
import { GB, cycleBounds, dateKey, type Settings, type Stats } from '../../shared/calc.mjs';
import { useI18n, type Lang } from '../i18n';

interface Props {
  settings: Settings;
  stats: Stats;
  firstRun: boolean;
  onCancel(): void;
  onSave(patch: Partial<Settings>): void;
}

export default function SettingsDialog({ settings, stats, firstRun, onCancel, onSave }: Props) {
  const { t, lang } = useI18n();
  const [newLang, setNewLang] = useState<Lang>(lang);
  const [quota, setQuota] = useState(String(settings.quotaGB));
  const [day, setDay] = useState(String(settings.cycleDay));
  const [isp, setIsp] = useState('');
  const [alerts, setAlerts] = useState<number[]>(settings.alerts);
  const [autoStart, setAutoStart] = useState(settings.autoStart);

  // New settings states
  const [showWidget, setShowWidget] = useState(!!settings.showWidget);
  const [leakAlert, setLeakAlert] = useState(settings.leakAlert ?? true);
  const [cost, setCost] = useState(settings.cost ? String(settings.cost) : '');
  const [currency, setCurrency] = useState(settings.currency || (lang === 'en' ? 'EGP' : 'ج.م'));
  const [nightEnabled, setNightEnabled] = useState(!!settings.nightEnabled);
  const [nightStart, setNightStart] = useState(String(settings.nightStart ?? 2));
  const [nightEnd, setNightEnd] = useState(String(settings.nightEnd ?? 8));
  const [nightDeduct, setNightDeduct] = useState(!!settings.nightDeduct);
  const [ecoMode, setEcoMode] = useState(!!settings.ecoMode);

  const toggle = (v: number) => setAlerts((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));
  const q = Number(quota), d = Number(day);
  const valid = q > 0 && Number.isInteger(d) && d >= 1 && d <= 31;

  const save = () => {
    const patch: Partial<Settings> = {
      quotaGB: q,
      cycleDay: d,
      alerts,
      autoStart,
      lang: newLang,
      showWidget,
      leakAlert,
      cost: cost ? Number(cost) : 0,
      currency,
      nightEnabled,
      nightStart: Number(nightStart),
      nightEnd: Number(nightEnd),
      nightDeduct,
      ecoMode,
    };
    if (isp.trim() !== '' && Number(isp) >= 0) {
      const { start } = cycleBounds(d, new Date());
      patch.offset = { cycle: dateKey(start), bytes: Number(isp) * GB - stats.tracked };
    }
    onSave(patch);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !firstRun && onCancel()}>
      <div className="dialog" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <h2>{firstRun ? t('welcome') : t('settingsTitle')}</h2>

        <label>{t('quota')}
          <input type="number" min="1" value={quota} onChange={(e) => setQuota(e.target.value)} autoFocus />
        </label>
        <label>{t('renewDay')}
          <input type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label>{t('ispUsage')}
          <input type="number" min="0" step="0.01" placeholder={t('ispPlaceholder')} value={isp} onChange={(e) => setIsp(e.target.value)} />
          <span className="note">{t('ispNote')}</span>
        </label>

        <div className="lbl">{t('alertsAt')}</div>
        <div className="chips">
          {[50, 80, 90, 95].map((v) => (
            <button key={v} type="button" className={`chip ${alerts.includes(v) ? 'on' : ''}`} onClick={() => toggle(v)}>{v}%</button>
          ))}
        </div>

        <div className="lbl">{t('language')}</div>
        <div className="chips">
          <button type="button" className={`chip ${newLang === 'ar' ? 'on' : ''}`} onClick={() => { setNewLang('ar'); if (!cost) setCurrency('ج.م'); }}>العربية</button>
          <button type="button" className={`chip ${newLang === 'en' ? 'on' : ''}`} onClick={() => { setNewLang('en'); if (!cost) setCurrency('EGP'); }}>English</button>
        </div>

        <div className="settings-section">
          <div className="lbl" style={{ marginTop: 14 }}>{t('costTitle')}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 2 }}>{t('planCost')}
              <input type="number" min="0" placeholder="مثال: 250" value={cost} onChange={(e) => setCost(e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>{t('currency')}
              <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="settings-section">
          <div className="lbl" style={{ marginTop: 14 }}>{t('nightTitle')}</div>
          <label className="check">
            <input type="checkbox" checked={nightEnabled} onChange={(e) => setNightEnabled(e.target.checked)} />
            {t('nightEnabled')}
          </label>
          {nightEnabled && (
            <div style={{ paddingInlineStart: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ flex: 1 }}>من الساعة
                  <input type="number" min="0" max="23" value={nightStart} onChange={(e) => setNightStart(e.target.value)} />
                </label>
                <label style={{ flex: 1 }}>إلى الساعة
                  <input type="number" min="0" max="23" value={nightEnd} onChange={(e) => setNightEnd(e.target.value)} />
                </label>
              </div>
              <label className="check">
                <input type="checkbox" checked={!nightDeduct} onChange={(e) => setNightDeduct(!e.target.checked)} />
                {t('nightFree')}
              </label>
            </div>
          )}
        </div>

        <div className="settings-section" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          <label className="check">
            <input type="checkbox" checked={showWidget} onChange={(e) => setShowWidget(e.target.checked)} />
            <span><b>{t('widgetTitle')}</b> — <span className="muted">{t('widgetDesc')}</span></span>
          </label>
          <label className="check">
            <input type="checkbox" checked={leakAlert} onChange={(e) => setLeakAlert(e.target.checked)} />
            <span><b>{t('leakAlert')}</b></span>
          </label>
          <label className="check">
            <input type="checkbox" checked={ecoMode} onChange={(e) => setEcoMode(e.target.checked)} />
            <span><b>{t('ecoMode')}</b> — <span className="muted">{t('ecoModeDesc')}</span></span>
          </label>
          <label className="check">
            <input type="checkbox" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} />
            {t('autoStart')}
          </label>
        </div>

        <div className="actions" style={{ marginTop: 18 }}>
          {!firstRun && <button className="btn ghost" onClick={onCancel}>{t('cancel')}</button>}
          <button className="btn primary" disabled={!valid} onClick={save}>{t('save')}</button>
        </div>
      </div>
    </div>
  );
}
