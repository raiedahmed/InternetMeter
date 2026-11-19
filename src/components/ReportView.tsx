import { useState } from 'react';
import { fmtBytes, fromKey } from '../format';
import { useI18n } from '../i18n';
import type { Settings, Stats } from '../../shared/calc.mjs';

interface Props {
  settings: Settings;
  stats: Stats;
}

export default function ReportView({ settings, stats }: Props) {
  const { t, fmtDate } = useI18n();
  const [copied, setCopied] = useState(false);

  const startFormatted = fmtDate(fromKey(stats.startKey));
  const nextFormatted = fmtDate(fromKey(stats.nextKey));

  const copySummary = () => {
    const text = `=== ${t('reportTitle')} ===
${t('reportPeriod', { a: startFormatted, b: nextFormatted })}
----------------------------------------
• ${t('reportTotalQuota')}: ${settings.quotaGB} GB
• ${t('reportTotalUsed')}: ${fmtBytes(stats.used)} (${(stats.pct * 100).toFixed(1)}%)
• ${t('reportRemaining')}: ${fmtBytes(Math.max(0, stats.remaining))}
• ${t('reportDailyAvg')}: ${fmtBytes(stats.avgDaily)}
• ${t('safeDaily')}: ${fmtBytes(stats.dailySafe)}
• ${t('forecast')}: ${fmtBytes(stats.projected)}
${settings.cost ? `• ${t('planCost')}: ${settings.cost} ${stats.currency}` : ''}
${settings.cost ? `• ${t('costPerGB')}: ${stats.costPerGB.toFixed(2)} ${stats.currency}/GB` : ''}
${settings.nightEnabled ? `• ${t('nightStat')}: ${fmtBytes(stats.nightUsed)}` : ''}
----------------------------------------
تم الإنشاء عبر تطبيق عدّاد الإنترنت (Internet Meter)`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const exportCSV = () => {
    let csv = `Date,Download (Bytes),Upload (Bytes),Total (Bytes),Total (MB)\n`;
    for (const row of stats.series) {
      const mb = (row.total / (1024 * 1024)).toFixed(2);
      csv += `${row.key},${row.d},${row.u},${row.total},${mb}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `internet-meter-cycle-${stats.startKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="report-view">
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>📊 {t('reportTitle')}</h2>
            <div className="muted">{t('reportPeriod', { a: startFormatted, b: nextFormatted })}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={copySummary}>
              {copied ? `✓ ${t('reportCopied')}` : t('reportCopy')}
            </button>
            <button className="btn" onClick={exportCSV}>
              {t('reportCSV')}
            </button>
            <button className="btn primary" onClick={handlePrint}>
              {t('reportPrint')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="muted">{t('reportTotalQuota')}</div>
          <div className="val" dir="ltr">{settings.quotaGB} GB</div>
          <div className="hint">{t('cycle', { a: startFormatted, b: nextFormatted, n: stats.daysLeft })}</div>
        </div>
        <div className="card stat">
          <div className="muted">{t('reportTotalUsed')}</div>
          <div className="val" dir="ltr">{fmtBytes(stats.used)}</div>
          <div className="hint">{(stats.pct * 100).toFixed(1)}% من الباقة</div>
        </div>
        <div className="card stat">
          <div className="muted">{t('reportRemaining')}</div>
          <div className="val" dir="ltr">{fmtBytes(Math.max(0, stats.remaining))}</div>
          <div className="hint">حصة اليوم الآمنة: {fmtBytes(stats.dailySafe)}</div>
        </div>
        <div className="card stat">
          <div className="muted">{t('reportDailyAvg')}</div>
          <div className="val" dir="ltr">{fmtBytes(stats.avgDaily)}</div>
          <div className="hint">التوقع لنهاية الشهر: {fmtBytes(stats.projected)}</div>
        </div>
      </div>

      {settings.cost ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>💰 {t('costTitle')}</h3>
          <div className="grid">
            <div className="stat">
              <div className="muted">{t('planCost')}</div>
              <div className="val" dir="ltr">{settings.cost} {stats.currency}</div>
            </div>
            <div className="stat">
              <div className="muted">{t('costPerGB')}</div>
              <div className="val" dir="ltr">{stats.costPerGB.toFixed(2)} {stats.currency}</div>
            </div>
            <div className="stat">
              <div className="muted">{t('todayCost')}</div>
              <div className="val" dir="ltr">{stats.todayCost.toFixed(2)} {stats.currency}</div>
            </div>
            <div className="stat">
              <div className="muted">{t('projectedCost')}</div>
              <div className="val" dir="ltr">{stats.projectedCost.toFixed(2)} {stats.currency}</div>
            </div>
          </div>
        </div>
      ) : null}

      {settings.nightEnabled && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>🌙 {t('nightTitle')}</h3>
          <p className="muted">
            {t('nightStat')}: <b>{fmtBytes(stats.nightUsed)}</b> ({settings.nightDeduct ? 'مخصومة من الباقة' : 'ساعات مجانية غير مخصومة'})
          </p>
        </div>
      )}

      <div className="card">
        <h3>📅 الاستهلاك اليومي التفصيلي خلال هذه الدورة</h3>
        <table className="table" style={{ width: '100%', textAlign: 'start' }}>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>التحميل</th>
              <th>الرفع</th>
              <th>الإجمالي</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {stats.series.map((row) => (
              <tr key={row.key}>
                <td><code>{row.key}</code></td>
                <td><span className="down" dir="ltr">↓ {fmtBytes(row.d)}</span></td>
                <td><span className="up" dir="ltr">↑ {fmtBytes(row.u)}</span></td>
                <td><b dir="ltr">{fmtBytes(row.total)}</b></td>
                <td>
                  {row.total > stats.dailySafe ? (
                    <span className="pill warn" style={{ fontSize: '0.75rem' }}>فوق الحصة الآمنة</span>
                  ) : (
                    <span className="pill ok" style={{ fontSize: '0.75rem' }}>آمن</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
