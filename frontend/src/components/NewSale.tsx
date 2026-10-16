// =====================================================================
// 🛒 NEW SALE (billing counter) — same layout as "Create Order" in Atithi RMS
//  • Left: the bill — Walk-in or Patient (search a saved patient or create a new one),
//    medicines, discount, note, total, and two buttons:
//      "Put in pending"  → saved as Due, goes to Pending Bills
//      "Complete sale"   → opens the full-screen checkout (Cash / eSewa / Khalti / Fonepay QR / Bank / Card)
//  • Right: all medicines (search / barcode, categories, sort, cards or table)
//  • Stock and expiry are checked; expired medicine can't be added
//  • The SERVER works out the final prices, VAT and bill number
//  • Keys: F2 search · F8 put in pending · F9 complete sale
// =====================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, Barcode, Clock, LayoutGrid, List, Maximize2, Minimize2, Minus, Package, Phone, Plus, Printer, RefreshCw,
  Search, ShoppingCart, Trash2, User, UserRound, Users, X,
} from 'lucide-react';
import { api, requestId } from '../lib/api';
import { useApp } from '../lib/app';
import { cx, daysUntil, expiryState, fmtExpiry, npr, phoneDigits } from '../lib/format';
import { printBill } from '../lib/print';
import type { Medicine, Sale } from '../lib/types';
import BillModal from './BillModal';
import PatientPicker, { type PickedPatient } from './PatientPicker';
import SaleCheckout from './SaleCheckout';
import { Badge, ErrorBox, Spinner, useToast } from './ui';

type Line = { med: Medicine; qty: number };
type Lookup = { name: string; phone: string; patientId: string; allergies: string; pendingCount: number } | null;
type Sort = 'name' | 'price' | 'stock' | 'expiry';

const AUTO_PRINT_KEY = 'argya.autoPrint';
const VIEW_KEY = 'argya.saleView';

