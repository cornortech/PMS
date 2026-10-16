// =====================================================================
// 🛠️ SUPER ADMIN DASHBOARD (Argya Health) — same layout as Atithi RMS
//  • Left: every pharmacy in a table with its subscription bar
//  • Right: create / edit form (browser autofill is switched off here)
//  • Days rules: "Days left" can be set to any number.
//                "Total days" can only go UP (use + Add days, or raise the total).
//  • Turn accounts on/off, reset passwords, manage staff, change admin login
// =====================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle, Building2, CalendarPlus, CheckCircle, Clock, Edit3, Eye, EyeOff, FileText, KeyRound, LogOut, Mail, MapPin, Phone,
  Plus, Power, RefreshCw, Search, ShieldCheck, Trash2, TimerReset, User, Users, X, XCircle,
} from 'lucide-react';
import { api, type PharmacyUser } from '../lib/api';
import { cx } from '../lib/format';
import StaffManager from './StaffManager';
import { Button, Confirm, Field, Input, Modal, useToast } from './ui';
import { GlobalStyles } from './rmsStyle';

type Account = PharmacyUser & { staffCount?: number; createdAt?: string };
type Filter = 'all' | 'active' | 'off' | 'soon';

const blank = { pharmacyName: '', id: '', password: '', phone: '', email: '', location: '', PanOrVat: '', totalTime: '30', remainingTime: '30', isActive: true };
type Form = typeof blank;

const INPUT =
  'w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all font-medium placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400';
const LABEL = 'text-[10px] font-bold text-slate-400 uppercase tracking-wider block';

