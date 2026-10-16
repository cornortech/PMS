// =====================================================================
// 💊 MEDICINES & STOCK
//  • Add / edit medicines (batch, expiry, rack, barcode, prices, reorder level)
//  • 📦 Restock: new stock arrived (adds to the stock, can update batch / expiry / cost)
//  • ✏️ Correct stock: set the real counted number (broken, lost, thrown away) with a reason
//  • 🕓 History: every sale, restock, cancelled bill and correction
//  • Filters: low stock, out of stock, expiring soon, expired
// =====================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, History, MoreHorizontal, Package, PackagePlus, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/app';
import { cx, daysUntil, downloadCsv, expiryState, fmtDateTime, fmtExpiry, npr } from '../lib/format';
import type { Medicine, StockMove, Supplier } from '../lib/types';
import { Badge, Button, Card, Chips, Confirm, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Textarea, useToast } from './ui';

const CATEGORIES = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Powder', 'Device', 'Cosmetic', 'Other'];
type Filter = 'all' | 'low' | 'out' | 'soon' | 'expired';

const emptyForm = {
  name: '', genericName: '', category: 'Tablet', dosage: '', unit: 'pcs', costPrice: '', unitPrice: '', stock: '',
  reorderLevel: '10', sku: '', expiryDate: '', batchNo: '', supplier: '', rackLocation: '',
};

