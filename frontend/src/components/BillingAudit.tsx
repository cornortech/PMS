// =====================================================================
// 🛡️ BILLING & VAT AUDIT — same as "Billing & VAT Audit" in Atithi RMS
//  • Payment mode breakdown: Cash drawer, eSewa, Khalti, Fonepay, Bank & Card, Pending
//  • Taxable amount and VAT collected (for the VAT return)
//  • Invoice history ledger: every bill made — search, filter, view, reprint
//  • VAT sales register: download (Excel) or print (A4)
// =====================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Banknote, Building2, Clock, CreditCard, Download, Eye, FileText, Printer, RefreshCw, Search, ShieldCheck, Smartphone,
  Sparkles, TrendingUp, Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/app';
import { addDays, cx, downloadCsv, fmtDate, fmtDateTime, npr, todayKey } from '../lib/format';
import { printBill, printReport } from '../lib/print';
import type { Sale } from '../lib/types';
import BillModal from './BillModal';
import { ErrorBox, Spinner } from './ui';

type Range = 'today' | 'yesterday' | '7d' | '30d' | 'custom';
type Status = 'all' | 'paid' | 'pending' | 'cancelled';
const PAGE = 50;

const money = (n: number) => (Number(n) || 0).toFixed(2);

export default function BillingAudit() {
  const { pharmacy, settings } = useApp();
  const [range, setRange] = useState<Range>('today');
  const [from, setFrom] = useState(todayKey());
  const [to, setTo] = useState(todayKey());
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [method, setMethod] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Sale | null>(null);

  useEffect(() => {
    const t = todayKey();
    if (range === 'today') { setFrom(t); setTo(t); }
    if (range === 'yesterday') { setFrom(addDays(t, -1)); setTo(addDays(t, -1)); }
    if (range === '7d') { setFrom(addDays(t, -6)); setTo(t); }
    if (range === '30d') { setFrom(addDays(t, -29)); setTo(t); }
  }, [range]);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    const r = await api<Sale[]>(`/sales?from=${from}&to=${to}&legacy=1`);
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setSales(r.data);
    setLimit(PAGE);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  // ---------- numbers ----------
  const live = sales.filter((s) => s.status !== 'cancelled');
  const paid = live.filter((s) => s.status === 'paid');
  const pending = live.filter((s) => s.status === 'pending');
  const cancelled = sales.filter((s) => s.status === 'cancelled');
  const sum = (arr: Sale[], f: (s: Sale) => number) => arr.reduce((t, s) => t + (Number(f(s)) || 0), 0);
  const byMethod = (m: string[]) => paid.filter((s) => m.includes(s.paymentMethod));
  const modes = [
    { key: 'cash', label: 'Cash drawer', tag: 'Counter', icon: Banknote, list: byMethod(['Cash']), tone: 'emerald', note: 'Cash in the drawer' },
    { key: 'esewa', label: 'eSewa total', tag: 'Gateway', icon: Smartphone, list: byMethod(['eSewa']), tone: 'green', note: 'Instant digital transfers' },
    { key: 'khalti', label: 'Khalti total', tag: 'Gateway', icon: Wallet, list: byMethod(['Khalti']), tone: 'purple', note: 'Verified mobile payments' },
    { key: 'fonepay', label: 'Fonepay total', tag: 'Gateway', icon: CreditCard, list: byMethod(['Fonepay']), tone: 'rose', note: 'Secure QR transactions' },
    { key: 'bank', label: 'Bank & Card', tag: 'Bank', icon: Building2, list: byMethod(['Bank', 'Card']), tone: 'sky', note: 'Transfers and card machine' },
    { key: 'due', label: 'Pending (due)', tag: 'Not paid', icon: Clock, list: pending, tone: 'amber', note: 'Still to collect' },
  ] as const;
  const TONE: Record<string, { box: string; text: string; tag: string; dot: string }> = {
    emerald: { box: 'border-emerald-200 from-emerald-50/80', text: 'text-emerald-700', tag: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    green: { box: 'border-green-200 from-green-50/80', text: 'text-green-700', tag: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    purple: { box: 'border-purple-200 from-purple-50/80', text: 'text-purple-700', tag: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
    rose: { box: 'border-rose-200 from-rose-50/80', text: 'text-rose-600', tag: 'bg-rose-100 text-rose-600', dot: 'bg-rose-500' },
    sky: { box: 'border-sky-200 from-sky-50/80', text: 'text-sky-700', tag: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
    amber: { box: 'border-amber-200 from-amber-50/80', text: 'text-amber-700', tag: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  };
  const methodsUsed = useMemo(() => [...new Set(sales.map((s) => s.paymentMethod).filter(Boolean))].sort(), [sales]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return sales.filter(
      (s) =>
        (status === 'all' || s.status === status) &&
        (method === 'all' || s.paymentMethod === method) &&
        (!t || s.invoiceNo.toLowerCase().includes(t) || s.customerName.toLowerCase().includes(t) || (s.customerPhone || '').includes(t) || (s.dateBS || '').includes(t))
    );
  }, [sales, q, status, method]);

  const label = range === 'today' ? `Today, ${fmtDate(new Date())}` : from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;

  // ---------- VAT sales register ----------
  const registerRows = () =>
    [...shown].reverse().map((s) => [
      s.dateBS || '', fmtDateTime(s.createdAt), s.invoiceNo, s.customerName || 'Walk-in Customer', s.customerPhone || '',
      money(s.subTotal), money(s.discount), money(s.taxableAmount), money(s.vatAmount), money(s.grandTotal),
      s.status === 'pending' ? 'Due' : s.paymentMethod, s.status === 'cancelled' ? `Cancelled${s.creditNoteNo ? ` (${s.creditNoteNo})` : ''}` : s.status === 'pending' ? 'Pending' : 'Paid',
    ]);
  const liveShown = shown.filter((s) => s.status !== 'cancelled');
  const downloadRegister = () =>
    downloadCsv(`vat-sales-register_${from}_to_${to}.csv`, [
      ['Date (BS)', 'Date & time', 'Bill no', 'Customer', 'Phone', 'Sub total', 'Discount', 'Taxable amount', 'VAT', 'Total', 'Payment', 'Status'],
      ...registerRows(),
      [],
      ['', '', '', 'TOTAL (not counting cancelled)', '', money(sum(liveShown, (s) => s.subTotal)), money(sum(liveShown, (s) => s.discount)), money(sum(liveShown, (s) => s.taxableAmount)), money(sum(liveShown, (s) => s.vatAmount)), money(sum(liveShown, (s) => s.grandTotal)), '', ''],
    ]);
  const printRegister = () =>
    printReport({
      title: 'VAT Sales Register',
      subtitle: `${label}${settings.vatEnabled ? ` · VAT ${settings.vatRate}%` : ''}`,
      pharmacy,
      landscape: true,
      head: ['Date (BS)', 'Date & time', 'Bill no', 'Customer', 'Phone', 'Sub total', 'Discount', 'Taxable', 'VAT', 'Total', 'Payment', 'Status'],
      rows: registerRows(),
      numCols: [5, 6, 7, 8, 9],
      totals: [
        ['Bills', String(liveShown.length)],
        ['Taxable amount', `Rs ${money(sum(liveShown, (s) => s.taxableAmount))}`],
        ['VAT collected', `Rs ${money(sum(liveShown, (s) => s.vatAmount))}`],
        ['Total sales', `Rs ${money(sum(liveShown, (s) => s.grandTotal))}`],
        ['Cancelled bills', String(shown.length - liveShown.length)],
      ],
    });

  const methodBadge = (s: Sale) => {
    if (s.status === 'cancelled') return <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-600">Cancelled</span>;
    if (s.status === 'pending') return <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Pending</span>;
    return <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">{s.paymentMethod}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-[28px]">Billing &amp; VAT Audit</h1>
            <p className="text-sm text-slate-500">Every bill made, with payment and VAT totals for your records.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> {label}
        </span>
      </div>

      {/* Dates */}
      <div className="flex flex-wrap items-center gap-2">
        {([['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['custom', 'Pick dates']] as [Range, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setRange(v)} aria-pressed={range === v} className={cx('cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition', range === v ? 'border-purple-600 bg-purple-600 text-white shadow' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-200')}>
            {l}
          </button>
        ))}
        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm" aria-label="From date" />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" value={to} min={from} max={todayKey()} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm" aria-label="To date" />
          </div>
        )}
      </div>

      {/* Payment mode breakdown */}
      <section>
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white"><Activity className="h-4 w-4" /></span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Payment Mode Breakdown</h2>
            <p className="text-xs text-slate-500">Money collected by each method (paid bills)</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {modes.map((m) => {
            const t = TONE[m.tone];
            return (
              <div key={m.key} className={cx('rounded-2xl border bg-gradient-to-br to-white p-4 shadow-sm', t.box)}>
                <div className="flex items-center justify-between gap-2">
                  <span className={cx('flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider', t.text)}>
                    <span className={cx('h-1.5 w-1.5 rounded-full', t.dot)} /> {m.label}
                  </span>
                  <span className={cx('rounded-md px-1.5 py-0.5 text-[9px] font-bold', t.tag)}>{m.tag}</span>
                </div>
                <p className="mt-2 font-mono text-xl font-black text-slate-900">{npr(sum(m.list as Sale[], (s) => s.grandTotal))}</p>
                <p className={cx('mt-1 flex items-center gap-1 text-[11px] font-semibold', t.text)}>
                  <m.icon className="h-3 w-3" /> {m.list.length} bill{m.list.length === 1 ? '' : 's'} · {m.note}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Taxable + VAT */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-violet-50 p-6 shadow-sm">
          <span className="rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-purple-700">Taxable amount</span>
          <p className="mt-4 font-mono text-3xl font-black text-slate-900">{npr(sum(live, (s) => s.taxableAmount))}</p>
          <p className="mt-1 text-xs text-slate-500">After discounts · {live.length} bill{live.length === 1 ? '' : 's'} (cancelled not counted)</p>
          <span className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-white text-purple-600 shadow-sm"><TrendingUp className="h-5 w-5" /></span>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 shadow-sm">
          <span className="rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-sky-700">VAT collected</span>
          <p className="mt-4 font-mono text-3xl font-black text-slate-900">{npr(sum(live, (s) => s.vatAmount))}</p>
          <p className="mt-1 text-xs text-slate-500">{settings.vatEnabled ? `VAT ${settings.vatRate}% on bills` : 'VAT is turned off in Settings'}</p>
          <span className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-100 bg-white text-sky-600 shadow-sm"><ShieldCheck className="h-5 w-5" /></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Total sales', npr(sum(live, (s) => s.grandTotal)), `${live.length} bills`],
          ['Money received', npr(sum(paid, (s) => s.grandTotal)), `${paid.length} paid bills`],
          ['Discounts given', npr(sum(live, (s) => s.discount)), 'On these bills'],
          ['Cancelled bills', String(cancelled.length), cancelled.length ? `${npr(sum(cancelled, (s) => s.grandTotal))} · credit notes` : 'None'],
        ].map(([k, v, n]) => (
          <div key={k} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</p>
            <p className="mt-1 font-mono text-lg font-black text-slate-900">{v}</p>
            <p className="text-[11px] text-slate-500">{n}</p>
          </div>
        ))}
      </div>

      {/* Ledger */}
      <section className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><FileText className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Invoice History Ledger</h2>
              <p className="text-xs text-slate-500">Every bill, with payment, taxable amount and VAT. Click a bill to see or reprint it.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={load} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-purple-50 px-3 text-xs font-bold text-purple-700 hover:bg-purple-100">
              <RefreshCw className={cx('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
            </button>
            <button onClick={printRegister} disabled={!shown.length} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-purple-200 disabled:opacity-50">
              <Printer className="h-3.5 w-3.5" /> Print register
            </button>
            <button onClick={downloadRegister} disabled={!shown.length} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
              <Download className="h-3.5 w-3.5" /> VAT register (Excel)
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by bill no, customer name, phone or BS date…" autoComplete="off" name="ah-audit-search" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10" aria-label="Search bills" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              {([['all', 'All'], ['paid', 'Paid'], ['pending', 'Pending'], ['cancelled', 'Cancelled']] as [Status, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setStatus(v)} aria-pressed={status === v} className={cx('cursor-pointer rounded-lg px-3 py-1.5', status === v ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500')}>{l}</button>
              ))}
            </div>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700" aria-label="Payment method">
              <option value="all">All methods</option>
              {methodsUsed.map((m) => <option key={m} value={m}>{m === 'Due' ? 'Due (pending)' : m}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4">
          {loading && !sales.length ? (
            <Spinner />
          ) : error ? (
            <ErrorBox message={error} onRetry={load} />
          ) : shown.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-purple-100 p-10 text-center">
              <Sparkles className="mx-auto mb-2 h-7 w-7 text-purple-300" />
              <p className="font-bold text-slate-700">No bills for these dates</p>
              <p className="text-sm text-slate-500">Try another date range or filter.</p>
            </div>
          ) : (
            <div className="thin-scroll overflow-x-auto rounded-2xl border border-slate-200/70">
              <table className="w-full min-w-[860px] text-xs">
                <thead className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-right">Taxable</th>
                    <th className="px-4 py-3 text-right">VAT</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.slice(0, limit).map((s) => (
                    <tr key={s.id} className={cx('hover:bg-purple-50/40', s.status === 'cancelled' && 'opacity-60')}>
                      <td className="px-4 py-3">
                        <p className={cx('font-mono text-[12px] font-bold text-slate-900', s.status === 'cancelled' && 'line-through')}>{s.invoiceNo}</p>
                        <p className="text-[10px] text-slate-400">{s.dateBS ? `${s.dateBS} BS · ` : ''}{fmtDateTime(s.createdAt)}{s.legacy ? ' · old' : ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold italic text-slate-700">{s.customerName || 'Walk-in Customer'}</p>
                        {s.customerPhone && <p className="text-[10px] text-slate-400">{s.customerPhone}</p>}
                      </td>
                      <td className="px-4 py-3">{methodBadge(s)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{npr(s.taxableAmount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{npr(s.vatAmount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[13px] font-black text-purple-700">{npr(s.grandTotal)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <button onClick={() => setOpen(s)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-purple-100 hover:text-purple-700">
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                          <button onClick={() => printBill(s, pharmacy, settings)} className="inline-flex cursor-pointer items-center rounded-lg bg-slate-100 px-2 py-1.5 text-slate-600 hover:bg-purple-100 hover:text-purple-700" aria-label={`Print ${s.invoiceNo}`} title="Print bill">
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-purple-50/60 text-[11px] font-bold text-slate-700">
                  <tr>
                    <td className="px-4 py-3" colSpan={3}>Total of {liveShown.length} bill{liveShown.length === 1 ? '' : 's'} shown (cancelled not counted)</td>
                    <td className="px-4 py-3 text-right font-mono">{npr(sum(liveShown, (s) => s.taxableAmount))}</td>
                    <td className="px-4 py-3 text-right font-mono">{npr(sum(liveShown, (s) => s.vatAmount))}</td>
                    <td className="px-4 py-3 text-right font-mono text-purple-700">{npr(sum(liveShown, (s) => s.grandTotal))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {shown.length > limit && (
            <div className="mt-3 text-center">
              <button onClick={() => setLimit((l) => l + PAGE)} className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:border-purple-200 hover:text-purple-700">
                Show more ({shown.length - limit} left)
              </button>
            </div>
          )}
        </div>
      </section>

      <BillModal sale={open} onClose={() => setOpen(null)} onChanged={(s) => { setOpen(s); load(); }} />
    </div>
  );
}