// Stops the browser from filling saved logins / names into the admin form
const NO_FILL = { autoComplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': 'true', 'data-form-type': 'other', spellCheck: false } as const;

export default function AdminDashboard({ admin, onLogout }: { admin: PharmacyUser; onLogout: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<Form>({ ...blank });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const formTop = useRef<HTMLDivElement>(null);

  const [daysFor, setDaysFor] = useState<Account | null>(null);
  const [customDays, setCustomDays] = useState('');
  const [staffFor, setStaffFor] = useState<Account | null>(null);
  const [del, setDel] = useState<Account | null>(null);
  const [delText, setDelText] = useState('');
  const [me, setMe] = useState(false);
  const [meForm, setMeForm] = useState({ id: admin.id, password: '', again: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<Account[]>('/admin/users');
    setLoading(false);
    if (!r.ok) return toast(r.message, 'error');
    setRows(r.data);
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.title = 'Admin Dashboard · Argya Health'; }, []);

  const pharmacies = rows.filter((r) => !r.isAdmin);
  const left = (a: Account) => (typeof a.remainingTime === 'number' ? a.remainingTime : null);
  const counts = {
    total: pharmacies.length,
    active: pharmacies.filter((a) => a.isActive).length,
    off: pharmacies.filter((a) => !a.isActive).length,
    soon: pharmacies.filter((a) => left(a) !== null && left(a)! <= 7).length,
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return pharmacies
      .filter((a) => {
        const d = left(a);
        if (filter === 'active' && !a.isActive) return false;
        if (filter === 'off' && a.isActive) return false;
        if (filter === 'soon' && !(d !== null && d <= 7)) return false;
        return !t || [a.pharmacyName, a.id, a.location, a.phone, a.email].some((v) => (v || '').toLowerCase().includes(t));
      })
      .sort((a, b) => (left(a) ?? 1e9) - (left(b) ?? 1e9));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, filter]);

  // ---------- form helpers ----------
  const set = (k: keyof Form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  // Unusual names + autocomplete off so the browser never fills saved logins or names here
  const lockProps = (key: string) => ({ ...NO_FILL, name: `ah-admin-${key}`, id: `ah-admin-${key}` });
  const resetForm = () => {
    setEditing(null);
    setForm({ ...blank });
    setShowPw(false);
  };
  const startEdit = (a: Account) => {
    setEditing(a);
    setShowPw(false);
    setForm({
      pharmacyName: a.pharmacyName, id: a.id, password: '', phone: a.phone || '', email: a.email || '', location: a.location || '', PanOrVat: a.PanOrVat || '',
      totalTime: String(a.totalTime ?? 0), remainingTime: String(left(a) ?? 0), isActive: a.isActive !== false,
    });
    formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const put = async (a: Account, body: any, okMsg: string) => {
    setBusy(true);
    const r = await api<Account>(`/admin/users/${a._id}`, { method: 'PUT', body });
    setBusy(false);
    if (!r.ok) {
      toast(r.message, 'error');
      return false;
    }
    toast(okMsg);
    load();
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pharmacyName.trim() || !form.id.trim()) return toast('Pharmacy name and login ID are required.', 'error');
    if (!editing) {
      if (form.password.length < 8) return toast('Password must be at least 8 characters.', 'error');
      const days = Number(form.totalTime) || 0;
      if (days < 1) return toast('Plan must be at least 1 day.', 'error');
      setBusy(true);
      const r = await api('/admin/users', { method: 'POST', body: { ...form, planDays: days } });
      setBusy(false);
      if (!r.ok) return toast(r.message, 'error');
      toast(`${form.pharmacyName} created with ${days} days.`);
      resetForm();
      load();
      return;
    }
    // ---- edit ----
    if (form.password && form.password.length < 8) return toast('New password must be at least 8 characters.', 'error');
    const oldTotal = editing.totalTime ?? 0;
    const newTotal = Number(form.totalTime) || 0;
    if (newTotal < oldTotal) return toast(`Total days can only be increased (now ${oldTotal}). To shorten the plan, lower “Days left”.`, 'error');
    const body: any = {
      pharmacyName: form.pharmacyName, id: form.id, phone: form.phone, email: form.email, location: form.location, PanOrVat: form.PanOrVat,
    };
    if (form.isActive !== (editing.isActive !== false)) body.isActive = form.isActive;
    if (form.password) body.password = form.password;
    if (newTotal > oldTotal) body.totalTime = newTotal;
    if (form.remainingTime !== '' && Number(form.remainingTime) !== left(editing)) body.remainingTime = Number(form.remainingTime);
    if (await put(editing, body, 'Account updated.')) resetForm();
  };

  const addDays = async (n: number) => {
    if (!daysFor) return;
    if (!(n > 0)) return toast('You can only add days (1 or more). To lower the days, edit “Days left”.', 'error');
    if (await put(daysFor, { addDays: n }, `Added ${n} days for ${daysFor.pharmacyName}.`)) {
      setDaysFor(null);
      setCustomDays('');
    }
  };

  const remove = async () => {
    if (!del) return;
    setBusy(true);
    const r = await api(`/admin/users/${del._id}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) return toast(r.message, 'error');
    toast(`${del.pharmacyName} deleted.`);
    if (editing?._id === del._id) resetForm();
    setDel(null);
    setDelText('');
    load();
  };

  const saveMe = async () => {
    if (!meForm.id.trim()) return toast('Admin ID is required.', 'error');
    if (meForm.password && meForm.password.length < 12) return toast('Admin password must be at least 12 characters.', 'error');
    if (meForm.password !== meForm.again) return toast('The two passwords are not the same.', 'error');
    const body: any = { id: meForm.id.trim() };
    if (meForm.password) body.password = meForm.password;
    if (await put(admin as Account, body, 'Admin account updated. Use the new details next time.')) {
      setMe(false);
      setMeForm((f) => ({ ...f, password: '', again: '' }));
    }
  };

  const status = (a: Account) => {
    const d = left(a);
    const total = Math.max(1, a.totalTime || 1);
    if (d === null) return { label: 'No plan', text: 'text-slate-400', bar: 'bg-slate-300', pct: 0 };
    const pct = Math.min(100, (Math.max(0, d) / total) * 100);
    if (d <= 0) return { label: 'Expired', text: 'text-rose-600', bar: 'bg-rose-500', pct: 100 };
    if (d <= 7) return { label: `${d} / ${a.totalTime} days`, text: 'text-amber-600', bar: 'bg-amber-500', pct };
    return { label: `${d} / ${a.totalTime} days`, text: 'text-emerald-600', bar: 'bg-gradient-to-r from-purple-500 to-fuchsia-500', pct };
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      <GlobalStyles />
      {/* Top bar */}
      <nav className="sticky top-0 z-40 flex flex-col items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-4 py-4 shadow-sm sm:flex-row sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-600/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Admin Dashboard</h1>
            <p className="text-xs font-medium text-slate-500">
              Welcome, <span className="font-bold text-purple-600">{admin.pharmacyName}</span> · Argya Health
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMe(true)} className="flex cursor-pointer items-center gap-2 rounded-xl border border-purple-100 bg-purple-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-purple-700 transition-all hover:bg-purple-100">
            <KeyRound className="h-4 w-4" /> My account
          </button>
          <button onClick={onLogout} className="flex cursor-pointer items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-rose-700 transition-all hover:bg-rose-100">
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total pharmacies" value={counts.total} icon={Building2} iconTone="text-purple-500" active={filter === 'all'} onClick={() => setFilter('all')} />
          <StatCard label="Active" value={counts.active} icon={CheckCircle} iconTone="text-emerald-500" active={filter === 'active'} onClick={() => setFilter('active')} />
          <StatCard label="Turned off" value={counts.off} icon={XCircle} iconTone="text-rose-500" active={filter === 'off'} onClick={() => setFilter('off')} />
          <StatCard label="Expiring ≤ 7 days" value={counts.soon} icon={AlertTriangle} iconTone="text-amber-500" active={filter === 'soon'} onClick={() => setFilter('soon')} />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Table */}
          <div className="space-y-4 lg:col-span-2">
            <div className="space-y-5 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
                  <Building2 className="h-4 w-4 text-purple-600" /> Pharmacy accounts
                  {filter !== 'all' && (
                    <button onClick={() => setFilter('all')} className="ml-1 inline-flex cursor-pointer items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] text-purple-700 hover:bg-purple-100">
                      {filter === 'active' ? 'Active' : filter === 'off' ? 'Turned off' : 'Expiring'} <X className="h-3 w-3" />
                    </button>
                  )}
                </h2>
                <button onClick={load} title="Refresh" aria-label="Refresh" className="cursor-pointer rounded-xl border border-slate-200 p-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-purple-600">
                  <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin text-purple-600')} />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  {...NO_FILL}
                  name="ah-admin-search"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name, ID, place or phone…"
                  aria-label="Search pharmacies"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium transition-all placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/10"
                />
              </div>

              <div className="thin-scroll overflow-x-auto rounded-2xl border border-slate-200/60">
                <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/60 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                      <th className="p-4">Pharmacy</th>
                      <th className="p-4">Login ID</th>
                      <th className="p-4">Subscription</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {loading && !rows.length ? (
                      <tr><td colSpan={5} className="p-10 text-center text-slate-400">Loading…</td></tr>
                    ) : shown.length ? (
                      shown.map((a) => {
                        const s = status(a);
                        return (
                          <tr key={a._id} className={cx('transition-colors', editing?._id === a._id ? 'bg-purple-50/60' : 'hover:bg-slate-50/60')}>
                            <td className="p-4">
                              <button onClick={() => startEdit(a)} className="group flex cursor-pointer items-center gap-2.5 text-left">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-[10px] font-bold uppercase text-white shadow-sm">
                                  {a.pharmacyName.slice(0, 2)}
                                </span>
                                <span>
                                  <span className="block text-sm font-bold text-slate-900 group-hover:text-purple-600 group-hover:underline">{a.pharmacyName}</span>
                                  {(a.location || a.phone) && (
                                    <span className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
                                      {a.location && <span className="inline-flex items-center gap-1"><MapPin className="h-2.5 w-2.5" /> {a.location}</span>}
                                      {a.phone && <span className="inline-flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {a.phone}</span>}
                                    </span>
                                  )}
                                </span>
                              </button>
                            </td>
                            <td className="p-4 font-mono font-semibold text-slate-500">{a.id}</td>
                            <td className="min-w-[150px] p-4">
                              <div className="mb-1 flex items-center justify-between">
                                <span className={cx('text-[10px] font-bold', s.text)}>{s.label}</span>
                                <button onClick={() => { setCustomDays(''); setDaysFor(a); }} title="Add days" aria-label={`Add days for ${a.pharmacyName}`} className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-purple-50 hover:text-purple-600">
                                  <TimerReset className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                <div className={cx('h-full rounded-full transition-all', s.bar)} style={{ width: `${s.pct}%` }} />
                              </div>
                              <button onClick={() => setStaffFor(a)} className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-purple-600">
                                <Users className="h-3 w-3" /> {a.staffCount || 0} staff
                              </button>
                            </td>
                            <td className="p-4">
                              <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider', a.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                                {a.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                {a.isActive ? 'Active' : 'Off'}
                              </span>
                            </td>
                            <td className="whitespace-nowrap p-4 text-right">
                              <div className="inline-flex gap-1.5">
                                <IconBtn title="Add days" onClick={() => { setCustomDays(''); setDaysFor(a); }} icon={CalendarPlus} />
                                <IconBtn title="Staff" onClick={() => setStaffFor(a)} icon={Users} />
                                <IconBtn title={a.isActive ? 'Turn off' : 'Turn on'} onClick={() => put(a, { isActive: !a.isActive }, a.isActive ? `${a.pharmacyName} turned off.` : `${a.pharmacyName} turned on.`)} icon={Power} />
                                <IconBtn title="Edit" onClick={() => startEdit(a)} icon={Edit3} />
                                <IconBtn title="Delete" danger onClick={() => { setDelText(''); setDel(a); }} icon={Trash2} />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="bg-slate-50/30 p-10 text-center font-medium text-slate-400">
                          {pharmacies.length ? 'No pharmacy matches your search.' : 'No pharmacies yet — create the first one on the right.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Create / edit panel */}
          <div className="lg:col-span-1" ref={formTop}>
            <div className="sticky top-28 space-y-5 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                    {editing ? <Edit3 className="h-4 w-4" /> : <Plus className="h-5 w-5" />}
                  </div>
                  <h2 className="text-base font-bold tracking-tight text-slate-900">{editing ? `Edit ${editing.pharmacyName}` : 'Create pharmacy account'}</h2>
                  <p className="mt-0.5 text-xs text-slate-400">{editing ? 'Change details, password or days.' : 'The pharmacy logs in with its name, login ID and password.'}</p>
                </div>
                {editing && (
                  <button onClick={resetForm} className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cancel editing">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <form onSubmit={submit} autoComplete="off" className="space-y-4" key={editing?._id || 'new'}>
                {/* Decoy fields: browsers put saved logins here instead of the real fields */}
                <div aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
                  <input type="text" name="username" tabIndex={-1} autoComplete="username" />
                  <input type="password" name="password" tabIndex={-1} autoComplete="current-password" />
                </div>

                <FormRow label="Pharmacy name" icon={Building2}>
                  <input {...lockProps('pharmacy')} type="text" required maxLength={120} placeholder="e.g. Himalaya Pharmacy" value={form.pharmacyName} onChange={(e) => set('pharmacyName', e.target.value)} className={INPUT} />
                </FormRow>
                <FormRow label="Login ID" icon={User}>
                  <input {...lockProps('loginid')} type="text" required maxLength={80} autoCapitalize="none" placeholder="Letters and numbers" value={form.id} onChange={(e) => set('id', e.target.value.replace(/\s/g, ''))} className={cx(INPUT, 'font-mono')} />
                </FormRow>
                <FormRow label={editing ? 'New password (optional)' : 'Password'} icon={KeyRound}>
                  <input
                    {...lockProps('secret')}
                    autoComplete="new-password"
                    type={showPw ? 'text' : 'password'}
                    required={!editing}
                    maxLength={72}
                    placeholder={editing ? '•••••••• (keep current)' : 'At least 8 characters'}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    className={cx(INPUT, 'pr-10')}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3 cursor-pointer text-slate-400 hover:text-slate-600" aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </FormRow>
                <FormRow label="Phone number" icon={Phone}>
                  <input {...lockProps('phone')} type="text" inputMode="tel" maxLength={30} placeholder="e.g. 98XXXXXXXX" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={INPUT} />
                </FormRow>
                <FormRow label="Email address" icon={Mail}>
                  <input {...lockProps('mail')} type="email" maxLength={120} placeholder="e.g. pharmacy@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} className={INPUT} />
                </FormRow>
                <FormRow label="Location" icon={MapPin}>
                  <input {...lockProps('place')} type="text" maxLength={200} placeholder="e.g. Kathmandu, Nepal" value={form.location} onChange={(e) => set('location', e.target.value)} className={INPUT} />
                </FormRow>
                <FormRow label="PAN / VAT number" icon={FileText}>
                  <input {...lockProps('pan')} type="text" maxLength={30} placeholder="e.g. 600123456" value={form.PanOrVat} onChange={(e) => set('PanOrVat', e.target.value)} className={INPUT} />
                </FormRow>

                <div className={cx('grid gap-3', editing ? 'grid-cols-2' : 'grid-cols-1')}>
                  <FormRow label={editing ? 'Total days (only up)' : 'Total plan (days)'} icon={Clock}>
                    <input
                      {...NO_FILL}
                      name="ah-admin-total"
                      type="number"
                      required
                      min={editing ? 0 : 1}
                      max={3650}
                      placeholder="30"
                      value={form.totalTime}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setForm((f) => ({ ...f, totalTime: v, remainingTime: editing ? f.remainingTime : v }));
                      }}
                      className={INPUT}
                    />
                  </FormRow>
                  {editing && (
                    <FormRow label="Days left" icon={TimerReset}>
                      <input {...NO_FILL} name="ah-admin-left" type="number" required min={0} max={3650} placeholder="30" value={form.remainingTime} onChange={(e) => set('remainingTime', e.target.value.replace(/\D/g, '').slice(0, 4))} className={INPUT} />
                    </FormRow>
                  )}
                </div>
                <p className="-mt-2 px-0.5 text-[10px] text-slate-400">
                  {editing
                    ? `Total can only be raised (now ${editing.totalTime ?? 0}). Days left can be any number; if it is more than the total, the total rises with it.`
                    : 'Days left start out equal to the total plan.'}
                </p>
                {!editing && (
                  <div className="flex flex-wrap gap-1.5">
                    {['15', '30', '90', '180', '365'].map((d) => (
                      <button key={d} type="button" onClick={() => setForm((f) => ({ ...f, totalTime: d, remainingTime: d }))} className={cx('cursor-pointer rounded-lg border px-2.5 py-1 text-[11px] font-bold', form.totalTime === d ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-500 hover:border-purple-300')}>
                        {d} days
                      </button>
                    ))}
                  </div>
                )}

                {editing && (
                  <label className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50 p-3.5">
                    <span>
                      <span className="block text-[11px] font-bold text-slate-700">Account active</span>
                      <span className="text-[10px] font-medium text-slate-400">Off = pharmacy and its staff cannot log in</span>
                    </span>
                    <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4 accent-purple-600" />
                  </label>
                )}

                <div className="flex gap-2 pt-1">
                  {editing && (
                    <button type="button" onClick={resetForm} className="flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50">
                      Cancel
                    </button>
                  )}
                  <button type="submit" disabled={busy} className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-purple-500/20 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60">
                    {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : editing ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editing ? 'Save changes' : 'Create account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Add days (only adds — never removes) */}
      <Modal open={!!daysFor} onClose={() => setDaysFor(null)} busy={busy} width="max-w-md" title={`Add days · ${daysFor?.pharmacyName || ''}`} subtitle={daysFor ? `Now ${left(daysFor) ?? 0} of ${daysFor.totalTime ?? 0} days left` : ''}>
        <p className="mb-3 text-sm text-slate-500">Days are added to both the total and the days left. If the plan already expired, it counts from today.</p>
        <div className="grid grid-cols-3 gap-2">
          {[30, 90, 365].map((n) => (
            <Button key={n} variant="secondary" onClick={() => addDays(n)} disabled={busy}>+{n} days</Button>
          ))}
        </div>
        <div className="mt-4 flex items-end gap-2">
          <Field label="Other number of days" hint="1 to 3650. To lower the days, edit “Days left”." className="flex-1">
            <Input {...NO_FILL} name="ah-admin-adddays" value={customDays} onChange={(e) => setCustomDays(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="e.g. 45" />
          </Field>
          <Button onClick={() => addDays(parseInt(customDays, 10) || 0)} loading={busy} disabled={!(parseInt(customDays, 10) > 0)}>Add</Button>
        </div>
      </Modal>

      {/* Staff of one pharmacy */}
      <Modal open={!!staffFor} onClose={() => { setStaffFor(null); load(); }} width="max-w-5xl" title={`Staff · ${staffFor?.pharmacyName || ''}`} subtitle="Add a Manager first — they can then manage the rest of their team.">
        {staffFor && <StaffManager pharmacyName={staffFor.pharmacyName} embedded />}
      </Modal>

      {/* Delete */}
      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        busy={busy}
        title={`Delete ${del?.pharmacyName || ''}?`}
        confirmLabel="Delete forever"
        onConfirm={() => (delText.trim().toLowerCase() === (del?.pharmacyName || '').toLowerCase() ? remove() : toast('Type the pharmacy name exactly to confirm.', 'error'))}
      >
        <p className="text-sm text-slate-600">The account and all its staff logins are deleted and cannot log in again. To stop it for a while, turn it off instead.</p>
        <Field label={`Type “${del?.pharmacyName || ''}” to confirm`} className="mt-3"><Input {...NO_FILL} name="ah-admin-confirm" value={delText} onChange={(e) => setDelText(e.target.value)} /></Field>
      </Confirm>

      {/* Admin's own account */}
      <Modal open={me} onClose={() => setMe(false)} busy={busy} width="max-w-md" title="My admin account" subtitle="Your login ID and password. The email code is still required." footer={<><Button variant="secondary" onClick={() => setMe(false)} disabled={busy}>Cancel</Button><Button onClick={saveMe} loading={busy}>Save</Button></>}>
        <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); saveMe(); }} className="space-y-3">
          <Field label="Admin login ID"><Input {...NO_FILL} name="ah-me-id" value={meForm.id} onChange={(e) => setMeForm({ ...meForm, id: e.target.value.replace(/\s/g, '') })} maxLength={80} /></Field>
          <Field label="New password" hint="Leave empty to keep. At least 12 characters."><Input type="password" name="ah-me-new" value={meForm.password} onChange={(e) => setMeForm({ ...meForm, password: e.target.value })} maxLength={72} autoComplete="new-password" /></Field>
          <Field label="Type it again"><Input type="password" name="ah-me-again" value={meForm.again} onChange={(e) => setMeForm({ ...meForm, again: e.target.value })} maxLength={72} autoComplete="new-password" /></Field>
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><KeyRound className="h-3.5 w-3.5" /> Log in name stays “{admin.pharmacyName}”.</p>
        </form>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, iconTone, active, onClick }: { label: string; value: number; icon: LucideIcon; iconTone: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx('cursor-pointer rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5', active ? 'border-purple-300 ring-2 ring-purple-500/15' : 'border-slate-200/60 hover:border-purple-200')}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <Icon className={cx('h-4 w-4', iconTone)} />
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
    </button>
  );
}

function FormRow({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={LABEL}>{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        {children}
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, icon: Icon, danger }: { title: string; onClick: () => void; icon: LucideIcon; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cx(
        'inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition-all',
        danger ? 'hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700' : 'hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
