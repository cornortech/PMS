// =====================================================================
// 🧑‍⚕️ PATIENT PICKER (used on New Sale) — same idea as "Customer details" in Atithi RMS
//  • Search a saved patient by name or phone and pick them
//  • Or create a new patient right here (name + phone, optional age, gender, allergies)
// =====================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Phone, Search, UserPlus, X } from 'lucide-react';
import { api } from '../lib/api';
import { cx, phoneDigits } from '../lib/format';
import { Button, Field, Input, Modal, Select, useToast } from './ui';

export type PickedPatient = { id: string; name: string; phone: string; allergies: string[]; age?: string; gender?: string };

const toPicked = (p: any): PickedPatient => ({
  id: String(p.id || p._id),
  name: p.name || p.fullName || '',
  phone: p.phone || p.phoneNumber || '',
  allergies: Array.isArray(p.allergies) ? p.allergies : [],
  age: p.age || '',
  gender: p.gender || '',
});

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'P';

export default function PatientPicker({ value, onChange }: { value: PickedPatient | null; onChange: (p: PickedPatient | null) => void }) {
  const toast = useToast();
  const [list, setList] = useState<PickedPatient[] | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', age: '', gender: 'Not Specified', allergies: '' });
  const box = useRef<HTMLDivElement>(null);

  // Load this pharmacy's patients once
  useEffect(() => {
    let alive = true;
    api<any[]>('/patients').then((r) => alive && setList(r.ok ? r.data.map(toPicked) : []));
    return () => { alive = false; };
  }, []);

  // Close the list when clicking outside
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    const d = phoneDigits(q);
    if (!list) return [];
    if (!t) return list.slice(0, 6);
    return list.filter((p) => p.name.toLowerCase().includes(t) || (d.length >= 3 && phoneDigits(p.phone).includes(d))).slice(0, 8);
  }, [list, q]);

  const startCreate = () => {
    const digits = phoneDigits(q);
    setForm({ name: digits.length >= 7 ? '' : q.trim(), phone: digits.length >= 7 ? q.trim() : '', age: '', gender: 'Not Specified', allergies: '' });
    setOpen(false);
    setCreating(true);
  };

  const create = async () => {
    if (!form.name.trim()) return toast('Patient name is required.', 'error');
    if (phoneDigits(form.phone).length < 7) return toast('Enter a valid phone number.', 'error');
    setBusy(true);
    const r = await api<any>('/patients', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        phoneNumber: form.phone.trim(),
        age: form.age.trim(),
        gender: form.gender,
        allergies: form.allergies.split(',').map((s) => s.trim()).filter(Boolean),
      },
    });
    setBusy(false);
    if (!r.ok) return toast(r.message, 'error');
    const p = toPicked(r.data);
    setList((l) => [p, ...(l || [])]);
    onChange(p);
    setCreating(false);
    setQ('');
    toast(`${p.name} saved as a new patient.`);
  };

  // ---- a patient is selected ----
  if (value) {
    return (
      <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white">{initials(value.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{value.name}</p>
            <p className="flex items-center gap-1 text-[11px] text-slate-500">
              <Phone className="h-3 w-3" /> {value.phone || '—'}
              {(value.age || (value.gender && value.gender !== 'Not Specified')) && <span>· {[value.age && `${value.age} yrs`, value.gender !== 'Not Specified' && value.gender].filter(Boolean).join(', ')}</span>}
            </p>
          </div>
          <button onClick={() => onChange(null)} className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Remove patient">
            <X className="h-4 w-4" />
          </button>
        </div>
        {value.allergies.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Allergy: {value.allergies.join(', ')}
          </p>
        )}
      </div>
    );
  }

  // ---- search / create ----
  return (
    <div ref={box} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value.slice(0, 60)); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search patient by name or phone"
            autoComplete="off"
            name="ah-patient-search"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10"
            aria-label="Search patient"
          />
        </div>
        <button onClick={startCreate} className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3 text-xs font-bold text-purple-700 hover:bg-purple-50">
          <UserPlus className="h-4 w-4" /> New
        </button>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-12 z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {list === null ? (
            <p className="px-4 py-3 text-xs text-slate-400">Loading patients…</p>
          ) : matches.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-500">
              No patient found{q ? ` for “${q}”` : ''}.{' '}
              <button onClick={startCreate} className="cursor-pointer font-bold text-purple-700 underline">Create new patient</button>
            </div>
          ) : (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => { onChange(p); setOpen(false); setQ(''); }}
                    className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left hover:bg-purple-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-[10px] font-bold text-white">{initials(p.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{p.name}</span>
                      <span className="block text-[11px] text-slate-500">{p.phone}</span>
                    </span>
                    {p.allergies.length > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">Allergy</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        busy={busy}
        width="max-w-md"
        title="New patient"
        subtitle="Saved in Patients, so next time you can just search them."
        footer={<><Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button><Button onClick={create} loading={busy} icon={<UserPlus className="h-4 w-4" />}>Save & select</Button></>}
      >
        <form onSubmit={(e) => { e.preventDefault(); create(); }} autoComplete="off" className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" required className="sm:col-span-2"><Input name="ah-np-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 80) })} placeholder="e.g. Sita Sharma" /></Field>
          <Field label="Phone" required><Input name="ah-np-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^0-9+\-\s]/g, '').slice(0, 20) })} inputMode="tel" placeholder="98XXXXXXXX" /></Field>
          <Field label="Age"><Input name="ah-np-age" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" placeholder="e.g. 45" /></Field>
          <Field label="Gender" className="sm:col-span-2">
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              {['Not Specified', 'Male', 'Female', 'Other'].map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Allergies" hint="Separate with commas, e.g. Penicillin, Sulfa" className="sm:col-span-2">
            <Input name="ah-np-allergy" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value.slice(0, 200) })} placeholder="None" />
          </Field>
          <button type="submit" className="hidden" />
        </form>
      </Modal>
      <span className={cx('sr-only')} aria-live="polite">{open ? `${matches.length} patients` : ''}</span>
    </div>
  );
}
