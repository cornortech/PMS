// Money, dates and small helpers used everywhere

const nf = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** "Rs 1,23,456.50" */
export const npr = (n: number | null | undefined) => `Rs ${nf.format(Number(n) || 0)}`;
/** "Rs 1,23,457" — for big dashboard numbers */
export const nprShort = (n: number | null | undefined) => `Rs ${nf0.format(Math.round(Number(n) || 0))}`;

const TZ = 'Asia/Kathmandu';

/** Today in Nepal as "2026-10-15" */
export const todayKey = () => new Date(Date.now() + 345 * 60000).toISOString().slice(0, 10);
export const dayKey = (d: string | Date) => new Date(new Date(d).getTime() + 345 * 60000).toISOString().slice(0, 10);
export const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtDateTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
export const fmtTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }) : '';
/** "Oct 2027" — how expiry is printed on strips */
export const fmtExpiry = (d?: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short', year: 'numeric' }) : '—';

/** Days from today until a date (negative = already past) */
export const daysUntil = (d?: string | null) => {
  if (!d) return Infinity;
  const ms = new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${todayKey()}T00:00:00Z`).getTime();
  return Math.round(ms / 86400000);
};

export type ExpiryState = 'expired' | 'soon' | 'ok' | 'none';
export const expiryState = (d: string | null | undefined, alertDays = 90): ExpiryState => {
  if (!d) return 'none';
  const left = daysUntil(d);
  if (left < 0) return 'expired';
  if (left <= alertDays) return 'soon';
  return 'ok';
};

export const phoneDigits = (p: string) => (p || '').replace(/\D/g, '').slice(-10);

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Download rows as a CSV file (opens in Excel) */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop formulas running in Excel
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