export default function NewSale({ patientShortcut, clearShortcut, onSaved }: { patientShortcut?: any; clearShortcut?: () => void; onSaved?: () => void }) {
  const { settings, pharmacy, staff } = useApp();
  const toast = useToast();

  const [meds, setMeds] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<Sort>('name');
  const [view, setView] = useState<'cards' | 'table'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards'; } catch { return 'cards'; }
  });
  const [lines, setLines] = useState<Line[]>([]);

  // customer
  const [mode, setMode] = useState<'walkin' | 'patient'>('walkin');
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lookup, setLookup] = useState<Lookup>(null);

  const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount');
  const [discountInput, setDiscountInput] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [done, setDone] = useState<Sale | null>(null);
  const [cartOpen, setCartOpen] = useState(false); // small screens: the bill opens as a sheet
  const [full, setFull] = useState(false);
  const [autoPrint, setAutoPrint] = useState(() => {
    try { return localStorage.getItem(AUTO_PRINT_KEY) === '1'; } catch { return false; }
  });
  const reqId = useRef(requestId());
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const r = await api<Medicine[]>('/inventory');
    setLoading(false);
    if (!r.ok) return setLoadError(r.message);
    setMeds(r.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Started from a patient's page → that patient is already picked
  useEffect(() => {
    if (!patientShortcut) return;
    setMode('patient');
    setPatient({
      id: String(patientShortcut.id || patientShortcut._id || ''),
      name: patientShortcut.fullName || patientShortcut.name || '',
      phone: patientShortcut.phone || patientShortcut.phoneNumber || '',
      allergies: Array.isArray(patientShortcut.allergies) ? patientShortcut.allergies : [],
      age: patientShortcut.age || '',
      gender: patientShortcut.gender || '',
    });
    clearShortcut?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientShortcut]);

  // Browser full screen (like a counter screen)
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch { /* not allowed */ }
  };

  // The name / phone that goes on the bill
  const billName = mode === 'patient' ? patient?.name || '' : customerName.trim();
  const billPhone = mode === 'patient' ? patient?.phone || '' : customerPhone.trim();
  const patientId = mode === 'patient' ? patient?.id || '' : lookup?.patientId || '';

  // Phone number → look up the customer (unpaid bills, allergies)
  useEffect(() => {
    const digits = phoneDigits(billPhone);
    if (digits.length < 7) {
      setLookup(null);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const r = await api<Lookup>(`/customers/lookup?phone=${encodeURIComponent(digits)}`, { signal: ctrl.signal });
        if (!r.ok) return;
        setLookup(r.data);
        if (r.data && mode === 'walkin') setCustomerName((n) => (n.trim() ? n : r.data!.name));
      } catch { /* cancelled */ }
    }, 350);
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [billPhone, mode]);

  const allergies = mode === 'patient' && patient?.allergies.length ? patient.allergies.join(', ') : lookup?.allergies || '';

  // ---------- medicines list ----------
  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of meds) if (x.category) m.set(x.category, (m.get(x.category) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [meds]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? meds.filter((m) => m.name.toLowerCase().includes(q) || m.genericName.toLowerCase().includes(q) || (m.sku && m.sku.toLowerCase() === q) || m.category.toLowerCase().startsWith(q))
      : meds;
    if (category !== 'All') list = list.filter((m) => m.category === category);
    const blocked = (m: Medicine) => (m.stock <= 0 || expiryState(m.expiryDate) === 'expired' ? 1 : 0);
    const by: Record<Sort, (a: Medicine, b: Medicine) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      price: (a, b) => a.unitPrice - b.unitPrice,
      stock: (a, b) => b.stock - a.stock,
      expiry: (a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate),
    };
    return [...list].sort((a, b) => blocked(a) - blocked(b) || by[sort](a, b)).slice(0, q ? 80 : 60);
  }, [meds, query, category, sort]);

  const inCart = (id: string) => lines.find((l) => l.med.id === id)?.qty || 0;

  const add = (m: Medicine, qty = 1) => {
    if (expiryState(m.expiryDate) === 'expired') return toast(`${m.name} is expired and can't be sold.`, 'error');
    const have = inCart(m.id);
    if (have + qty > m.stock) return toast(m.stock <= 0 ? `${m.name} is out of stock.` : `Only ${m.stock} ${m.name} in stock.`, 'error');
    setLines((ls) => (ls.some((l) => l.med.id === m.id) ? ls.map((l) => (l.med.id === m.id ? { ...l, qty: l.qty + qty } : l)) : [...ls, { med: m, qty }]));
  };
  const setQty = (id: string, qty: number) => {
    setLines((ls) =>
      ls.flatMap((l) => {
        if (l.med.id !== id) return [l];
        if (!Number.isFinite(qty) || qty <= 0) return [];
        if (qty > l.med.stock) {
          toast(`Only ${l.med.stock} in stock.`, 'error');
          return [{ ...l, qty: l.med.stock }];
        }
        return [{ ...l, qty: Math.floor(qty) }];
      })
    );
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const exact = meds.find((m) => m.sku && m.sku.toLowerCase() === q.toLowerCase());
    const pick = exact || (results.length === 1 ? results[0] : results.find((m) => m.stock > 0 && expiryState(m.expiryDate) !== 'expired'));
    if (pick) {
      add(pick);
      setQuery('');
    } else toast(`No medicine found for “${q}”.`, 'error');
  };

  // ---------- totals (preview — the server makes the final numbers) ----------
  const subTotal = lines.reduce((s, l) => s + l.qty * l.med.unitPrice, 0);
  const dRaw = Math.max(0, Number(discountInput) || 0);
  const discount = Math.min(subTotal, discountMode === 'percent' ? (subTotal * Math.min(100, dRaw)) / 100 : dRaw);
  const taxable = subTotal - discount;
  const vatRate = settings.vatEnabled ? settings.vatRate : 0;
  const vat = (taxable * vatRate) / 100;
  const total = Math.round((taxable + vat) * 100) / 100;
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const hasWho = !!billName || phoneDigits(billPhone).length >= 7;

  const reset = () => {
    setLines([]);
    setCustomerName('');
    setCustomerPhone('');
    setPatient(null);
    setMode('walkin');
    setLookup(null);
    setDiscountInput('');
    setNote('');
    reqId.current = requestId();
    setCartOpen(false);
    setCheckout(false);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const save = async (paymentMethod: string) => {
    if (saving || lines.length === 0) return;
    if (paymentMethod === 'Due' && !hasWho) {
      toast('To put a bill in pending, pick a patient or enter the customer’s name or phone.', 'error');
      setCheckout(false);
      return;
    }
    setSaving(true);
    const r = await api<Sale>('/sales', {
      method: 'POST',
      body: {
        items: lines.map((l) => ({ medicineId: l.med.id, quantity: l.qty })),
        customerName: billName,
        customerPhone: billPhone,
        patientId: patientId || undefined,
        paymentMethod,
        ...(discountMode === 'percent' ? { discountPercent: dRaw } : { discount: dRaw }),
        note: note.trim(),
        clientRequestId: reqId.current,
      },
    });
    setSaving(false);
    if (!r.ok) {
      toast(r.message || 'Could not save the bill.', 'error');
      if (r.status === 409 || r.status === 400) load(); // stock changed → refresh
      return;
    }
    const sale = r.data;
    setMeds((ms) => ms.map((m) => {
      const l = lines.find((x) => x.med.id === m.id);
      return l ? { ...m, stock: m.stock - l.qty } : m;
    }));
    toast(paymentMethod === 'Due' ? `Bill ${sale.invoiceNo} put in Pending Bills.` : `Sale completed · ${sale.invoiceNo}`);
    setDone(sale);
    if (autoPrint) printBill(sale, pharmacy, settings);
    reset();
    onSaved?.();
  };

  const putPending = () => {
    if (!lines.length) return;
    if (!settings.allowDue) return toast('Pending (Due) bills are turned off. A Manager can turn them on in Settings → Billing & Printing.', 'error');
    save('Due');
  };
  const openCheckout = () => {
    if (!lines.length) return toast('Add at least one medicine first.', 'error');
    setCartOpen(false);
    setCheckout(true);
  };
  const setPrint = (v: boolean) => {
    setAutoPrint(v);
    try { localStorage.setItem(AUTO_PRINT_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  };

  // Keys: F2 = search, F8 = put in pending, F9 = complete sale
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (checkout || done) return;
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F8') { e.preventDefault(); putPending(); }
      if (e.key === 'F9') { e.preventDefault(); openCheckout(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- the bill (left card / sheet on small screens) ----------
  const billCard = (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Title */}
      <div className="flex items-center gap-3 p-5 pb-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25">
          <ShoppingCart className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold leading-tight text-slate-900">New Bill</h2>
          <p className="text-xs text-slate-500">Pick medicines, then complete the sale.</p>
        </div>
        <span className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-0.5 font-mono text-xs font-bold text-purple-700">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
      </div>

      <div className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-slate-500"><UserRound className="h-3.5 w-3.5 text-purple-500" /> Billed by <b className="font-mono text-slate-800">{staff.staffName || staff.id}</b></span>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">{staff.role}</span>
        </div>

        {/* Customer */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><Users className="h-4 w-4 text-purple-600" /> Customer</p>
            <div className="inline-flex rounded-full border border-purple-100 bg-white p-0.5 text-[11px] font-bold">
              {(['walkin', 'patient'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={cx('cursor-pointer rounded-full px-3 py-1 transition', mode === m ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-purple-700')}>
                  {m === 'walkin' ? 'Walk-in' : 'Patient'}
                </button>
              ))}
            </div>
          </div>
          {mode === 'patient' ? (
            <PatientPicker value={patient} onChange={setPatient} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9+\-\s]/g, '').slice(0, 20))}
                  placeholder="Phone"
                  inputMode="tel"
                  autoComplete="off"
                  name="ah-sale-phone"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-2 text-sm outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10"
                  aria-label="Customer phone"
                />
              </div>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value.slice(0, 80))}
                  placeholder="Name (optional)"
                  autoComplete="off"
                  name="ah-sale-name"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-2 text-sm outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10"
                  aria-label="Customer name"
                />
              </div>
            </div>
          )}
          {mode === 'walkin' && lookup?.allergies && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Allergy: {lookup.allergies}
            </p>
          )}
          {lookup && lookup.pendingCount > 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {lookup.name || 'This customer'} already has {lookup.pendingCount} unpaid bill{lookup.pendingCount > 1 ? 's' : ''}.
            </p>
          )}
        </div>

        {/* Lines */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">Medicines on the bill</p>
            {lines.length > 0 && <button onClick={() => { if (confirm('Clear this bill?')) reset(); }} className="cursor-pointer text-[11px] font-semibold text-slate-400 hover:text-rose-600">Clear all</button>}
          </div>
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-purple-100 px-6 py-8 text-center">
              <ShoppingCart className="mb-2 h-7 w-7 text-purple-200" />
              <p className="text-sm font-semibold text-slate-600">No medicines yet</p>
              <p className="mt-0.5 text-xs text-slate-400">Tap a medicine, or search / scan. Enter adds the top match.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {lines.map((l) => (
                <li key={l.med.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-500"><Package className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{l.med.name}</p>
                    <p className="font-mono text-[11px] text-slate-400">{npr(l.med.unitPrice)} each</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center rounded-xl border border-slate-200">
                      <button onClick={() => setQty(l.med.id, l.qty - 1)} className="flex h-7 w-7 cursor-pointer items-center justify-center text-slate-500 hover:text-slate-900" aria-label={`Less ${l.med.name}`}><Minus className="h-3.5 w-3.5" /></button>
                      <input
                        value={l.qty}
                        onChange={(e) => setQty(l.med.id, parseInt(e.target.value.replace(/\D/g, '') || '0', 10))}
                        inputMode="numeric"
                        className="h-7 w-9 border-x border-slate-200 text-center font-mono text-sm font-bold outline-none"
                        aria-label={`Quantity of ${l.med.name}`}
                      />
                      <button onClick={() => setQty(l.med.id, l.qty + 1)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-r-xl bg-purple-600 text-white hover:bg-purple-700" aria-label={`More ${l.med.name}`}><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <p className="font-mono text-xs font-bold text-slate-800">{npr(l.qty * l.med.unitPrice)}</p>
                  </div>
                  <button onClick={() => setQty(l.med.id, 0)} className="cursor-pointer rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${l.med.name}`}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Discount + note */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">Discount</span>
            <span className="text-xs text-slate-400">(optional)</span>
            <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-200 bg-white">
              <button onClick={() => setDiscountMode('amount')} className={cx('cursor-pointer px-2.5 py-1 text-xs font-bold', discountMode === 'amount' ? 'bg-purple-600 text-white' : 'text-slate-500')}>Rs</button>
              <button onClick={() => setDiscountMode('percent')} className={cx('cursor-pointer px-2.5 py-1 text-xs font-bold', discountMode === 'percent' ? 'bg-purple-600 text-white' : 'text-slate-500')}>%</button>
            </div>
            <input
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value.replace(/[^0-9.]/g, '').slice(0, 9))}
              inputMode="decimal"
              placeholder="0"
              className="h-8 w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 text-right font-mono text-sm outline-none focus:border-purple-500"
              aria-label="Discount"
            />
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder="Note (optional) — e.g. prescription by Dr. …"
            autoComplete="off"
            name="ah-sale-note"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-purple-500 focus:bg-white"
            aria-label="Note"
          />
        </div>
      </div>

      {/* Totals + buttons (always visible) */}
      <div className="space-y-3 border-t border-slate-100 bg-gradient-to-b from-white to-purple-50/40 p-5">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-500"><dt>Sub total</dt><dd className="font-mono">{npr(subTotal)}</dd></div>
          {discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd className="font-mono">− {npr(discount)}</dd></div>}
          {vatRate > 0 && <div className="flex justify-between text-slate-500"><dt>VAT {vatRate}%</dt><dd className="font-mono">{npr(vat)}</dd></div>}
          <div className="flex items-baseline justify-between pt-1">
            <dt className="font-bold text-slate-700">Bill total</dt>
            <dd className="font-mono text-3xl font-black tracking-tight text-purple-700">{npr(total)}</dd>
          </div>
        </dl>
        <div className="flex gap-2">
          {settings.allowDue && (
            <button
              onClick={putPending}
              disabled={!lines.length || saving}
              title="Save without payment — goes to Pending Bills (F8)"
              className="inline-flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-2 border-amber-300 bg-amber-50 px-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Clock className="h-4 w-4" /> Put in pending
            </button>
          )}
          <button
            onClick={openCheckout}
            disabled={!lines.length || saving}
            className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <ShoppingCart className="h-4 w-4" /> Complete sale
          </button>
        </div>
        {settings.allowDue && !hasWho && lines.length > 0 && (
          <p className="text-[11px] text-slate-400">For pending, pick a patient or type the customer’s name or phone.</p>
        )}
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={autoPrint} onChange={(e) => setPrint(e.target.checked)} className="accent-purple-600" />
            <Printer className="h-3 w-3" /> Print after saving ({settings.printSize})
          </label>
          <span className="hidden sm:inline">F2 search · F8 pending · F9 complete</span>
        </div>
      </div>
    </div>
  );

  // ---------- medicines (right) ----------
  const medCard = (m: Medicine) => {
    const ex = expiryState(m.expiryDate, settings.expiryAlertDays);
    const out = m.stock <= 0;
    const blocked = out || ex === 'expired';
    const qty = inCart(m.id);
    return (
      <div
        key={m.id}
        className={cx(
          'flex flex-col rounded-2xl border bg-white p-4 transition',
          blocked ? 'border-slate-200/70 opacity-55' : qty > 0 ? 'border-purple-400 shadow-md shadow-purple-500/10 ring-2 ring-purple-500/10' : 'border-slate-200/80 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md'
        )}
      >
        <button onClick={() => !blocked && add(m)} disabled={blocked} className="flex flex-1 cursor-pointer items-start gap-3 text-left disabled:cursor-not-allowed">
          <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', blocked ? 'bg-slate-100 text-slate-400' : 'bg-purple-50 text-purple-500')}><Package className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold text-slate-900">{m.name}</span>
            <span className="block truncate text-xs text-slate-500">{[m.genericName, m.dosage].filter(Boolean).join(' · ') || m.category}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1">
              {out ? <Badge tone="red">Out of stock</Badge> : <Badge tone={m.stock <= m.reorderLevel ? 'amber' : 'grey'}>{m.stock} in stock</Badge>}
              {ex === 'expired' && <Badge tone="red">Expired</Badge>}
              {ex === 'soon' && <Badge tone="amber">Exp {fmtExpiry(m.expiryDate)} · {daysUntil(m.expiryDate)}d</Badge>}
              {m.rackLocation && <span className="font-mono text-[10px] text-slate-400">{m.rackLocation}</span>}
            </span>
          </span>
        </button>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <p className="font-mono text-base font-black text-purple-700">{npr(m.unitPrice)}</p>
          {qty > 0 ? (
            <div className="flex items-center rounded-xl border border-slate-200">
              <button onClick={() => setQty(m.id, qty - 1)} className="flex h-8 w-8 cursor-pointer items-center justify-center text-slate-500 hover:text-slate-900" aria-label={`Less ${m.name}`}><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-8 text-center font-mono text-sm font-bold">{qty}</span>
              <button onClick={() => add(m)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-r-xl bg-purple-600 text-white hover:bg-purple-700" aria-label={`More ${m.name}`}><Plus className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => add(m)} disabled={blocked} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl bg-purple-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
      </div>
    );
  };

  const catalog = (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Medicines</h2>
          <p className="text-xs text-slate-500">Tap a medicine to add it to the bill.</p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
          {(['cards', 'table'] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } }}
              aria-pressed={view === v}
              className={cx('inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5', view === v ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500')}
            >
              {v === 'cards' ? <LayoutGrid className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />} {v === 'cards' ? 'Cards' : 'Table'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Search medicine, generic name, or scan barcode…"
            autoComplete="off"
            name="ah-sale-search"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10"
            aria-label="Search medicine"
          />
          <Barcode className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-12 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-purple-500" aria-label="Sort medicines">
          <option value="name">Sort: Name (A–Z)</option>
          <option value="price">Sort: Price (low first)</option>
          <option value="stock">Sort: Most stock</option>
          <option value="expiry">Sort: Expiring first</option>
        </select>
      </div>

      {categories.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 thin-scroll">
          {[['All', meds.length] as [string, number], ...categories].map(([c, n]) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cx('inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition', category === c ? 'border-purple-600 bg-purple-600 text-white shadow' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-200')}
            >
              {c === 'All' ? 'All medicines' : c} <span className={cx('rounded-full px-1.5 font-mono text-[10px]', category === c ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>{n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <Spinner label="Loading medicines…" />
        ) : loadError ? (
          <ErrorBox message={loadError} onRetry={load} />
        ) : meds.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-purple-100 p-10 text-center">
            <Package className="mx-auto mb-2 h-8 w-8 text-purple-200" />
            <p className="font-semibold text-slate-700">No medicines yet</p>
            <p className="text-sm text-slate-500">Add medicines in “Medicines &amp; Stock” first.</p>
          </div>
        ) : results.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No medicine matches “{query}”.</p>
        ) : view === 'cards' ? (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{results.map(medCard)}</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/70">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-3">Medicine</th><th className="px-3 py-3">Stock</th><th className="px-3 py-3">Expiry</th><th className="px-3 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Bill</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((m) => {
                  const ex = expiryState(m.expiryDate, settings.expiryAlertDays);
                  const blocked = m.stock <= 0 || ex === 'expired';
                  const qty = inCart(m.id);
                  return (
                    <tr key={m.id} className={cx(blocked && 'opacity-55', qty > 0 && 'bg-purple-50/50')}>
                      <td className="px-4 py-2.5"><p className="font-bold text-slate-900">{m.name}</p><p className="text-[11px] text-slate-500">{[m.genericName, m.dosage].filter(Boolean).join(' · ')}</p></td>
                      <td className="px-3 py-2.5 font-mono text-xs">{m.stock <= 0 ? <span className="font-bold text-rose-600">Out</span> : m.stock}</td>
                      <td className={cx('px-3 py-2.5 text-xs', ex === 'expired' ? 'font-bold text-rose-600' : ex === 'soon' ? 'font-bold text-amber-600' : 'text-slate-500')}>{m.expiryDate ? fmtExpiry(m.expiryDate) : '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-purple-700">{npr(m.unitPrice)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => add(m)} disabled={blocked} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-purple-600 px-2.5 text-[11px] font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
                          <Plus className="h-3 w-3" /> {qty > 0 ? `×${qty}` : 'Add'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="pb-24 xl:pb-0">
      {/* Page header (RMS style) */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30"><ShoppingCart className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-[28px]">New Sale</h1>
            <p className="text-sm text-slate-500">Billing as {staff.staffName || staff.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:border-purple-200 hover:text-purple-700">
            <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} /> <span className="hidden sm:inline">Refresh stock</span>
          </button>
          <button onClick={toggleFull} className="hidden h-10 cursor-pointer items-center gap-2 rounded-xl border border-purple-200 bg-white px-3 text-sm font-bold text-purple-700 hover:bg-purple-50 sm:inline-flex">
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />} {full ? 'Exit full screen' : 'Full screen'}
          </button>
          {lines.length > 0 && (
            <button onClick={() => { if (confirm('Clear this bill?')) reset(); }} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600">
              <X className="h-4 w-4" /> <span className="hidden sm:inline">Clear bill</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        {/* Bill (big screens) */}
        <aside className="hidden xl:block">
          <div className="sticky top-24 h-[calc(100vh-11.5rem)] min-h-[540px] overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm">{billCard}</div>
        </aside>
        <div className="min-w-0">{catalog}</div>
      </div>

      {/* Small screens: bottom bar + bill sheet */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur xl:hidden">
        <button onClick={() => setCartOpen(true)} className="flex h-12 w-full cursor-pointer items-center justify-between rounded-2xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 px-4 font-bold text-white shadow-lg shadow-purple-500/25">
          <span className="inline-flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Bill · {itemCount} item{itemCount === 1 ? '' : 's'}</span>
          <span className="font-mono">{npr(total)}</span>
        </button>
      </div>
      {cartOpen && createPortal(
        <div className="fixed inset-0 z-[55] xl:hidden" role="dialog" aria-modal="true" aria-label="Bill">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setCartOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex h-[94vh] animate-slide-up flex-col overflow-hidden rounded-t-3xl bg-white sm:inset-x-auto sm:right-0 sm:top-0 sm:h-full sm:w-[460px] sm:rounded-none sm:rounded-l-3xl">
            <div className="flex items-center justify-end px-3 pt-3">
              <button onClick={() => setCartOpen(false)} className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close bill"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{billCard}</div>
          </div>
        </div>,
        document.body
      )}

      <SaleCheckout
        open={checkout}
        onClose={() => setCheckout(false)}
        lines={lines}
        subTotal={subTotal}
        discount={discount}
        vatRate={vatRate}
        vat={vat}
        total={total}
        customerName={billName}
        customerPhone={billPhone}
        isPatient={!!patientId}
        allergies={allergies}
        initialMethod="Cash"
        allowDue={settings.allowDue}
        saving={saving}
        autoPrint={autoPrint}
        onAutoPrint={setPrint}
        onPay={(m) => save(m)}
        onPending={putPending}
      />

      <BillModal sale={done} justCreated onClose={() => { setDone(null); setTimeout(() => searchRef.current?.focus(), 50); }} onChanged={setDone} />
    </div>
  );
}
