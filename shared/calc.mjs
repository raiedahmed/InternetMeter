// منطق الحساب المشترك بين العملية الرئيسية (التنبيهات) والواجهة (العرض)
export const GB = 1024 ** 3;
export const DAY = 86400000;

const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const clampedDate = (y, m, day) => new Date(y, m, Math.min(day, daysInMonth(y, m)));

/** فحص هل الساعة ضمن نطاق الساعات الليلية */
export function isNightHour(hour, start, end) {
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

/** حدود دورة الفوترة التي تحتوي اليوم الحالي */
export function cycleBounds(cycleDay, now = new Date()) {
  const today = midnight(now);
  let start = clampedDate(today.getFullYear(), today.getMonth(), cycleDay);
  if (start > today) start = clampedDate(today.getFullYear(), today.getMonth() - 1, cycleDay);
  const next = clampedDate(start.getFullYear(), start.getMonth() + 1, cycleDay);
  return { start, next };
}

export function computeStats(settings, daily, now = new Date()) {
  const { start, next } = cycleBounds(settings.cycleDay, now);
  const today = midnight(now);
  const cycleLen = Math.round((next - start) / DAY);
  const startKey = dateKey(start);
  const quota = settings.quotaGB * GB;

  const nightEnabled = !!settings.nightEnabled;
  const nStart = settings.nightStart ?? 2;
  const nEnd = settings.nightEnd ?? 8;
  const nightDeduct = settings.nightDeduct ?? false; // الافتراضي: لا تُخصم من الباقة الأساسية

  let rawTracked = 0;
  let nightUsed = 0;
  const series = [];

  for (let i = 0; i < cycleLen; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (day > today) break;
    const key = dateKey(day);
    const v = daily[key] || { d: 0, u: 0 };
    const dayTotal = v.d + v.u;
    rawTracked += dayTotal;

    let dayNight = 0;
    if (nightEnabled && Array.isArray(v.h)) {
      for (let hr = 0; hr < 24; hr++) {
        if (isNightHour(hr, nStart, nEnd)) {
          dayNight += v.h[hr] || 0;
        }
      }
    }
    nightUsed += dayNight;
    series.push({ key, d: v.d, u: v.u, total: dayTotal, night: dayNight });
  }

  // إذا كانت الباقة الليلية مفعلة وغير مخصومة من الباقة، لا تحسب في المستخدم الأساسي
  const tracked = nightEnabled && !nightDeduct ? Math.max(0, rawTracked - nightUsed) : rawTracked;

  const offset = settings.offset && settings.offset.cycle === startKey ? settings.offset.bytes : 0;
  const used = Math.max(0, tracked + offset);
  const remaining = quota - used;
  const todayRec = daily[dateKey(today)] || { d: 0, u: 0 };

  const daysLeft = Math.max(1, Math.round((next - today) / DAY)); // يشمل اليوم الحالي
  const elapsedFloat = Math.max(1, (now - start) / DAY);
  const avgDaily = used / elapsedFloat;
  const projected = avgDaily * cycleLen;
  const dailySafe = Math.max(0, remaining) / daysLeft;

  let runOutDate = null;
  if (remaining <= 0) runOutDate = now;
  else if (avgDaily > 0 && remaining / avgDaily < (next - now) / DAY) {
    runOutDate = new Date(now.getTime() + (remaining / avgDaily) * DAY);
  }

  const pct = quota > 0 ? used / quota : 0;
  const status = remaining <= 0 ? 'over' : runOutDate ? 'danger' : pct > 0.8 ? 'warn' : 'ok';

  // الحساب المالي
  const cost = Number(settings.cost) || 0;
  const currency = settings.currency || (settings.lang === 'en' ? 'EGP' : 'ج.م');
  const costPerGB = (cost > 0 && settings.quotaGB > 0) ? (cost / settings.quotaGB) : 0;
  const todayCost = ((todayRec.d + todayRec.u) / GB) * costPerGB;
  const usedCost = (used / GB) * costPerGB;
  const projectedCost = (projected / GB) * costPerGB;

  return {
    quota, used, tracked, rawTracked, offset, remaining, pct, cycleLen, daysLeft, avgDaily, projected,
    dailySafe, runOutDate, status, startKey, nextKey: dateKey(next), series,
    todayUsed: todayRec.d + todayRec.u, todayDown: todayRec.d, todayUp: todayRec.u,
    nightUsed, costPerGB, todayCost, usedCost, projectedCost, currency,
  };
}
