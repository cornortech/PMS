// =====================================================================
// 💳 CHECKOUT (full screen) — same look as the Atithi RMS "Collect payment" window
//  • Left: every medicine on the bill + totals
//  • Right: how the customer pays (Cash, eSewa, Khalti, Fonepay, Bank, Card)
//    eSewa / Khalti / Fonepay show the payment QR with the bill amount in it
//  • Bottom bar is ALWAYS visible: "Put in pending" and "Mark as paid"
// =====================================================================
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle, ArrowLeft, Banknote, Building2, CheckCircle2, Clock, CreditCard, Info, Loader2, Phone, Printer, ReceiptText, Smartphone, Wallet, X,
} from 'lucide-react';
import { cx, npr } from '../lib/format';
import type { Medicine } from '../lib/types';
import BillQR, { type WalletId } from './BillQR';

type Line = { med: Medicine; qty: number };

const METHODS: { id: string; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'Cash', label: 'Cash', hint: 'Paid at the counter', icon: Banknote },
  { id: 'eSewa', label: 'eSewa', hint: 'Customer scans the QR', icon: Smartphone },
  { id: 'Khalti', label: 'Khalti', hint: 'Customer scans the QR', icon: Wallet },
  { id: 'Fonepay', label: 'Fonepay', hint: 'Customer scans the QR', icon: CreditCard },
  { id: 'Bank', label: 'Bank transfer', hint: 'Sent to your bank', icon: Building2 },
  { id: 'Card', label: 'Card', hint: 'Swiped on card machine', icon: CreditCard },
];
const WALLETS = ['eSewa', 'Khalti', 'Fonepay'];

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'WC';

