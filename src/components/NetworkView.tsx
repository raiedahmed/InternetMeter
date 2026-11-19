import { useEffect, useState } from 'react';
import { api, type NetScanResult } from '../api';
import { useI18n } from '../i18n';

export default function NetworkView() {
  const { t } = useI18n();
  const [data, setData] = useState<NetScanResult | null>(null);
  const [loading, setLoading] = useState(false);

  const scan = async () => {
    setLoading(true);
    try {
      const res = await api.scanNetwork();
      setData(res);
    } catch {
      // Mock or error fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scan();
  }, []);

  return (
    <div className="network-view">
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>📡 {t('netScan')}</h3>
            <div className="muted">{t('netNote')}</div>
          </div>
          <button className="btn" disabled={loading} onClick={scan}>
            {loading ? t('scanning') : `🔄 ${t('netScanBtn')}`}
          </button>
        </div>
      </div>

      {data && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div className="badge ok" style={{ fontSize: '1.1rem', padding: '6px 14px' }}>
              {t('netDevicesCount', { n: data.count })}
            </div>
            {data.gateway && (
              <div className="muted">
                {t('netRouter')}: <b dir="ltr">{data.gateway}</b>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <table className="table" style={{ width: '100%', textAlign: 'start' }}>
          <thead>
            <tr>
              <th>{t('netDevice')}</th>
              <th>{t('ipAddr')}</th>
              <th>{t('netMac')}</th>
              <th>{t('netAlloc')}</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {(!data || data.devices.length === 0) ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px' }} className="muted">
                  {loading ? t('scanning') : t('noData')}
                </td>
              </tr>
            ) : (
              data.devices.map((dev) => {
                const isRouter = dev.type === 'router' || dev.ip === data.gateway;
                return (
                  <tr key={dev.ip}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.2rem' }}>{isRouter ? '🌐' : '📱'}</span>
                        <b>{isRouter ? t('netRouter') : t('netDevice')}</b>
                      </div>
                    </td>
                    <td><code dir="ltr">{dev.ip}</code></td>
                    <td><code dir="ltr">{dev.mac}</code></td>
                    <td><span className="muted">{dev.alloc || 'dynamic'}</span></td>
                    <td><span className="pill ok" style={{ fontSize: '0.75rem' }}>متصل الآن</span></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
