// 🚚 SUPPLIERS — distributors you buy medicines from (picked when restocking)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Pencil, Phone, Plus, Search, Trash2, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/app';
import type { Medicine, Supplier } from '../lib/types';
import { Button, Card, Confirm, Empty, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Textarea, useToast } from './ui';

const empty = { name: '', contactName: '', phone: '', address: '', panNo: '', note: '' };

export default function Suppliers() {
  const { staff } = useApp();
  const toast = useToast();
  const canDelete = ['Manager', 'Inventory Manager'].includes(staff.role);
  const [rows, setRows] = useState<Supplier[]>([]);
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [s, m] = await Promise.all([api<Supplier[]>('/suppliers'), api<Medicine[]>('/inventory')]);
    setLoading(false);
    if (!s.ok) return setError(s.message);
    setRows(s.data);
    if (m.ok) setMeds(m.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const medCount = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of meds) if (m.supplier) c[m.supplier.toLowerCase()] = (c[m.supplier.toLowerCase()] || 0) + 1;
    return c;
  }, [meds]);

  const shown = rows.filter((r) => {
    const t = q.trim().toLowerCase();
    return !t || [r.name, r.contactName, r.phone, r.address].some((v) => (v || '').toLowerCase().includes(t));
  });

  const startAdd = () => { setEditing(null); setForm({ ...empty }); setOpen(true); };
  const startEdit = (s: Supplier) => { setEditing(s); setForm({ name: s.name, contactName: s.contactName, phone: s.phone, address: s.address, panNo: s.panNo, note: s.note }); setOpen(true); };
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) return toast('Supplier name is required.', 'error');
    setBusy(true);
    const r = await api<Supplier>(editing ? `/suppliers/${editing._id}` : '/suppliers', { method: editing ? 'PUT' : 'POST', body: form });
    setBusy(false);
    if (!r.ok) return toast(r.message, 'error');
    toast(r.message || 'Saved.');
    setOpen(false);
    load();
  };
  const remove = async () => {
    if (!del) return;
    setBusy(true);
    const r = await api(`/suppliers/${del._id}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) return toast(r.message, 'error');
    toast('Supplier deleted.');
    setDel(null);
    load();
  };

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Distributors you buy from. Pick them when you restock." actions={<Button onClick={startAdd} icon={<Plus className="h-4 w-4" />}>Add supplier</Button>} />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers" className="pl-9" aria-label="Search suppliers" />
      </div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : shown.length === 0 ? (
        <Card><Empty icon={<Truck className="h-6 w-6" />} title={rows.length ? 'Nothing matches' : 'No suppliers yet'} text={rows.length ? undefined : 'Add the distributors you buy medicines from.'} action={!rows.length ? <Button onClick={startAdd} icon={<Plus className="h-4 w-4" />}>Add supplier</Button> : undefined} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => (
            <Card key={s._id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold">{s.name}</p>
                  {s.contactName && <p className="text-sm text-ink/60">{s.contactName}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(s)} className="cursor-pointer rounded-lg p-1.5 text-ink/45 hover:bg-ink/5 hover:text-ink" aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" /></button>
                  {canDelete && <button onClick={() => setDel(s)} className="cursor-pointer rounded-lg p-1.5 text-ink/45 hover:bg-danger/10 hover:text-danger" aria-label={`Delete ${s.name}`}><Trash2 className="h-4 w-4" /></button>}
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-ink/65">
                {s.phone && <a href={`tel:${s.phone}`} className="flex items-center gap-2 hover:text-green"><Phone className="h-3.5 w-3.5" /> {s.phone}</a>}
                {s.address && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {s.address}</p>}
                {s.panNo && <p className="font-mono text-xs">PAN {s.panNo}</p>}
                {s.note && <p className="text-xs text-ink/50">{s.note}</p>}
              </div>
              <p className="mt-3 border-t border-foil/60 pt-2 text-xs text-ink/45">{medCount[s.name.toLowerCase()] || 0} medicines from this supplier</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} busy={busy} title={editing ? 'Edit supplier' : 'Add supplier'} footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={save} loading={busy}>Save supplier</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Supplier name" required className="sm:col-span-2"><Input value={form.name} onChange={set('name')} maxLength={120} /></Field>
          <Field label="Contact person"><Input value={form.contactName} onChange={set('contactName')} maxLength={80} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={set('phone')} inputMode="tel" maxLength={30} /></Field>
          <Field label="Address"><Input value={form.address} onChange={set('address')} maxLength={200} /></Field>
          <Field label="PAN / VAT no."><Input value={form.panNo} onChange={set('panNo')} maxLength={30} /></Field>
          <Field label="Note" className="sm:col-span-2"><Textarea value={form.note} onChange={set('note')} maxLength={300} placeholder="e.g. Delivers on Sunday and Wednesday" /></Field>
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} busy={busy} title={`Delete ${del?.name || ''}?`} text="Medicines keep the supplier name already written on them." confirmLabel="Delete supplier" onConfirm={remove} />
    </div>
  );
}
