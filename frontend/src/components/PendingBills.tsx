// =====================================================================
// ⏳ PENDING BILLS (Due / udharo) — same as "Pending Bills" in Atithi RMS
//  • Bills under the same customer are combined, so each customer pays once
//  • Click a customer → "Settle pending bills" window:
//      left  = all medicines of the selected bills + the list of bills (tick which ones to pay)
//      right = how they pay (Cash / eSewa / Khalti / Fonepay QR / Bank / Card)
//  • How a bill gets here: New Sale → "Put in pending" (or F8)
// =====================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownUp, ArrowLeft, Banknote, Building2, CheckCircle2, ChevronRight, Clock, ClipboardList, CreditCard, Eye, FileText, Info, Layers,
  Loader2, Phone, Printer, ReceiptText, RefreshCw, Search, Smartphone, Sparkles, TrendingUp, Users, Wallet, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/app';
import { cx, fmtDateTime, npr, phoneDigits } from '../lib/format';
import { printReport } from '../lib/print';
import type { Sale } from '../lib/types';
import BillModal from './BillModal';
import BillQR, { type WalletId } from './BillQR';
import { ErrorBox, Spinner, useToast } from './ui';

type Group = { key: string; name: string; phone: string; bills: Sale[]; total: number; oldest: string; newest: string };
type Sort = 'newest' | 'oldest' | 'biggest';

const METHODS: { id: string; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'Cash', label: 'Cash', hint: 'Paid at the counter', icon: Banknote },
  { id: 'eSewa', label: 'eSewa', hint: 'Customer scans the QR', icon: Smartphone },
  { id: 'Khalti', label: 'Khalti', hint: 'Customer scans the QR', icon: Wallet },
  { id: 'Fonepay', label: 'Fonepay', hint: 'Customer scans the QR', icon: CreditCard },
  { id: 'Bank', label: 'Bank transfer', hint: 'Sent to your bank', icon: Building2 },
  { id: 'Card', label: 'Card', hint: 'Swiped on card machine', icon: CreditCard },
];
const WALLETS = ['eSewa', 'Khalti', 'Fonepay'];
const GRADIENTS = ['from-orange-400 to-rose-500', 'from-purple-500 to-indigo-600', 'from-sky-500 to-indigo-500', 'from-emerald-500 to-teal-600', 'from-pink-500 to-rose-500', 'from-amber-400 to-orange-500'];

