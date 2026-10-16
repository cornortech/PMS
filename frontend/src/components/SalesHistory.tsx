// =====================================================================
// 📈 TOTAL SALES — same as "Daily Sales Overview" in Atithi RMS
//  • Total sales, completed bills, sales days
//  • Daily records: one row per day → "View Bill" (all bills of that day, print summary) or Excel
//  • Medicines sold in the period
//  • Old bills from before the update are included (marked "old")
// =====================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Banknote, CalendarDays, Download, FileSpreadsheet, Pill, Printer, ReceiptText, RefreshCw, Search, ShieldCheck,
  ShoppingBag, Sparkles, TrendingUp,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/app';
import { addDays, cx, dayKey, downloadCsv, fmtDate, fmtDateTime, fmtTime, npr, todayKey } from '../lib/format';
import { printReport } from '../lib/print';
import type { Sale } from '../lib/types';
import BillModal, { StatusBadge } from './BillModal';
import { Badge, ErrorBox, Modal, Spinner } from './ui';

type Range = 'today' | '7d' | '30d' | '90d' | 'custom';
type Day = { key: string; bs: string; bills: Sale[]; live: Sale[]; paid: number; due: number; total: number; vat: number; profit: number; cancelled: number };

const money = (n: number) => (Number(n) || 0).toFixed(2);
const sum = (arr: Sale[], f: (s: Sale) => number) => arr.reduce((t, s) => t + (Number(f(s)) || 0), 0);

