// =====================================================================
// 📊 DASHBOARD (Manager)
// Money received today (paid bills only), profit, money still due,
// last 7 days, payment methods, top medicines, stock + expiry alerts.
// =====================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, CalendarDays, Hourglass, LayoutDashboard, PackageX, ReceiptText, RefreshCw, ShoppingCart, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import SubscriptionCard from './SubscriptionCard';
import { api } from '../lib/api';
import { useApp } from '../lib/app';
import { cx, daysUntil, fmtExpiry, fmtTime, npr, nprShort } from '../lib/format';
import type { Sale } from '../lib/types';
import BillModal, { StatusBadge } from './BillModal';
import { Button, Card, Chips, Empty, ErrorBox, Spinner, Stat } from './ui';

const CHART = '#9333EA'; // purple bars (checked for contrast and colour-blind safety)

type Brief = { id: string; name: string; stock: number; reorderLevel: number; expiryDate: string };
type Summary = {
  today: { revenue: number; billed: number; bills: number; profit: number; due: number };
  last30: { revenue: number; profit: number; bills: number; cancelled: number };
  pending: { amount: number; count: number };
  days: { day: string; revenue: number; bills: number }[];
  topMedicines: { name: string; quantity: number; amount: number }[];
  payments: Record<string, number>;
  stock: {
    medicines: number; costValue: number; retailValue: number;
    lowStock: Brief[]; lowStockCount: number; outOfStockCount: number;
    expired: Brief[]; expiredCount: number; expiring: Brief[]; expiringCount: number; expiryAlertDays: number;
  };
  recentSales: Sale[];
};

const dayLabel = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short' });
const dayFull = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short' });

