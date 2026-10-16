// =====================================================================
// 👥 STAFF — add your team, give each person a role, reset passwords.
// Used by the pharmacy Manager (own pharmacy) and by the super admin (any pharmacy).
// =====================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Trash2, UserCog } from 'lucide-react';
import { api } from '../lib/api';
import { ROLE_LABEL, ROLE_PAGES } from '../lib/app';
import { cx, fmtDate } from '../lib/format';
import { Badge, Button, Card, Confirm, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, useToast } from './ui';

type Staff = { _id: string; id: string; staffName: string; role: string; pharmacyName: string; isActive: boolean; createdAt?: string };

export const ROLES = ['Manager', 'Pharmacist', 'Accounts & Billing Officer', 'Inventory Manager', 'Doctor', 'Receptionist'];
const ROLE_HELP: Record<string, string> = {
  Manager: 'Everything: dashboard, sales, stock, staff and settings. Only managers can cancel bills.',
  Pharmacist: 'Billing, pending bills, total sales, medicines & restock, suppliers, patients.',
  'Accounts & Billing Officer': 'Billing counter: new sale, pending bills, total sales. Can view medicines.',
  'Inventory Manager': 'Store room: medicines, restock, stock correction and suppliers.',
  Doctor: 'Patients and medical records (EMR). Can view medicines.',
  Receptionist: 'Patient registration and medical records.',
};

const PAGE_NAME: Record<string, string> = {
  dashboard: 'Dashboard', sale: 'New Sale', pending: 'Pending', sales: 'Total Sales', medicines: 'Medicines',
  suppliers: 'Suppliers', patients: 'Patients', emr: 'Records', staff: 'Staff', settings: 'Settings',
};