export default function Medicines() {
  const { staff, settings } = useApp();
  const toast = useToast();
  const canEdit = ['Manager', 'Pharmacist', 'Inventory Manager'].includes(staff.role);
  const canDelete = ['Manager', 'Inventory Manager'].includes(staff.role);
  const showCost = ['Manager', 'Pharmacist', 'Inventory Manager'].includes(staff.role);

  const [meds, setMeds] = useState<Medicine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [cat, setCat] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [restockFor, setRestockFor] = useState<Medicine | null>(null);
  const [restock, setRestock] = useState({ quantity: '', costPrice: '', unitPrice: '', expiryDate: '', batchNo: '', supplier: '', note: '' });
  const [adjustFor, setAdjustFor] = useState<Medicine | null>(null);
  const [adjust, setAdjust] = useState({ newStock: '', reason: '' });
  const [historyFor, setHistoryFor] = useState<Medicine | null>(null);
  const [history, setHistory] = useState<StockMove[] | null>(null);
  const [deleteFor, setDeleteFor] = useState<Medicine | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const r = await api<Medicine[]>('/inventory');
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setMeds(r.data);
  }, []);
  useEffect(() => {
    load();
    if (canEdit) api<Supplier[]>('/suppliers').then((r) => r.ok && setSuppliers(r.data));
  }, [load, canEdit]);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuFor]);

  const alert = settings.expiryAlertDays;
  const counts = useMemo(
    () => ({
      low: meds.filter((m) => m.stock > 0 && m.stock <= m.reorderLevel).length,
      out: meds.filter((m) => m.stock <= 0).length,
      soon: meds.filter((m) => expiryState(m.expiryDate, alert) === 'soon' && m.stock > 0).length,
      expired: meds.filter((m) => expiryState(m.expiryDate, alert) === 'expired' && m.stock > 0).length,
    }),
    [meds, alert]
  );

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return meds
      .filter((m) => {
        if (cat && m.category !== cat) return false;
        if (filter === 'low' && !(m.stock > 0 && m.stock <= m.reorderLevel)) return false;
        if (filter === 'out' && m.stock > 0) return false;
        if (filter === 'soon' && !(expiryState(m.expiryDate, alert) === 'soon' && m.stock > 0)) return false;
        if (filter === 'expired' && !(expiryState(m.expiryDate, alert) === 'expired' && m.stock > 0)) return false;
        if (!t) return true;
        return [m.name, m.genericName, m.sku, m.batchNo, m.supplier, m.rackLocation].some((v) => (v || '').toLowerCase().includes(t));
      })
      .sort((a, b) => (filter === 'soon' || filter === 'expired' ? daysUntil(a.expiryDate) - daysUntil(b.expiryDate) : a.name.localeCompare(b.name)));
  }, [meds, q, filter, cat, alert]);

  const stockValue = meds.reduce((s, m) => s + m.costPrice * Math.max(0, m.stock), 0);
  const retailValue = meds.reduce((s, m) => s + m.unitPrice * Math.max(0, m.stock), 0);

  // ---------- add / edit ----------
  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  };
  const openEdit = (m: Medicine) => {
    setEditing(m);
    setForm({
      name: m.name, genericName: m.genericName, category: m.category, dosage: m.dosage, unit: m.unit || 'pcs',
      costPrice: String(m.costPrice), unitPrice: String(m.unitPrice), stock: String(m.stock), reorderLevel: String(m.reorderLevel),
      sku: m.sku, expiryDate: m.expiryDate, batchNo: m.batchNo, supplier: m.supplier, rackLocation: m.rackLocation,
    });
    setFormOpen(true);
  };
  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) return toast('Medicine name is required.', 'error');
    if (form.unitPrice === '' || Number(form.unitPrice) < 0) return toast('Please enter the selling price.', 'error');
    if (Number(form.costPrice) > Number(form.unitPrice)) {
      if (!confirm('Cost price is higher than the selling price. Save anyway?')) return;
    }
    setSaving(true);
    const body: any = { ...form };
    if (editing) delete body.stock; // stock changes go through Restock / Correct stock
    const r = await api<Medicine>(editing ? `/inventory/${editing.id}` : '/inventory', { method: editing ? 'PUT' : 'POST', body });
    setSaving(false);
    if (!r.ok) return toast(r.message, 'error');
    toast(r.message || 'Saved.');
    setFormOpen(false);
    setMeds((ms) => (editing ? ms.map((m) => (m.id === r.data.id ? r.data : m)) : [...ms, r.data]));
  };

  // ---------- restock / correct ----------
  const doRestock = async () => {
    if (!restockFor) return;
    const qty = parseInt(restock.quantity, 10);
    if (!qty || qty < 1) return toast('Enter how many arrived.', 'error');
    setSaving(true);
    const r = await api<Medicine>(`/inventory/${restockFor.id}/restock`, { method: 'POST', body: { ...restock, quantity: qty } });
    setSaving(false);
    if (!r.ok) return toast(r.message, 'error');
    toast(r.message || 'Stock added.');
    setRestockFor(null);
    setMeds((ms) => ms.map((m) => (m.id === r.data.id ? r.data : m)));
  };
  const doAdjust = async () => {
    if (!adjustFor) return;
    if (adjust.newStock === '') return toast('Enter the counted stock.', 'error');
    if (!adjust.reason.trim()) return toast('Please write a reason.', 'error');
    setSaving(true);
    const r = await api<Medicine>(`/inventory/${adjustFor.id}/adjust`, { method: 'POST', body: { newStock: Number(adjust.newStock), reason: adjust.reason.trim() } });
    setSaving(false);
    if (!r.ok) return toast(r.message, 'error');
    toast(r.message || 'Stock corrected.');
    setAdjustFor(null);
    setMeds((ms) => ms.map((m) => (m.id === r.data.id ? r.data : m)));
  };
  const openHistory = async (m: Medicine) => {
    setHistoryFor(m);
    setHistory(null);
    const r = await api<StockMove[]>(`/stock-movements?medicineId=${m.id}`);
    setHistory(r.ok ? r.data : []);
    if (!r.ok) toast(r.message, 'error');
  };
  const doDelete = async () => {
    if (!deleteFor) return;
    setSaving(true);
    const r = await api(`/inventory/${deleteFor.id}`, { method: 'DELETE' });
    setSaving(false);
    if (!r.ok) return toast(r.message, 'error');
    toast(r.message || 'Deleted.');
    setMeds((ms) => ms.filter((m) => m.id !== deleteFor.id));
    setDeleteFor(null);
  };

  const exportCsv = () =>
    downloadCsv('medicines-stock.csv', [
      ['Name', 'Generic', 'Category', 'Strength', 'Stock', 'Unit', 'Reorder level', ...(showCost ? ['Cost price'] : []), 'Selling price', 'Batch', 'Expiry', 'Rack', 'Barcode', 'Supplier'],
      ...shown.map((m) => [m.name, m.genericName, m.category, m.dosage, m.stock, m.unit, m.reorderLevel, ...(showCost ? [m.costPrice] : []), m.unitPrice, m.batchNo, m.expiryDate, m.rackLocation, m.sku, m.supplier]),
    ]);

  const ExpiryCell = ({ m }: { m: Medicine }) => {
    const s = expiryState(m.expiryDate, alert);
    if (s === 'none') return <span className="text-ink/35">—</span>;
    const d = daysUntil(m.expiryDate);
    return (
      <div>
        <p className={cx('font-mono text-xs font-bold', s === 'expired' ? 'text-danger' : s === 'soon' ? 'text-[#9a6a00]' : 'text-ink/70')}>{fmtExpiry(m.expiryDate)}</p>
        <p className="text-[10px] text-ink/45">{s === 'expired' ? `expired ${-d}d ago` : `${d} days left`}</p>
      </div>
    );
  };

  const StockCell = ({ m }: { m: Medicine }) => (
    <div className="flex items-center gap-2">
      <span className={cx('font-bold tabular', m.stock <= 0 ? 'text-danger' : m.stock <= m.reorderLevel ? 'text-[#9a6a00]' : 'text-ink')}>{m.stock}</span>
      <span className="text-[11px] text-ink/40">{m.unit}</span>
      {m.stock <= 0 ? <Badge tone="red">Out</Badge> : m.stock <= m.reorderLevel ? <Badge tone="amber">Low</Badge> : null}
    </div>
  );

  const Actions = ({ m }: { m: Medicine }) =>
    canEdit ? (
      <div className="relative flex items-center justify-end gap-1">
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setRestock({ quantity: '', costPrice: '', unitPrice: '', expiryDate: '', batchNo: '', supplier: m.supplier, note: '' }); setRestockFor(m); }} icon={<PackagePlus className="h-3.5 w-3.5" />}>
          Restock
        </Button>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === m.id ? null : m.id); }}
          className="cursor-pointer rounded-lg p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink"
          aria-label={`More actions for ${m.name}`}
          aria-expanded={menuFor === m.id}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuFor === m.id && (
          <div className="absolute right-0 top-9 z-20 w-48 animate-scale-in overflow-hidden rounded-xl border border-foil bg-white py-1 text-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={() => { setMenuFor(null); openEdit(m); }}>Edit details</MenuItem>
            <MenuItem icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => { setMenuFor(null); setAdjust({ newStock: String(m.stock), reason: '' }); setAdjustFor(m); }}>Correct stock</MenuItem>
            <MenuItem icon={<History className="h-4 w-4" />} onClick={() => { setMenuFor(null); openHistory(m); }}>Stock history</MenuItem>
            {canDelete && <MenuItem icon={<Trash2 className="h-4 w-4" />} danger onClick={() => { setMenuFor(null); setDeleteFor(m); }}>Delete</MenuItem>}
          </div>
        )}
      </div>
    ) : null;

  return (
    <div>
      <PageHeader
        title="Medicines & Stock"
        subtitle={`${meds.length} medicines${counts.expired ? ` · ${counts.expired} expired on the shelf` : ''}`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!shown.length} icon={<Download className="h-4 w-4" />}>Excel</Button>
            {canEdit && <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>Add medicine</Button>}
          </>
        }
      />

      {showCost && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Stock value (cost)" value={npr(stockValue)} />
          <Stat label="Stock value (selling)" value={npr(retailValue)} tone="ink" />
          <Stat label="Low or out of stock" value={String(counts.low + counts.out)} tone="amber" onClick={() => setFilter('low')} />
          <Stat label={`Expiring in ${alert} days`} value={String(counts.soon)} tone={counts.expired ? 'red' : 'amber'} note={counts.expired ? `${counts.expired} already expired` : undefined} onClick={() => setFilter(counts.expired ? 'expired' : 'soon')} />
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-foil/60 p-3">
          <Chips<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: meds.length },
              { value: 'low', label: 'Low', count: counts.low },
              { value: 'out', label: 'Out of stock', count: counts.out },
              { value: 'soon', label: 'Expiring soon', count: counts.soon },
              { value: 'expired', label: 'Expired', count: counts.expired },
            ]}
          />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 !w-auto" aria-label="Category">
            <option value="">All types</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, generic, batch, barcode, rack" className="h-9 pl-9" aria-label="Search medicines" />
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4"><ErrorBox message={error} onRetry={load} /></div>
        ) : shown.length === 0 ? (
          <Empty
            icon={<Package className="h-6 w-6" />}
            title={meds.length ? 'Nothing matches' : 'No medicines yet'}
            text={meds.length ? 'Try another search or filter.' : 'Add your first medicine with its price, stock and expiry date.'}
            action={!meds.length && canEdit ? <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>Add medicine</Button> : undefined}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-[11px] uppercase tracking-wide text-ink/50">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Medicine</th>
                    <th className="px-4 py-2.5 font-semibold">Stock</th>
                    <th className="px-4 py-2.5 font-semibold">Expiry</th>
                    <th className="px-4 py-2.5 font-semibold">Batch / Rack</th>
                    {showCost && <th className="px-4 py-2.5 text-right font-semibold">Cost</th>}
                    <th className="px-4 py-2.5 text-right font-semibold">Price</th>
                    {canEdit && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-foil/50">
                  {shown.map((m) => (
                    <tr key={m.id} className="hover:bg-mint/30">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-ink">{m.name}</p>
                        <p className="text-xs text-ink/50">{[m.genericName, m.dosage, m.category].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className="px-4 py-2.5"><StockCell m={m} /></td>
                      <td className="px-4 py-2.5"><ExpiryCell m={m} /></td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink/60">
                        {m.batchNo || '—'}
                        {m.rackLocation && <span className="block text-[10px] text-ink/40">{m.rackLocation}</span>}
                      </td>
                      {showCost && <td className="px-4 py-2.5 text-right text-ink/60 tabular">{npr(m.costPrice)}</td>}
                      <td className="px-4 py-2.5 text-right font-semibold tabular">{npr(m.unitPrice)}</td>
                      {canEdit && <td className="px-4 py-2.5"><Actions m={m} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Phone cards */}
            <ul className="divide-y divide-foil/50 md:hidden">
              {shown.map((m) => (
                <li key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-xs text-ink/50">{[m.genericName, m.dosage].filter(Boolean).join(' · ') || m.category}</p>
                    </div>
                    <p className="font-semibold tabular">{npr(m.unitPrice)}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StockCell m={m} />
                    <ExpiryCell m={m} />
                  </div>
                  {canEdit && <div className="mt-3"><Actions m={m} /></div>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* Add / edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        busy={saving}
        width="max-w-2xl"
        title={editing ? `Edit ${editing.name}` : 'Add medicine'}
        subtitle={editing ? 'To change the stock, use Restock or Correct stock.' : 'Fields with * are needed.'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save changes' : 'Add medicine'}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Medicine (brand) name" required className="sm:col-span-2"><Input value={form.name} onChange={set('name')} placeholder="e.g. Cetamol 500mg" maxLength={120} /></Field>
          <Field label="Generic name"><Input value={form.genericName} onChange={set('genericName')} placeholder="e.g. Paracetamol" maxLength={120} /></Field>
          <Field label="Strength"><Input value={form.dosage} onChange={set('dosage')} placeholder="e.g. 500 mg, 100 ml" maxLength={60} /></Field>
          <Field label="Type">
            <Select value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          </Field>
          <Field label="Sold per" hint="pcs, strip, bottle, tube…"><Input value={form.unit} onChange={set('unit')} maxLength={20} /></Field>
          <Field label="Cost price (Rs)" hint="What you pay the supplier"><Input value={form.costPrice} onChange={set('costPrice')} inputMode="decimal" type="number" min="0" step="0.01" /></Field>
          <Field label="Selling price (Rs)" required><Input value={form.unitPrice} onChange={set('unitPrice')} inputMode="decimal" type="number" min="0" step="0.01" /></Field>
          {!editing && <Field label="Opening stock"><Input value={form.stock} onChange={set('stock')} inputMode="numeric" type="number" min="0" /></Field>}
          <Field label="Low-stock alert at" hint="Shown as Low at or below this"><Input value={form.reorderLevel} onChange={set('reorderLevel')} inputMode="numeric" type="number" min="0" /></Field>
          <Field label="Expiry date"><Input value={form.expiryDate} onChange={set('expiryDate')} type="date" /></Field>
          <Field label="Batch no."><Input value={form.batchNo} onChange={set('batchNo')} maxLength={40} /></Field>
          <Field label="Barcode / SKU" hint="Scan it here to fill"><Input value={form.sku} onChange={set('sku')} maxLength={60} /></Field>
          <Field label="Rack / shelf"><Input value={form.rackLocation} onChange={set('rackLocation')} placeholder="e.g. A3" maxLength={40} /></Field>
          <Field label="Supplier" className="sm:col-span-2">
            <Input value={form.supplier} onChange={set('supplier')} list="supplier-list" maxLength={120} placeholder="Type or pick" />
          </Field>
        </div>
        <datalist id="supplier-list">{suppliers.map((s) => <option key={s._id} value={s.name} />)}</datalist>
      </Modal>

      {/* Restock */}
      <Modal
        open={!!restockFor}
        onClose={() => setRestockFor(null)}
        busy={saving}
        title={`Restock ${restockFor?.name || ''}`}
        subtitle={restockFor ? `Now in stock: ${restockFor.stock} ${restockFor.unit}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestockFor(null)} disabled={saving}>Cancel</Button>
            <Button onClick={doRestock} loading={saving} icon={<PackagePlus className="h-4 w-4" />}>
              Add {parseInt(restock.quantity, 10) > 0 ? restock.quantity : ''} to stock
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="How many arrived?" required className="sm:col-span-2">
            <Input value={restock.quantity} onChange={(e) => setRestock((r) => ({ ...r, quantity: e.target.value.replace(/\D/g, '').slice(0, 7) }))} inputMode="numeric" placeholder="e.g. 100" />
          </Field>
          <Field label="New batch no." hint="Leave empty to keep"><Input value={restock.batchNo} onChange={(e) => setRestock((r) => ({ ...r, batchNo: e.target.value }))} maxLength={40} /></Field>
          <Field label="New expiry date" hint="Leave empty to keep"><Input type="date" value={restock.expiryDate} onChange={(e) => setRestock((r) => ({ ...r, expiryDate: e.target.value }))} /></Field>
          <Field label="New cost price" hint={restockFor ? `Now ${npr(restockFor.costPrice)}` : ''}><Input type="number" min="0" step="0.01" value={restock.costPrice} onChange={(e) => setRestock((r) => ({ ...r, costPrice: e.target.value }))} /></Field>
          <Field label="New selling price" hint={restockFor ? `Now ${npr(restockFor.unitPrice)}` : ''}><Input type="number" min="0" step="0.01" value={restock.unitPrice} onChange={(e) => setRestock((r) => ({ ...r, unitPrice: e.target.value }))} /></Field>
          <Field label="Supplier" className="sm:col-span-2"><Input value={restock.supplier} onChange={(e) => setRestock((r) => ({ ...r, supplier: e.target.value }))} list="supplier-list" maxLength={120} /></Field>
          <Field label="Note" className="sm:col-span-2"><Input value={restock.note} onChange={(e) => setRestock((r) => ({ ...r, note: e.target.value }))} placeholder="e.g. Invoice #4521" maxLength={200} /></Field>
        </div>
        <datalist id="supplier-list">{suppliers.map((s) => <option key={s._id} value={s.name} />)}</datalist>
      </Modal>

      {/* Correct stock */}
      <Modal
        open={!!adjustFor}
        onClose={() => setAdjustFor(null)}
        busy={saving}
        width="max-w-md"
        title={`Correct stock: ${adjustFor?.name || ''}`}
        subtitle="Set the real number you counted on the shelf."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustFor(null)} disabled={saving}>Cancel</Button>
            <Button onClick={doAdjust} loading={saving}>Save correct stock</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Counted stock" required hint={adjustFor ? `System says ${adjustFor.stock}${adjust.newStock !== '' ? ` → change ${Number(adjust.newStock) - adjustFor.stock >= 0 ? '+' : ''}${Number(adjust.newStock) - adjustFor.stock}` : ''}` : ''}>
            <Input value={adjust.newStock} onChange={(e) => setAdjust((a) => ({ ...a, newStock: e.target.value.replace(/\D/g, '').slice(0, 7) }))} inputMode="numeric" />
          </Field>
          <Field label="Reason" required>
            <Textarea value={adjust.reason} onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))} maxLength={200} placeholder="e.g. 2 strips damaged, expired stock thrown away, counting mistake" />
          </Field>
        </div>
      </Modal>

      {/* History */}
      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title={`Stock history: ${historyFor?.name || ''}`} subtitle={historyFor ? `Now ${historyFor.stock} ${historyFor.unit}` : ''} width="max-w-2xl">
        {history === null ? (
          <Spinner />
        ) : history.length === 0 ? (
          <Empty title="No stock changes yet" text="Sales, restocks and corrections from now on will appear here." />
        ) : (
          <ul className="divide-y divide-foil/50">
            {history.map((h) => (
              <li key={h._id} className="flex items-center gap-3 py-2.5">
                <span className={cx('w-14 shrink-0 text-right font-mono text-sm font-bold tabular', h.change > 0 ? 'text-green' : 'text-danger')}>
                  {h.change > 0 ? '+' : ''}{h.change}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{h.type}</p>
                  <p className="truncate text-xs text-ink/50">{h.note || '—'}{h.by ? ` · by ${h.by}` : ''}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold tabular">= {h.stockAfter}</p>
                  <p className="text-ink/45">{fmtDateTime(h.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Confirm
        open={!!deleteFor}
        onClose={() => setDeleteFor(null)}
        busy={saving}
        title={`Delete ${deleteFor?.name || ''}?`}
        text="It will be removed from your stock list. Old bills will still show it. This cannot be undone."
        confirmLabel="Delete medicine"
        onConfirm={doDelete}
      />
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cx('flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left hover:bg-paper', danger ? 'text-danger' : 'text-ink/80')}>
      {icon} {children}
    </button>
  );
}
