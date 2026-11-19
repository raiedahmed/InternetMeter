import { useState } from 'react';
import { GB, cycleBounds, dateKey, type Settings, type Stats } from '../../shared/calc.mjs';

interface Props {
  settings: Settings;
  stats: Stats;
  firstRun: boolean;
  onCancel(): void;
  onSave(patch: Partial<Settings>): void;
}

export default function SettingsDialog({ settings, stats, firstRun, onCancel, onSave }: Props) {
  const [quota, setQuota] = useState(String(settings.quotaGB));
  const [day, setDay] = useState(String(settings.cycleDay));
  const [isp, setIsp] = useState('');
  const [alerts, setAlerts] = useState<number[]>(settings.alerts);
  const [autoStart, setAutoStart] = useState(settings.autoStart);

  const toggle = (v: number) => setAlerts((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));
  const q = Number(quota), d = Number(day);
  const valid = q > 0 && Number.isInteger(d) && d >= 1 && d <= 31;

  const save = () => {
    const patch: Partial<Settings> = { quotaGB: q, cycleDay: d, alerts, autoStart };
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
        <h2>{firstRun ? 'مرحباً! لنُعدّ باقتك' : 'الإعدادات'}</h2>

        <label>سعة الباقة الشهرية (جيجابايت)
          <input type="number" min="1" value={quota} onChange={(e) => setQuota(e.target.value)} autoFocus />
        </label>
        <label>يوم تجديد الباقة من الشهر (1 – 31)
          <input type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label>الاستهلاك الحالي حسب شركة الإنترنت (جيجابايت) — اختياري
          <input type="number" min="0" step="0.01" placeholder="مثال: 85.4" value={isp} onChange={(e) => setIsp(e.target.value)} />
          <span className="note">يُستخدم لمعايرة البرنامج مع رقم الشركة، خاصةً إن كنت قد استهلكت جزءاً قبل التثبيت.</span>
        </label>

        <div className="lbl">تنبيهات عند بلوغ</div>
        <div className="chips">
          {[50, 80, 90, 95].map((v) => (
            <button key={v} type="button" className={`chip ${alerts.includes(v) ? 'on' : ''}`} onClick={() => toggle(v)}>{v}%</button>
          ))}
        </div>

        <label className="check">
          <input type="checkbox" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} />
          تشغيل البرنامج تلقائياً مع ويندوز
        </label>

        <div className="actions">
          {!firstRun && <button className="btn ghost" onClick={onCancel}>إلغاء</button>}
          <button className="btn primary" disabled={!valid} onClick={save}>حفظ</button>
        </div>
      </div>
    </div>
  );
}