export default function SalesHistory({ onChange }: { onChange?: () => void }) {
  const { isManager, pharmacy } = useApp();
  const [range, setRange] = useState<Range>('30d');
  const [from, setFrom] = useState(addDays(todayKey(), -29));
  const [to, setTo] = useState(todayKey());
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [day, setDay] = useState<Day | null>(null);
  const [open, setOpen] = useState<Sale | null>(null);
  const [medQ, setMedQ] = useState('');

  useEffect(() => {
    const t = todayKey();
    if (range === 'today') { setFrom(t); setTo(t); }
    if (range === '7d') { setFrom(addDays(t, -6)); setTo(t); }
    if (range === '30d') { setFrom(addDays(t, -29)); setTo(t); }
    if (range === '90d') { setFrom(addDays(t, -89)); setTo(t); }
  }, [range]);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    const r = await api<Sale[]>(`/sales?from=${from}&to=${to}&legacy=1`);
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setSales(r.data);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  // ---------- group by day ----------
  const days = useMemo<Day[]>(() => {
    const map = new Map<string, Sale[]>();
    for (const s of sales) {
      const k = dayKey(s.createdAt);
      map.set(k, [...(map.get(k) || []), s]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, bills]) => {
        const live = bills.filter((s) => s.status !== 'cancelled');
        return {
          key,
          bs: bills.find((b) => b.dateBS)?.dateBS || '',
          bills,
          live,
          paid: live.filter((s) => s.status === 'paid').length,
          due: live.filter((s) => s.status === 'pending').length,
          total: sum(live, (s) => s.grandTotal),
          vat: sum(live, (s) => s.vatAmount),
          profit: sum(live.filter((s) => !s.legacy), (s) => s.profit),
          cancelled: bills.length - live.length,
        };
      });
  }, [sales]);

  const live = sales.filter((s) => s.status !== 'cancelled');
  const paidBills = live.filter((s) => s.status === 'paid');
  const due = live.filter((s) => s.status === 'pending');

  const meds = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; amount: number; bills: number }>();
    for (const s of live) {
      for (const i of s.items) {
        const cur = map.get(i.name) || { name: i.name, qty: 0, amount: 0, bills: 0 };
        cur.qty += i.quantity;
        cur.amount += i.total;
        cur.bills += 1;
        map.set(i.name, cur);
      }
    }
    const t = medQ.trim().toLowerCase();
    return [...map.values()].filter((m) => !t || m.name.toLowerCase().includes(t)).sort((a, b) => b.amount - a.amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, medQ]);

  // ---------- downloads / printing ----------
  const billRow = (s: Sale) => [
    s.invoiceNo, fmtDateTime(s.createdAt), s.dateBS || '', s.customerName, s.customerPhone || '',
    s.items.map((i) => `${i.name} x${i.quantity}`).join('; '),
    money(s.subTotal), money(s.discount), money(s.vatAmount), money(s.grandTotal),
    s.status === 'pending' ? 'Due' : s.paymentMethod, s.status, ...(isManager ? [s.legacy ? '' : money(s.profit)] : []), s.soldBy || '',
  ];
  const billHead = ['Bill no', 'Date & time', 'BS date', 'Customer', 'Phone', 'Medicines', 'Sub total', 'Discount', 'VAT', 'Total', 'Payment', 'Status', ...(isManager ? ['Profit'] : []), 'Billed by'];

  const downloadDay = (d: Day) => downloadCsv(`sales_${d.key}.csv`, [billHead, ...d.bills.map(billRow)]);
  const downloadAll = () =>
    downloadCsv(`daily-sales_${from}_to_${to}.csv`, [
      ['Date', 'BS date', 'Bills', 'Paid bills', 'Due bills', 'Cancelled', 'VAT', 'Total sales', ...(isManager ? ['Profit'] : [])],
      ...days.map((d) => [fmtDate(d.key), d.bs, d.live.length, d.paid, d.due, d.cancelled, money(d.vat), money(d.total), ...(isManager ? [money(d.profit)] : [])]),
      [],
      ['TOTAL', '', live.length, paidBills.length, due.length, sales.length - live.length, money(sum(live, (s) => s.vatAmount)), money(sum(live, (s) => s.grandTotal)), ...(isManager ? [money(sum(live.filter((s) => !s.legacy), (s) => s.profit))] : [])],
    ]);
  const downloadMeds = () =>
    downloadCsv(`medicines-sold_${from}_to_${to}.csv`, [['Medicine', 'Quantity', 'Bills', 'Amount (Rs)'], ...meds.map((m) => [m.name, m.qty, m.bills, money(m.amount)])]);

  const printDay = (d: Day) => {
    const byMethod = d.live.filter((s) => s.status === 'paid').reduce<Record<string, number>>((m, s) => ({ ...m, [s.paymentMethod]: (m[s.paymentMethod] || 0) + s.grandTotal }), {});
    printReport({
      title: 'Daily Sales Summary',
      subtitle: `${fmtDate(d.key)}${d.bs ? ` · ${d.bs} BS` : ''}`,
      pharmacy,
      head: ['Bill no', 'Time', 'Customer', 'Payment', 'Status', 'VAT', 'Total'],
      rows: [...d.bills].reverse().map((s) => [s.invoiceNo, fmtTime(s.createdAt), s.customerName, s.status === 'pending' ? 'Due' : s.paymentMethod, s.status, money(s.vatAmount), money(s.grandTotal)]),
      numCols: [5, 6],
      totals: [
        ...Object.entries(byMethod).map(([m, v]) => [`Paid by ${m}`, `Rs ${money(v)}`] as [string, string]),
        ['Due (not paid)', `Rs ${money(sum(d.live.filter((s) => s.status === 'pending'), (s) => s.grandTotal))}`],
        ['VAT', `Rs ${money(d.vat)}`],
        ['TOTAL SALES', `Rs ${money(d.total)}`],
        ['Cancelled bills', String(d.cancelled)],
      ],
    });
  };

  const rangeLabel = from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-200/70 bg-gradient-to-r from-purple-100/80 via-violet-50 to-indigo-100/80 p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-5">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-purple-600 shadow-md"><CalendarDays className="h-6 w-6" /></span>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-700">
                <Sparkles className="h-3 w-3" /> Sales analytics
              </span>
              <h1 className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Daily Sales Overview</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-600"><ShieldCheck className="h-4 w-4 text-purple-500" /> {pharmacy.pharmacyName} · {rangeLabel}</p>
            </div>
          </div>
          <button onClick={load} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 text-sm font-bold text-purple-700 shadow-sm hover:bg-purple-50">
            <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      {/* Period */}
      <div className="flex flex-wrap items-center gap-2">
        {([['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['custom', 'Pick dates']] as [Range, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setRange(v)} aria-pressed={range === v} className={cx('cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition', range === v ? 'border-purple-600 bg-purple-600 text-white shadow' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-200')}>{l}</button>
        ))}
        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm" aria-label="From date" />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" value={to} min={from} max={todayKey()} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm" aria-label="To date" />
          </div>
        )}
      </div>

      {/* 3 big cards (RMS) */}
      <div className="grid gap-4 md:grid-cols-3">
        <BigStat tone="emerald" label="Total sales revenue" value={npr(sum(live, (s) => s.grandTotal))} foot={`${npr(sum(paidBills, (s) => s.grandTotal))} received`} icon={Banknote} />
        <BigStat tone="purple" label="Completed bills" value={String(paidBills.length)} foot={due.length ? `${due.length} still pending` : 'Successfully paid bills'} icon={ShoppingBag} />
        <BigStat tone="indigo" label="Active sales days" value={String(days.length)} foot="Days with at least one bill" icon={TrendingUp} />
      </div>

      <div className={cx('grid gap-3', isManager ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3')}>
        <Mini label="Due (not paid)" value={npr(sum(due, (s) => s.grandTotal))} tone="text-amber-700" />
        <Mini label="VAT on bills" value={npr(sum(live, (s) => s.vatAmount))} tone="text-sky-700" />
        {isManager && <Mini label="Profit" value={npr(sum(live.filter((s) => !s.legacy), (s) => s.profit))} tone="text-emerald-700" />}
        <Mini label="Cancelled bills" value={String(sales.length - live.length)} tone="text-rose-600" />
      </div>

      {/* Daily records */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Daily Records Breakdown</h2>
            <p className="text-xs text-slate-500">See a day’s bills and print its summary with “View Bill”, or download it as an Excel file.</p>
          </div>
          <button onClick={downloadAll} disabled={!days.length} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
            <Download className="h-4 w-4" /> Download all days (Excel)
          </button>
        </div>
        {loading && !sales.length ? (
          <Spinner />
        ) : error ? (
          <div className="p-5"><ErrorBox message={error} onRetry={load} /></div>
        ) : days.length === 0 ? (
          <div className="m-5 mt-0 rounded-2xl border-2 border-dashed border-purple-100 p-10 text-center">
            <ReceiptText className="mx-auto mb-2 h-7 w-7 text-purple-300" />
            <p className="font-bold text-slate-700">No sales in these dates</p>
            <p className="text-sm text-slate-500">Bills appear here as soon as they are made.</p>
          </div>
        ) : (
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-y border-slate-100 bg-slate-50/70 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Business date</th>
                  <th className="px-4 py-3">Total bills</th>
                  <th className="px-4 py-3">Paid / Due</th>
                  <th className="px-4 py-3">Total daily sales</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {days.map((d) => (
                  <tr key={d.key} className="hover:bg-purple-50/30">
                    <td className="px-6 py-4">
                      <span className="inline-block rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-800">{fmtDate(d.key)}</span>
                      {d.bs && <span className="ml-2 text-[11px] text-slate-400">{d.bs} BS</span>}
                    </td>
                    <td className="px-4 py-4 font-mono text-sm text-slate-700">{d.live.length} bills{d.cancelled > 0 && <span className="ml-1 text-[11px] text-rose-500">(+{d.cancelled} cancelled)</span>}</td>
                    <td className="px-4 py-4 text-xs"><span className="font-bold text-emerald-700">{d.paid} paid</span>{d.due > 0 && <span className="ml-2 font-bold text-amber-700">{d.due} due</span>}</td>
                    <td className="px-4 py-4 font-mono text-sm font-black text-purple-700">{npr(d.total)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <button onClick={() => setDay(d)} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 text-xs font-bold text-white shadow-sm hover:shadow-md">
                          <ReceiptText className="h-3.5 w-3.5" /> View Bill
                        </button>
                        <button onClick={() => downloadDay(d)} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Medicines sold */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><Pill className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Medicines sold</h2>
              <p className="text-xs text-slate-500">{rangeLabel} · cancelled bills not counted</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={medQ} onChange={(e) => setMedQ(e.target.value)} placeholder="Find a medicine" autoComplete="off" name="ah-sold-search" className="h-10 w-48 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-purple-500" aria-label="Find medicine" />
            </div>
            <button onClick={downloadMeds} disabled={!meds.length} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
              <Download className="h-3.5 w-3.5" /> Excel
            </button>
          </div>
        </div>
        {meds.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-slate-400">{loading ? 'Loading…' : 'No medicines sold in these dates.'}</p>
        ) : (
          <div className="thin-scroll max-h-[420px] overflow-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="sticky top-0 border-y border-slate-100 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr><th className="px-6 py-3">Medicine</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3 text-right">Bills</th><th className="px-6 py-3 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meds.map((m, i) => (
                  <tr key={m.name}>
                    <td className="px-6 py-2.5 font-semibold text-slate-800"><span className="mr-2 inline-block w-5 font-mono text-[11px] text-slate-400">{i + 1}</span>{m.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{m.qty}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500">{m.bills}</td>
                    <td className="px-6 py-2.5 text-right font-mono font-bold text-purple-700">{npr(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* One day */}
      <Modal
        open={!!day}
        onClose={() => setDay(null)}
        width="max-w-4xl"
        title={day ? `Sales of ${fmtDate(day.key)}` : ''}
        subtitle={day ? `${day.bs ? `${day.bs} BS · ` : ''}${day.live.length} bills · ${npr(day.total)}` : ''}
        footer={day && (
          <>
            <button onClick={() => downloadDay(day)} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-100"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
            <button onClick={() => printDay(day)} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 text-sm font-bold text-white shadow-sm"><Printer className="h-4 w-4" /> Print day summary</button>
          </>
        )}
      >
        {day && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(day.live.filter((s) => s.status === 'paid').reduce<Record<string, number>>((m, s) => ({ ...m, [s.paymentMethod]: (m[s.paymentMethod] || 0) + s.grandTotal }), {})).map(([m, v]) => (
                <span key={m} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"><b className="text-slate-500">{m}</b> <span className="ml-1 font-mono font-bold">{npr(v)}</span></span>
              ))}
              {day.due > 0 && <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Due {npr(sum(day.live.filter((s) => s.status === 'pending'), (s) => s.grandTotal))}</span>}
            </div>
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/70">
              {day.bills.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setOpen(s)} className={cx('flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-purple-50/50', s.status === 'cancelled' && 'opacity-60')}>
                    <div className="min-w-0 flex-1">
                      <p className={cx('font-mono text-xs font-bold text-slate-900', s.status === 'cancelled' && 'line-through')}>{s.invoiceNo} <span className="ml-1 font-sans font-normal text-slate-400">{fmtTime(s.createdAt)}</span></p>
                      <p className="truncate text-xs text-slate-500">{s.customerName} · {s.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge sale={s} />
                      {s.legacy && <Badge>old</Badge>}
                      <span className="w-24 text-right font-mono text-sm font-bold text-purple-700">{npr(s.grandTotal)}</span>
                      <ArrowRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      <BillModal sale={open} onClose={() => setOpen(null)} onChanged={(s) => { setOpen(s); load(); onChange?.(); setDay(null); }} />
    </div>
  );
}

function BigStat({ tone, label, value, foot, icon: Icon }: { tone: 'emerald' | 'purple' | 'indigo'; label: string; value: string; foot: string; icon: React.ComponentType<{ className?: string }> }) {
  const t = {
    emerald: { box: 'border-emerald-200 from-emerald-50 to-white', text: 'text-emerald-700', icon: 'bg-emerald-100 text-emerald-600' },
    purple: { box: 'border-purple-200 from-purple-50 to-white', text: 'text-purple-700', icon: 'bg-purple-100 text-purple-600' },
    indigo: { box: 'border-indigo-200 from-indigo-50 to-white', text: 'text-indigo-700', icon: 'bg-indigo-100 text-indigo-600' },
  }[tone];
  return (
    <div className={cx('relative rounded-3xl border bg-gradient-to-br p-6 shadow-sm', t.box)}>
      <p className={cx('text-[11px] font-black uppercase tracking-wider', t.text)}>{label}</p>
      <p className="mt-2 font-display text-3xl font-black tracking-tight text-slate-900">{value}</p>
      <p className={cx('mt-3 flex items-center gap-1 text-xs font-bold', t.text)}>{foot} <ArrowRight className="h-3.5 w-3.5" /></p>
      <span className={cx('absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl', t.icon)}><Icon className="h-5 w-5" /></span>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cx('mt-0.5 font-mono text-base font-black', tone)}>{value}</p>
    </div>
  );
}
