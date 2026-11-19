const U = ['B', 'KB', 'MB', 'GB', 'TB'];

export function fmtBytes(b: number, digits = 2): string {
  const neg = b < 0;
  let v = Math.abs(b), i = 0;
  while (v >= 1024 && i < U.length - 1) { v /= 1024; i++; }
  return `${neg ? '-' : ''}${v.toFixed(i === 0 ? 0 : digits)} ${U[i]}`;
}

export const fmtSpeed = (b: number) => fmtBytes(b, 1) + '/s';

export const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