export default function SaleCheckout({
  open, onClose, lines, subTotal, discount, vatRate, vat, total, customerName, customerPhone, isPatient, allergies,
  initialMethod, allowDue, saving, autoPrint, onAutoPrint, onPay, onPending,
}: {
  open: boolean;
  onClose: () => void;
  lines: Line[];
  subTotal: number;
  discount: number;
  vatRate: number;
  vat: number;
  total: number;
  customerName: string;
  customerPhone: string;
  isPatient: boolean;
  allergies: string;
  initialMethod: string;
  allowDue: boolean;
  saving: boolean;
  autoPrint: boolean;
  onAutoPrint: (v: boolean) => void;
  onPay: (method: string) => void;
  onPending: () => void;
}) {
  const [method, setMethod] = useState<string>('');
  const [cash, setCash] = useState('');

  useEffect(() => {
    if (!open) return;
    setMethod(METHODS.some((m) => m.id === initialMethod) ? initialMethod : '');
    setCash('');
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const qty = lines.reduce((s, l) => s + l.qty, 0);
  const name = customerName.trim() || 'Walk-in Customer';
  const cashNum = Number(cash) || 0;
  const change = method === 'Cash' && cashNum > 0 ? cashNum - total : null;
  const quick = Array.from(new Set([Math.ceil(total), Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000])).filter((v) => v > 0).slice(0, 4);
  const cashShort = method === 'Cash' && cashNum > 0 && cashNum < total;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-900/55 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Checkout">
      <div className="anim-pop flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(860px,calc(100vh-2rem))] sm:rounded-[28px]">
        {/* ---------- Header ---------- */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-7 sm:py-5">
          <button onClick={onClose} disabled={saving} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
          </button>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-purple-500/25">{initials(name)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-600">Checkout</p>
            <p className="truncate text-lg font-extrabold leading-tight text-slate-900">{name}</p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              {customerPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {customerPhone}</span>}
              {isPatient && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Registered patient</span>}
            </p>
          </div>
          <div className="hidden rounded-2xl border border-purple-100 bg-purple-50/70 px-5 py-2 text-right sm:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Amount due</p>
            <p className="font-mono text-2xl font-black tabular-nums text-purple-700">{npr(total)}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="cursor-pointer rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" aria-label="Close checkout">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ---------- Body (scrolls) ---------- */}
        <div className="thin-scroll grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
          {/* Left: items */}
          <div className="space-y-4 bg-gradient-to-br from-purple-50/70 via-white to-amber-50/40 p-4 sm:p-7 thin-scroll lg:overflow-y-auto">
            {allergies && (
              <p className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-semibold text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Allergy: {allergies}. Check the medicines before giving them.
              </p>
            )}
            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h3 className="flex items-center gap-2 font-bold text-slate-900"><ReceiptText className="h-5 w-5 text-purple-600" /> Medicines on this bill</h3>
                <span className="rounded-full bg-purple-50 px-2.5 py-0.5 font-mono text-xs font-bold text-purple-700">{qty} qty</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr><th className="px-5 py-2.5 text-left">Medicine</th><th className="px-2 py-2.5 text-center">Qty</th><th className="px-2 py-2.5 text-right">Rate</th><th className="px-5 py-2.5 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <tr key={l.med.id}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-800">{l.med.name}</p>
                        <p className="text-[11px] text-slate-400">{[l.med.genericName, l.med.batchNo && `Batch ${l.med.batchNo}`].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className="px-2 py-3 text-center"><span className="rounded-md bg-purple-50 px-2 py-0.5 font-mono text-xs font-bold text-purple-700">{l.qty}</span></td>
                      <td className="px-2 py-3 text-right font-mono text-xs text-slate-500">{l.med.unitPrice.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right font-mono text-sm font-bold text-slate-800">{(l.qty * l.med.unitPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="space-y-1.5 border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-sm">
                <div className="flex justify-between text-slate-500"><dt>Sub total</dt><dd className="font-mono">{npr(subTotal)}</dd></div>
                {discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd className="font-mono">− {npr(discount)}</dd></div>}
                {vatRate > 0 && <div className="flex justify-between text-slate-500"><dt>VAT {vatRate}%</dt><dd className="font-mono">{npr(vat)}</dd></div>}
                <div className="flex items-baseline justify-between pt-1"><dt className="font-bold text-slate-900">Total</dt><dd className="font-mono text-lg font-black text-purple-700">{npr(total)}</dd></div>
              </dl>
            </div>
          </div>

          {/* Right: payment */}
          <div className="space-y-4 border-t border-slate-100 p-4 sm:p-7 thin-scroll lg:overflow-y-auto lg:border-l lg:border-t-0">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Wallet className="h-5 w-5 text-purple-600" /> Collect payment</h3>
            <p className="flex items-start gap-2 rounded-2xl border border-purple-100 bg-purple-50/60 px-3.5 py-2.5 text-xs text-purple-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>Choose how the customer is paying. Not paying now? Use <b>Put in pending</b> below.</span>
            </p>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {METHODS.map((m) => {
                const on = method === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    aria-pressed={on}
                    className={cx(
                      'flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all sm:p-4',
                      on ? 'border-purple-500 bg-purple-50 shadow-md shadow-purple-500/10' : 'border-slate-200 hover:border-purple-200 hover:bg-slate-50'
                    )}
                  >
                    <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', on ? 'border-purple-200 bg-white text-purple-600' : 'border-slate-200 text-slate-500')}>
                      <m.icon className="h-5 w-5" />
                    </span>
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="cash-in">Cash received</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-400">Rs</span>
                  <input
                    id="cash-in"
                    autoFocus
                    value={cash}
                    onChange={(e) => setCash(e.target.value.replace(/[^0-9.]/g, '').slice(0, 9))}
                    inputMode="decimal"
                    placeholder={total.toFixed(2)}
                    className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-right font-mono text-lg font-bold outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quick.map((v) => (
                    <button key={v} onClick={() => setCash(String(v))} className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 font-mono text-xs font-bold text-slate-600 hover:border-purple-300 hover:text-purple-700">
                      {v === Math.ceil(total) ? `Exact ${v}` : v}
                    </button>
                  ))}
                </div>
                {change !== null && (
                  <p className={cx('flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold', change < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>
                    <span>{change < 0 ? 'Still short' : 'Give back (change)'}</span>
                    <span className="font-mono">{npr(Math.abs(change))}</span>
                  </p>
                )}
              </div>
            )}

            {WALLETS.includes(method) && total > 0 && (
              <div className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <BillQR amount={Number(total.toFixed(2))} method={method as WalletId} />
                <p className="mt-3 text-center text-[11px] text-slate-500">After the customer pays, check the payment arrived in your {method} app, then press <b>Mark as paid</b>.</p>
              </div>
            )}

            {(method === 'Bank' || method === 'Card') && (
              <p className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                {method === 'Bank' ? 'Check that the money reached your bank account, then press Mark as paid.' : 'Take the payment on your card machine, then press Mark as paid.'}
              </p>
            )}
          </div>
        </div>

        {/* ---------- Bottom bar (always visible) ---------- */}
        <div className="border-t border-slate-100 bg-white px-4 py-3 sm:px-7 sm:py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount due</p>
              <p className="font-mono text-2xl font-black tabular-nums text-purple-700 sm:text-3xl">{npr(total)}</p>
            </div>
            <label className="hidden cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-500 md:inline-flex">
              <input type="checkbox" checked={autoPrint} onChange={(e) => onAutoPrint(e.target.checked)} className="h-4 w-4 accent-purple-600" />
              <Printer className="h-3.5 w-3.5" /> Print bill after saving
            </label>
            {allowDue && (
              <button
                onClick={onPending}
                disabled={saving}
                className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
              >
                <Clock className="h-4 w-4" /> Put in pending
              </button>
            )}
            <button
              onClick={() => method && onPay(method)}
              disabled={!method || saving || cashShort}
              className="inline-flex h-12 min-w-[200px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-slate-200 disabled:via-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:hover:translate-y-0 sm:flex-none"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {!method ? 'Choose how they pay' : cashShort ? 'Cash is short' : `Mark as paid · ${method}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
