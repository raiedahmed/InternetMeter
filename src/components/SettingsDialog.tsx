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

  const toggle = (v: number) => setAlerts((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));
  const q = Number(quota), d = Number(day);
  const valid = q > 0 && Number.isInteger(d) && d >= 1 && d <= 31;

  const save = () => {
    const patch: Partial<Settings> = { quotaGB: q, cycleDay: d, alerts, autoStart, lang: newLang };
    // مزامنة مع الرقم الذي تعرضه شركة الإنترنت: الفرق بينه وبين ما قاسه البرنامج يُحفظ كإزاحة للدورة الحالية
    if (isp.trim() !== '' && Number(isp) >= 0) {
      const { start } = cycleBounds(d, new Date());
      patch.offset = { cycle: dateKey(start), bytes: Number(isp) * GB - stats.tracked };
    }
    onSave(patch);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !firstRun && onCancel()}>
      <div className="dialog">
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
          <button type="button" className={`chip ${newLang === 'ar' ? 'on' : ''}`} onClick={() => setNewLang('ar')}>العربية</button>
          <button type="button" className={`chip ${newLang === 'en' ? 'on' : ''}`} onClick={() => setNewLang('en')}>English</button>
        </div>

        <label className="check">
          <input type="checkbox" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} />
          {t('autoStart')}
        </label>

        <div className="actions">
          {!firstRun && <button className="btn ghost" onClick={onCancel}>{t('cancel')}</button>}
          <button className="btn primary" disabled={!valid} onClick={save}>{t('save')}</button>
        </div>
      </div>
    </div>
  );
}