export default function Dashboard() {
  const { staff, go, can, plan, pharmacy } = useApp();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [alertTab, setAlertTab] = useState<'expired' | 'expiring' | 'low'>('expired');
  const [open, setOpen] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const r = await api<Summary>('/dashboard/summary');
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setData(r.data);
    setAlertTab(r.data.stock.expiredCount ? 'expired' : r.data.stock.expiringCount ? 'expiring' : 'low');
  }, []);
  useEffect(() => { load(); }, [load]);

  const hour = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', hour: '2-digit', hour12: false }));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading && !data) return <Spinner label="Loading dashboard…" />;
  if (error && !data) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return null;
  const s = data.stock;
  const alertList = alertTab === 'expired' ? s.expired : alertTab === 'expiring' ? s.expiring : s.lowStock;

  return (
    <div>
      {/* Header (same as RMS) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-purple-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live system feed
            </p>
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {greet}, {staff.staffName?.split(' ')[0] || staff.id} <Sparkles className="h-6 w-6 text-amber-400" />
            </h1>
            <p className="text-sm text-slate-500">Stats overview for {pharmacy.pharmacyName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-2 rounded-xl border border-purple-100 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-600 sm:inline-flex">
            <CalendarDays className="h-4 w-4 text-purple-500" />
            {new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kathmandu', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button onClick={load} disabled={loading} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-purple-100 bg-white text-purple-600 transition hover:bg-purple-50 disabled:opacity-60" aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {can('sale') && <Button onClick={() => go('sale')} icon={<ShoppingCart className="h-4 w-4" />}>New sale</Button>}
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Money received today"
          value={npr(data.today.revenue)}
          icon={<Wallet className="h-4 w-4" />}
          note={`${data.today.bills} bill${data.today.bills === 1 ? '' : 's'} today${data.today.due > 0 ? ` · ${npr(data.today.due)} given on due` : ''}`}
          onClick={() => go('sales')}
        />
        <Stat label="Profit today" value={npr(data.today.profit)} tone="ink" icon={<TrendingUp className="h-4 w-4" />} note={`Last 30 days: ${nprShort(data.last30.profit)}`} />
        <Stat
          label="Due to collect"
          value={npr(data.pending.amount)}
          tone="amber"
          icon={<Hourglass className="h-4 w-4" />}
          note={`${data.pending.count} unpaid bill${data.pending.count === 1 ? '' : 's'}`}
          onClick={() => go('pending')}
        />
        <Stat
          label="Stock alerts"
          value={String(s.expiredCount + s.expiringCount + s.lowStockCount)}
          tone={s.expiredCount ? 'red' : 'amber'}
          icon={<AlertTriangle className="h-4 w-4" />}
          note={`${s.expiredCount} expired · ${s.expiringCount} expiring · ${s.lowStockCount} low`}
          onClick={() => go('medicines')}
        />
      </div>

      {/* Subscription (days remaining), same as RMS */}
      <div className="mt-4">
        <SubscriptionCard loading={!plan} total={plan?.totalTime ?? 0} remaining={plan?.remainingTime ?? null} pharmacyId={pharmacy.id} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* 7-day revenue */}
        <Card className="p-5 xl:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold">Money received, last 7 days</h2>
              <p className="text-xs text-ink/50">Paid bills, counted on the day the money came in</p>
            </div>
            <p className="text-sm text-ink/60">30 days: <b className="text-ink tabular">{nprShort(data.last30.revenue)}</b> · {data.last30.bills} bills</p>
          </div>
          <WeekChart days={data.days} />
        </Card>

        {/* Payment methods */}
        <Card className="p-5">
          <h2 className="font-display text-base font-bold">How customers paid</h2>
          <p className="text-xs text-ink/50">Last 30 days, paid bills</p>
          <HBars rows={Object.entries(data.payments).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, text: nprShort(v) }))} empty="No paid bills yet" />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Alerts */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold">Needs attention</h2>
            <button onClick={() => go('medicines')} className="cursor-pointer text-xs font-semibold text-green hover:underline">All medicines</button>
          </div>
          <Chips<'expired' | 'expiring' | 'low'>
            className="mt-3"
            value={alertTab}
            onChange={setAlertTab}
            options={[
              { value: 'expired', label: 'Expired', count: s.expiredCount },
              { value: 'expiring', label: `${s.expiryAlertDays} days`, count: s.expiringCount },
              { value: 'low', label: 'Low', count: s.lowStockCount },
            ]}
          />
          {alertList.length === 0 ? (
            <Empty title={alertTab === 'low' ? 'Stock levels look fine' : 'Nothing here'} text={alertTab === 'expired' ? 'No expired medicine on the shelf.' : undefined} />
          ) : (
            <ul className="mt-3 divide-y divide-foil/50">
              {alertList.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', alertTab === 'low' ? 'bg-amber/12 text-[#9a6a00]' : alertTab === 'expired' ? 'bg-danger/10 text-danger' : 'bg-amber/12 text-[#9a6a00]')}>
                      {alertTab === 'low' ? <PackageX className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{m.name}</p>
                      <p className="text-[11px] text-ink/50">{m.stock} in stock{alertTab === 'low' ? ` · alert at ${m.reorderLevel}` : ''}</p>
                    </div>
                  </div>
                  {alertTab !== 'low' && (
                    <div className="text-right">
                      <p className={cx('font-mono text-xs font-bold', alertTab === 'expired' ? 'text-danger' : 'text-[#9a6a00]')}>{fmtExpiry(m.expiryDate)}</p>
                      <p className="text-[10px] text-ink/45">{alertTab === 'expired' ? `${-daysUntil(m.expiryDate)}d ago` : `${daysUntil(m.expiryDate)}d left`}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Top medicines */}
        <Card className="p-5">
          <h2 className="font-display text-base font-bold">Top medicines</h2>
          <p className="text-xs text-ink/50">Most sold in the last 30 days (quantity)</p>
          <HBars rows={data.topMedicines.map((t) => ({ label: t.name, value: t.quantity, text: `${t.quantity} · ${nprShort(t.amount)}` }))} empty="No sales yet" />
        </Card>

        {/* Recent bills */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Recent bills</h2>
            <button onClick={() => go('sales')} className="cursor-pointer text-xs font-semibold text-green hover:underline">Total sales</button>
          </div>
          {data.recentSales.length === 0 ? (
            <Empty icon={<ReceiptText className="h-6 w-6" />} title="No bills yet" text="Bills from New Sale show up here." />
          ) : (
            <ul className="mt-2 divide-y divide-foil/50">
              {data.recentSales.map((b) => (
                <li key={b.id}>
                  <button onClick={() => setOpen(b)} className="flex w-full cursor-pointer items-center justify-between gap-3 py-2.5 text-left hover:bg-paper">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{b.customerName}</p>
                      <p className="font-mono text-[11px] text-ink/45">{b.invoiceNo} · {fmtTime(b.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular">{npr(b.grandTotal)}</span>
                      <StatusBadge sale={b} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Stock value strip */}
      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 rounded-2xl bg-ink px-5 py-4 text-sm text-white/70">
        <span><b className="text-white tabular">{s.medicines}</b> medicines</span>
        <span>Stock at cost <b className="text-white tabular">{nprShort(s.costValue)}</b></span>
        <span>At selling price <b className="text-white tabular">{nprShort(s.retailValue)}</b></span>
        <span><b className="text-white tabular">{s.outOfStockCount}</b> out of stock</span>
        {data.last30.cancelled > 0 && <span><b className="text-white tabular">{data.last30.cancelled}</b> bills cancelled (30 days)</span>}
      </div>

      <BillModal sale={open} onClose={() => setOpen(null)} onChanged={(x) => { setOpen(x); load(); }} />
    </div>
  );
}

// Vertical bars, one per day, with a hover tooltip and the value on the tallest + today
function WeekChart({ days }: { days: Summary['days'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const nice = (() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / p) * p;
  })();
  const ticks = [0, nice / 2, nice];
  const peak = days.reduce((m, d, i) => (d.revenue > days[m].revenue ? i : m), 0);
  const H = 180;
  return (
    <div className="mt-5">
      <div className="relative flex" style={{ height: H + 24 }}>
        {/* y axis */}
        <div className="relative w-12 shrink-0 text-right text-[10px] text-ink/40 tabular" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-2 -translate-y-1/2" style={{ top: H - (t / nice) * H }}>
              {t >= 1000 ? `${Math.round(t / 100) / 10}K` : Math.round(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-ink/8" style={{ top: H - (t / nice) * H }} />
          ))}
          <div className="absolute inset-x-0 top-0 flex items-end gap-0.5" style={{ height: H }}>
            {days.map((d, i) => {
              const h = (d.revenue / nice) * H;
              const isToday = i === days.length - 1;
              const showLabel = d.revenue > 0 && (i === peak || isToday);
              return (
                <div
                  key={d.day}
                  className="relative flex h-full flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${dayFull(d.day)}: ${npr(d.revenue)}, ${d.bills} bills`}
                >
                  {showLabel && hover !== i && (
                    <span className="absolute z-[1] whitespace-nowrap text-[10px] font-semibold text-ink/70 tabular" style={{ bottom: Math.max(h, 2) + 4 }}>
                      {nprShort(d.revenue).replace('Rs ', '')}
                    </span>
                  )}
                  <div
                    className="w-full max-w-6 rounded-t transition-[height,opacity] duration-500"
                    style={{ height: Math.max(h, d.revenue > 0 ? 3 : 0), background: CHART, opacity: hover === null || hover === i ? 1 : 0.45 }}
                  />
                  {d.revenue === 0 && <div className="absolute bottom-0 h-px w-6 bg-ink/20" />}
                  {hover === i && (
                    <div className="absolute z-10 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-lg" style={{ bottom: Math.max(h, 2) + 8 }}>
                      <p className="font-semibold">{dayFull(d.day)}</p>
                      <p className="tabular">{npr(d.revenue)} · {d.bills} bill{d.bills === 1 ? '' : 's'}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="absolute inset-x-0 flex gap-0.5" style={{ top: H + 6 }}>
            {days.map((d, i) => (
              <span key={d.day} className={cx('flex-1 text-center text-[11px]', i === days.length - 1 ? 'font-bold text-ink' : 'text-ink/45')}>
                {i === days.length - 1 ? 'Today' : dayLabel(d.day)}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* the same numbers as a table, for screen readers */}
      <table className="sr-only">
        <caption>Money received per day</caption>
        <tbody>{days.map((d) => <tr key={d.day}><th>{d.day}</th><td>{npr(d.revenue)}</td><td>{d.bills} bills</td></tr>)}</tbody>
      </table>
    </div>
  );
}

// Horizontal bars with the value written at the end (one colour: magnitude only)
function HBars({ rows, empty }: { rows: { label: string; value: number; text: string }[]; empty: string }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-ink/45">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.text}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-ink/80">{r.label}</span>
            <span className="shrink-0 text-ink/60 tabular">{r.text}</span>
          </div>
          <div className="h-2.5 rounded-r bg-ink/5">
            <div className="h-full rounded-r" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: CHART }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