export default function StaffManager({ pharmacyName, embedded = false, currentStaffId }: { pharmacyName?: string; embedded?: boolean; currentStaffId?: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState({ staffName: '', id: '', role: 'Pharmacist', password: '' });
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<Staff | null>(null);

  // A Manager always sees their own pharmacy (the server decides); the admin passes a name
  const path = `/admin/staff-by-pharmacy/${encodeURIComponent(pharmacyName || 'mine')}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const r = await api<Staff[]>(path);
    setLoading(false);
    if (!r.ok) return setError(r.message);
    setRows(r.data);
  }, [path]);
  useEffect(() => { load(); }, [load]);

  const startAdd = () => { setEditing(null); setForm({ staffName: '', id: '', role: 'Pharmacist', password: '' }); setOpen(true); };
  const startEdit = (s: Staff) => { setEditing(s); setForm({ staffName: s.staffName, id: s.id, role: ROLES.includes(s.role) ? s.role : 'Pharmacist', password: '' }); setOpen(true); };

  const save = async () => {
    if (!form.staffName.trim() || !form.id.trim()) return toast('Name and staff ID are required.', 'error');
    if (!editing && form.password.length < 8) return toast('Password must be at least 8 characters.', 'error');
    if (editing && form.password && form.password.length < 8) return toast('New password must be at least 8 characters.', 'error');
    setBusy(true);
    const body: any = { staffName: form.staffName.trim(), id: form.id.trim(), role: form.role };
    if (form.password) body.password = form.password;
    if (!editing && pharmacyName) body.pharmacyName = pharmacyName;
    const r = await api(editing ? `/staff/${editing._id}` : '/staff/create', { method: editing ? 'PUT' : 'POST', body });
    setBusy(false);
    if (!r.ok) return toast(r.message, 'error');
    toast(editing ? 'Staff updated.' : 'Staff added. Share the ID and password with them.');
    setOpen(false);
    load();
  };

  const toggle = async (s: Staff) => {
    const r = await api(`/staff/${s._id}`, { method: 'PUT', body: { isActive: !s.isActive } });
    if (!r.ok) return toast(r.message, 'error');
    toast(s.isActive ? `${s.staffName} can no longer sign in.` : `${s.staffName} can sign in again.`);
    load();
  };

  const remove = async () => {
    if (!del) return;
    setBusy(true);
    const r = await api(`/staff/${del._id}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) return toast(r.message, 'error');
    toast('Staff member deleted.');
    setDel(null);
    load();
  };

  const body = (
    <>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <Card><Empty icon={<UserCog className="h-6 w-6" />} title="No staff yet" text="Add a Manager first, then the rest of your team." action={<Button onClick={startAdd} icon={<Plus className="h-4 w-4" />}>Add staff</Button>} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => (
            <Card key={s._id} className={cx('p-4', !s.isActive && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint font-display text-lg font-bold uppercase text-green">{(s.staffName || s.id).charAt(0)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.staffName || s.id}</p>
                  <p className="font-mono text-xs text-ink/50">{s.id}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone={s.role === 'Manager' ? 'ink' : 'green'}>{ROLE_LABEL[s.role] || s.role}</Badge>
                    {!s.isActive && <Badge tone="red">Can’t sign in</Badge>}
                    {currentStaffId === s.id && <Badge>You</Badge>}
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <button onClick={() => startEdit(s)} className="cursor-pointer rounded-lg p-1.5 text-ink/45 hover:bg-ink/5 hover:text-ink" aria-label={`Edit ${s.staffName}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDel(s)} className="cursor-pointer rounded-lg p-1.5 text-ink/45 hover:bg-danger/10 hover:text-danger" aria-label={`Delete ${s.staffName}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink/50">Opens: {(ROLE_PAGES[s.role] || []).map((p) => PAGE_NAME[p]).join(', ') || 'nothing (set a role)'}</p>
              <div className="mt-3 flex items-center justify-between border-t border-foil/60 pt-3">
                <span className="text-[11px] text-ink/40">{s.createdAt ? `Added ${fmtDate(s.createdAt)}` : ''}</span>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink/70">
                  <span>Can sign in</span>
                  <button
                    role="switch"
                    aria-checked={s.isActive}
                    onClick={() => toggle(s)}
                    className={cx('relative h-5 w-9 cursor-pointer rounded-full transition', s.isActive ? 'bg-green' : 'bg-ink/20')}
                  >
                    <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', s.isActive ? 'left-[18px]' : 'left-0.5')} />
                  </button>
                </label>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        title={editing ? `Edit ${editing.staffName}` : 'Add staff member'}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={save} loading={busy}>{editing ? 'Save changes' : 'Add staff'}</Button></>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" required><Input value={form.staffName} onChange={(e) => setForm((f) => ({ ...f, staffName: e.target.value }))} maxLength={80} /></Field>
          <Field label="Staff ID (for sign in)" required><Input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value.replace(/\s/g, '') }))} maxLength={80} autoCapitalize="none" /></Field>
          <Field label="Role" required className="sm:col-span-2" hint={ROLE_HELP[form.role]}>
            <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
          </Field>
          <Field label={editing ? 'New password' : 'Password'} required={!editing} className="sm:col-span-2" hint={editing ? 'Leave empty to keep the current password. At least 8 characters.' : 'At least 8 characters.'}>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
              <Input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} maxLength={72} className="pl-9 font-mono" autoComplete="new-password" />
            </div>
          </Field>
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} busy={busy} title={`Delete ${del?.staffName || ''}?`} text="They will not be able to sign in. Their old bills keep their staff ID. To stop them only for a while, turn off “Can sign in” instead." confirmLabel="Delete staff" onConfirm={remove} />
    </>
  );

  if (embedded) {
    return (
      <div>
        <div className="mb-3 flex justify-end"><Button size="sm" onClick={startAdd} icon={<Plus className="h-4 w-4" />}>Add staff</Button></div>
        {body}
      </div>
    );
  }
  return (
    <div>
      <PageHeader title="Staff" subtitle="Each person signs in with their own ID. Their role decides which pages they see." actions={<Button onClick={startAdd} icon={<Plus className="h-4 w-4" />}>Add staff</Button>} />
      {body}
    </div>
  );
}