const money2 = (n: number) => Math.round(n * 100) / 100;
const initials = (n: string) => n.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'WC';
const gradientOf = (k: string) => GRADIENTS[[...k].reduce((h, c) => h + c.charCodeAt(0), 0) % GRADIENTS.length];
const ago = (d: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const groupKey = (s: Sale) => {
  const name = (s.customerName || '').trim().toLowerCase();
  if (name && name !== 'walk-in customer') return `n:${name}`;
  const p = phoneDigits(s.customerPhone);
  return p.length >= 7 ? `p:${p}` : `b:${s.id}`;
};

export default function PendingBills({ onChange }: { onChange?: () => void }) {
  const toast = useToast();
  const { pharmacy } = useApp();
  const [bills, setBills] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [viewBill, setViewBill] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const r = await api<Sale[]>('/sales?status=pending');
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setBills(r.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const allGroups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const s of bills) {
      const k = groupKey(s);
      const walkIn = !s.customerName || s.customerName === 'Walk-in Customer';
      const g = map.get(k) || { key: k, name: walkIn && s.customerPhone ? s.customerPhone : s.customerName || 'Walk-in Customer', phone: s.customerPhone, bills: [], total: 0, oldest: s.createdAt, newest: s.createdAt };
      g.bills.push(s);
      g.total = money2(g.total + s.grandTotal);
      if (!g.phone && s.customerPhone) g.phone = s.customerPhone;
      if (new Date(s.createdAt) < new Date(g.oldest)) g.oldest = s.createdAt;
      if (new Date(s.createdAt) > new Date(g.newest)) g.newest = s.createdAt;
      map.set(k, g);
    }
    for (const g of map.values()) g.bills.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return [...map.values()];
  }, [bills]);

  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    const d = t.replace(/\D/g, '');
    const list = allGroups.filter((g) => !t || g.name.toLowerCase().includes(t) || (d.length >= 3 && phoneDigits(g.phone).includes(d)) || g.bills.some((b) => b.invoiceNo.toLowerCase().includes(t)));
    const by: Record<Sort, (a: Group, b: Group) => number> = {
      newest: (a, b) => new Date(b.newest).getTime() - new Date(a.newest).getTime(),
      oldest: (a, b) => new Date(a.oldest).getTime() - new Date(b.oldest).getTime(),
      biggest: (a, b) => b.total - a.total,
    };
    return list.sort(by[sort]);
  }, [allGroups, q, sort]);

  const open = allGroups.find((g) => g.key === openKey) || null;
  const totalDue = money2(bills.reduce((s, b) => s + b.grandTotal, 0));
  const largest = allGroups.reduce<Group | null>((m, g) => (!m || g.total > m.total ? g : m), null);
  const nextSort: Record<Sort, Sort> = { newest: 'oldest', oldest: 'biggest', biggest: 'newest' };
  const sortLabel: Record<Sort, string> = { newest: 'Newest', oldest: 'Oldest', biggest: 'Biggest due' };

  const afterPay = () => { load(); onChange?.(); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/30"><Clock className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-[28px]">Pending Bills</h1>
            <p className="text-sm text-slate-500">Bills under the same customer are combined, so each customer pays once.</p>
          </div>
        </div>
        <button onClick={load} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-purple-100 bg-white px-4 text-sm font-bold text-purple-700 shadow-sm hover:bg-purple-50">
          <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={TrendingUp} tone="bg-purple-50 text-purple-600" label="Total outstanding" value={npr(totalDue)} />
        <StatCard icon={Users} tone="bg-sky-50 text-sky-600" label="Customers" value={String(allGroups.length)} />
        <StatCard icon={Layers} tone="bg-emerald-50 text-emerald-600" label="Open bills" value={String(bills.length)} />
        <StatCard icon={Sparkles} tone="bg-amber-50 text-amber-600" label="Largest tab" value={largest ? npr(largest.total) : '—'} note={largest?.name} />
      </div>

      {/* Customers */}
      <section className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <ClipboardList className="h-4 w-4 text-purple-600" /> Customers with pending bills
            <span className="rounded-full bg-purple-50 px-2 py-0.5 font-mono text-[11px] font-bold text-purple-700">{groups.length}</span>
          </h2>
          <div className="flex w-full gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or bill no" autoComplete="off" name="ah-pending-search" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10" aria-label="Search pending bills" />
            </div>
            <button onClick={() => setSort(nextSort[sort])} className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:border-purple-200" title="Change sort">
              <ArrowDownUp className="h-4 w-4" /> {sortLabel[sort]}
            </button>
          </div>
        </div>

        {loading && !bills.length ? (
          <Spinner />
        ) : error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 px-6 py-12 text-center">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-6 w-6" /></span>
            <p className="font-bold text-emerald-800">{bills.length ? 'Nothing matches your search' : 'All caught up'}</p>
            <p className="mt-1 text-sm text-emerald-700/80">{bills.length ? 'Try another name, phone or bill number.' : 'To save a bill here: New Sale → pick the customer → “Put in pending” (F8).'}</p>
          </div>
        ) : (
          <div className="thin-scroll overflow-x-auto rounded-2xl border border-slate-200/70">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-3">Customer</th><th className="px-4 py-3 text-center">Bills</th><th className="px-4 py-3">Waiting since</th><th className="px-4 py-3 text-right">Amount due</th><th className="w-10" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groups.map((g) => (
                  <tr key={g.key} onClick={() => setOpenKey(g.key)} className="cursor-pointer transition hover:bg-purple-50/40">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white shadow-sm', gradientOf(g.key))}>{initials(g.name)}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{g.name}</p>
                          {g.phone && g.phone !== g.name && <p className="text-[11px] text-slate-500">{g.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center"><span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-50 px-2 font-mono text-xs font-bold text-amber-700 ring-1 ring-amber-200">{g.bills.length}</span></td>
                    <td className="px-4 py-3.5"><span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600"><Clock className="h-3 w-3" /> {ago(g.oldest)}</span></td>
                    <td className="px-4 py-3.5 text-right font-mono text-[15px] font-black text-purple-700">{npr(g.total)}</td>
                    <td className="pr-4 text-slate-300"><ChevronRight className="h-4 w-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {open && <SettleWindow group={open} pharmacy={pharmacy} onClose={() => setOpenKey(null)} onView={setViewBill} onPaid={afterPay} toast={toast} />}
      <BillModal sale={viewBill} onClose={() => setViewBill(null)} onChanged={(s) => { setViewBill(s.status === 'pending' ? s : null); afterPay(); }} />
    </div>
  );
}

function StatCard({ icon: Icon, tone, label, value, note }: { icon: LucideIcon; tone: string; label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
      <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', tone)}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="truncate font-mono text-lg font-black text-slate-900">{value}</p>
        {note && <p className="truncate text-[11px] text-slate-400">{note}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// 💳 Settle window (full screen, like RMS)
// ---------------------------------------------------------------------
function SettleWindow({ group, pharmacy, onClose, onView, onPaid, toast }: {
  group: Group;
  pharmacy: any;
  onClose: () => void;
  onView: (s: Sale) => void;
  onPaid: () => void;
  toast: (t: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(group.bills.map((b) => b.id)));
  const [method, setMethod] = useState('');
  const [cash, setCash] = useState('');
  const [busy, setBusy] = useState(false);

  // When a bill disappears (paid elsewhere), drop it from the selection
  useEffect(() => {
    setPicked((p) => new Set([...p].filter((id) => group.bills.some((b) => b.id === id))));
  }, [group.bills]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [busy, onClose]);

  const chosen = group.bills.filter((b) => picked.has(b.id));
  const due = money2(chosen.reduce((s, b) => s + b.grandTotal, 0));
  const items = useMemo(() => chosen.flatMap((b) => b.items.map((i) => ({ ...i, bill: b.invoiceNo }))), [chosen]);
  const qty = items.reduce((s, i) => s + i.quantity, 0);
  const cashNum = Number(cash) || 0;
  const change = method === 'Cash' && cashNum > 0 ? cashNum - due : null;
  const cashShort = method === 'Cash' && cashNum > 0 && cashNum < due;
  const allPicked = picked.size === group.bills.length;

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const pay = async () => {
    if (!method || !chosen.length || busy) return;
    setBusy(true);
    let ok = 0;
    for (const b of chosen) {
      const r = await api(`/sales/${b.id}/settle`, { method: 'PATCH', body: { paymentMethod: method } });
      if (r.ok) ok++;
    }
    setBusy(false);
    if (ok === chosen.length) toast(`Received ${npr(due)} from ${group.name} by ${method}.`);
    else toast(`${ok} of ${chosen.length} bills were marked paid. Please refresh and check.`, 'error');
    onPaid();
    // Everything this customer owed is paid → close; otherwise stay open for the rest
    if (ok === chosen.length && chosen.length === group.bills.length) onClose();
    else { setMethod(''); setCash(''); }
  };

  const printStatement = () =>
    printReport({
      title: 'Pending Bills Statement',
      subtitle: `${group.name}${group.phone && group.phone !== group.name ? ` · ${group.phone}` : ''}`,
      pharmacy,
      head: ['Bill no', 'Date', 'Medicine', 'Qty', 'Rate', 'Amount'],
      rows: chosen.flatMap((b) => b.items.map((i, k) => [k === 0 ? b.invoiceNo : '', k === 0 ? fmtDateTime(b.createdAt) : '', i.name, i.quantity, i.unitPrice.toFixed(2), i.total.toFixed(2)])),
      numCols: [3, 4, 5],
      totals: [
        ['Bills', String(chosen.length)],
        ['VAT included', `Rs ${chosen.reduce((s, b) => s + b.vatAmount, 0).toFixed(2)}`],
        ['AMOUNT DUE', `Rs ${due.toFixed(2)}`],
      ],
    });

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-900/55 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Settle pending bills">
      <div className="anim-pop flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(860px,calc(100vh-2rem))] sm:rounded-[28px]">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-7 sm:py-5">
          <button onClick={onClose} disabled={busy} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
          </button>
          <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-bold text-white shadow-lg', gradientOf(group.key))}>{initials(group.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">Settle pending bills</p>
            <p className="truncate text-lg font-extrabold leading-tight text-slate-900">{group.name}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              {group.phone && group.phone !== group.name && <a href={`tel:${group.phone}`} className="inline-flex items-center gap-1 hover:text-purple-700"><Phone className="h-3 w-3" /> {group.phone}</a>}
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600"><Clock className="h-3 w-3" /> Since {ago(group.oldest)}</span>
              {group.bills.length > 1 && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{group.bills.length} bills merged</span>}
            </p>
          </div>
          <button onClick={printStatement} disabled={!chosen.length} className="hidden h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:inline-flex">
            <Printer className="h-4 w-4" /> Print
          </button>
          <div className="hidden rounded-2xl border border-purple-100 bg-purple-50/70 px-5 py-2 text-right md:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Amount due</p>
            <p className="font-mono text-2xl font-black tabular-nums text-purple-700">{npr(due)}</p>
          </div>
          <button onClick={onClose} disabled={busy} className="cursor-pointer rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="thin-scroll grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
          {/* Left: items + bills */}
          <div className="thin-scroll space-y-4 bg-gradient-to-br from-purple-50/70 via-white to-amber-50/40 p-4 sm:p-7 lg:overflow-y-auto">
            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h3 className="flex items-center gap-2 font-bold text-slate-900"><ReceiptText className="h-5 w-5 text-purple-600" /> Medicines (selected bills combined)</h3>
                <span className="rounded-full bg-purple-50 px-2.5 py-0.5 font-mono text-xs font-bold text-purple-700">{qty} qty</span>
              </div>
              {items.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">Tick at least one bill below.</p>
              ) : (
                <div className="thin-scroll max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <tr><th className="px-5 py-2.5 text-left">Medicine</th><th className="px-2 py-2.5 text-center">Qty</th><th className="px-2 py-2.5 text-right">Rate</th><th className="px-5 py-2.5 text-right">Total</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((i, k) => (
                        <tr key={`${i.bill}-${k}`}>
                          <td className="px-5 py-2.5"><p className="font-semibold text-slate-800">{i.name}</p><p className="font-mono text-[10px] text-slate-400">{i.bill}</p></td>
                          <td className="px-2 py-2.5 text-center"><span className="rounded-md bg-purple-50 px-2 py-0.5 font-mono text-xs font-bold text-purple-700">{i.quantity}</span></td>
                          <td className="px-2 py-2.5 text-right font-mono text-xs text-slate-500">{i.unitPrice.toFixed(2)}</td>
                          <td className="px-5 py-2.5 text-right font-mono text-sm font-bold text-slate-800">{i.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-sm">
                <span className="font-semibold text-slate-500">Total with VAT</span>
                <span className="font-mono font-black text-slate-900">{npr(due)}</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <h3 className="flex items-center gap-2 font-bold text-slate-900"><FileText className="h-5 w-5 text-orange-500" /> Bills in this tab</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPicked(allPicked ? new Set() : new Set(group.bills.map((b) => b.id)))} className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:border-purple-200">
                    {allPicked ? 'Clear all' : 'Select all'}
                  </button>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">{picked.size}/{group.bills.length} selected</span>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {group.bills.map((b) => (
                  <li key={b.id} className={cx('flex items-center gap-3 px-5 py-3', !picked.has(b.id) && 'opacity-60')}>
                    <input type="checkbox" checked={picked.has(b.id)} onChange={() => toggle(b.id)} className="h-4 w-4 accent-purple-600" aria-label={`Pay ${b.invoiceNo}`} />
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600"><ReceiptText className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-bold text-slate-900">{b.invoiceNo}</p>
                      <p className="truncate text-[11px] text-slate-500">{fmtDateTime(b.createdAt)} · {b.items.length} item{b.items.length === 1 ? '' : 's'}</p>
                    </div>
                    <span className="font-mono text-sm font-black text-slate-900">{npr(b.grandTotal)}</span>
                    <button onClick={() => onView(b)} className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-purple-50 hover:text-purple-700" aria-label={`View ${b.invoiceNo}`} title="View bill"><Eye className="h-4 w-4" /></button>
                    {group.bills.length > 1 && (
                      <button onClick={() => setPicked(new Set([b.id]))} className="hidden cursor-pointer rounded-lg border border-purple-200 px-2 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-50 sm:inline">Pay only this</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: payment */}
          <div className="thin-scroll space-y-4 border-t border-slate-100 p-4 sm:p-7 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Wallet className="h-5 w-5 text-purple-600" /> Collect payment</h3>
            <p className="flex items-start gap-2 rounded-2xl border border-purple-100 bg-purple-50/60 px-3.5 py-2.5 text-xs text-purple-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>Tick the bills the customer is paying now, then choose how they pay.</span>
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {METHODS.map((m) => {
                const on = method === m.id;
                return (
                  <button key={m.id} onClick={() => setMethod(m.id)} aria-pressed={on} className={cx('flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all sm:p-4', on ? 'border-purple-500 bg-purple-50 shadow-md shadow-purple-500/10' : 'border-slate-200 hover:border-purple-200 hover:bg-slate-50')}>
                    <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', on ? 'border-purple-200 bg-white text-purple-600' : 'border-slate-200 text-slate-500')}><m.icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900">{m.label}</span>
                      <span className="block truncate text-[11px] text-slate-500">{m.hint}</span>
                    </span>
                    <span className={cx('h-5 w-5 shrink-0 rounded-full border-2', on ? 'border-purple-600 bg-purple-600 ring-2 ring-inset ring-white' : 'border-slate-300')} aria-hidden="true" />
                  </button>
                );
              })}
            </div>

            {method === 'Cash' && (
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="pend-cash">Cash received</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-400">Rs</span>
                  <input id="pend-cash" autoFocus value={cash} onChange={(e) => setCash(e.target.value.replace(/[^0-9.]/g, '').slice(0, 9))} inputMode="decimal" placeholder={due.toFixed(2)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-right font-mono text-lg font-bold outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10" />
                </div>
                {change !== null && (
                  <p className={cx('flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold', change < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>
                    <span>{change < 0 ? 'Still short' : 'Give back (change)'}</span><span className="font-mono">{npr(Math.abs(change))}</span>
                  </p>
                )}
              </div>
            )}
            {WALLETS.includes(method) && due > 0 && (
              <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <BillQR amount={due} billNo={chosen.length === 1 ? chosen[0].invoiceNo : undefined} method={method as WalletId} />
                <p className="mt-3 text-center text-[11px] text-slate-500">After the customer pays, check the money arrived in your {method} app, then press <b>Mark as paid</b>.</p>
              </div>
            )}
            {(method === 'Bank' || method === 'Card') && (
              <p className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">{method === 'Bank' ? 'Check that the money reached your bank account, then press Mark as paid.' : 'Take the payment on your card machine, then press Mark as paid.'}</p>
            )}
          </div>
        </div>

        {/* Bottom bar (always visible) */}
        <div className="border-t border-slate-100 bg-white px-4 py-3 sm:px-7 sm:py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount due · {chosen.length} bill{chosen.length === 1 ? '' : 's'}</p>
              <p className="font-mono text-2xl font-black tabular-nums text-purple-700 sm:text-3xl">{npr(due)}</p>
            </div>
            <button
              onClick={pay}
              disabled={!method || !chosen.length || busy || cashShort}
              className="inline-flex h-12 min-w-[220px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-slate-200 disabled:via-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:hover:translate-y-0 sm:flex-none"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {!chosen.length ? 'Tick a bill to pay' : !method ? 'Choose how they pay' : cashShort ? 'Cash is short' : `Mark ${chosen.length} bill${chosen.length === 1 ? '' : 's'} as paid`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

