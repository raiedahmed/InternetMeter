const U = ['B', 'KB', 'MB', 'GB', 'TB'];

export function fmtBytes(b: number, digits = 2): string {
  const neg = b < 0;
  let v = Math.abs(b), i = 0;
  while (v >= 1024 && i < U.length - 1) { v /= 1024; i++; }
  return `${neg ? '-' : ''}${v.toFixed(i === 0 ? 0 : digits)} ${U[i]}`;
}

export const fmtSpeed = (b: number) => fmtBytes(b, 1) + '/s';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const fmtDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const fmtDateTime = (d: Date) =>
  `${fmtDate(d)} الساعة ${d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
export const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
