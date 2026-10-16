// =====================================================================
// ⚙️ SETTINGS (Manager) — same look as "Restaurant Profile" in Atithi RMS, with tabs:
//  🏢 Our Details        — what is saved for the pharmacy + plan days
//  🔑 Change Password    — pharmacy login password
//  ✏️ Edit Information   — name, address, phone, PAN/VAT, email (printed on bills)
//  🔳 Payment QR Manage  — eSewa / Khalti / Fonepay QR for bills
//  🧾 Billing & Printing — VAT, Due (pending) bills, bill size, footer, expiry warning
// =====================================================================
import React, { useEffect, useState } from 'react';
import { CalendarClock, Eye, EyeOff, Loader2, Printer } from 'lucide-react';
import { api, type PharmacyUser } from '../lib/api';
import { useApp } from '../lib/app';
import { cx } from '../lib/format';
import { printBill } from '../lib/print';
import type { Sale, Settings } from '../lib/types';
import { useToast } from './ui';
import QrManager from './QrUploader';

type Tab = 'details' | 'password' | 'edit' | 'qr' | 'billing';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'details', label: 'Our Details', icon: '🏢' },
  { key: 'password', label: 'Change Password', icon: '🔑' },
  { key: 'edit', label: 'Edit Information', icon: '✏️' },
  { key: 'qr', label: 'Payment QR Manage', icon: '🔳' },
  { key: 'billing', label: 'Billing & Printing', icon: '🧾' },
];
const TAB_KEY = 'argya.settingsTab';

const SAMPLE: Sale = {
  id: 'sample', invoiceNo: 'SAMPLE-00001', dateBS: '', customerName: 'Sample Customer', customerPhone: '9800000000', patientId: '',
  items: [
    { medicineId: '1', name: 'Paracetamol 500mg', quantity: 10, unitPrice: 2.5, total: 25, batchNo: 'PX2041', expiryDate: '2027-08-31' },
    { medicineId: '2', name: 'Amoxicillin 250mg', quantity: 6, unitPrice: 12, total: 72, batchNo: 'AM778' },
  ],
  subTotal: 97, discount: 0, taxableAmount: 97, vatRate: 13, vatAmount: 12.61, grandTotal: 109.61, profit: 0,
  paymentMethod: 'Cash', status: 'paid', paidAt: new Date().toISOString(), note: '', soldBy: '', cancelReason: '', cancelledAt: null,
  creditNoteNo: '', createdAt: new Date().toISOString(), legacy: false,
};

// ---------- small pieces (RMS style) ----------
function DetailRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-purple-100 bg-purple-50/50 p-4 transition hover:border-purple-200 hover:bg-purple-50">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-100 bg-white text-xl shadow-sm" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wider text-purple-700">{label}</p>
        <p className="truncate text-[15px] font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function SectionHead({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

const FIELD = 'h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10 disabled:cursor-not-allowed disabled:text-slate-400';

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function PrimaryBtn({ loading, children, disabled, onClick, type = 'button' }: { loading?: boolean; children: React.ReactNode; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 px-6 text-sm font-bold text-white shadow-md shadow-purple-500/20 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition', on ? 'bg-purple-600' : 'bg-slate-300')}>
      <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

function Row({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 p-4 sm:p-5">
      <div className="min-w-0 max-w-md">
        <p className="font-bold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{text}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, reloadSettings, pharmacy, setPharmacy, plan } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(() => {
    if (window.location.hash === '#payment-qr') return 'qr';
    try { const t = localStorage.getItem(TAB_KEY) as Tab; return TABS.some((x) => x.key === t) ? t : 'details'; } catch { return 'details'; }
  });
  const pick = (t: Tab) => { setTab(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } };

  // billing
  const [s, setS] = useState<Settings>(settings);
  const [vatText, setVatText] = useState(String(settings.vatRate));
  const [expText, setExpText] = useState(String(settings.expiryAlertDays));
  const [savingS, setSavingS] = useState(false);
  // details
  const [p, setP] = useState({ pharmacyName: pharmacy.pharmacyName, location: pharmacy.location || '', phone: pharmacy.phone || '', email: pharmacy.email || '', PanOrVat: pharmacy.PanOrVat || '' });
  const [savingP, setSavingP] = useState(false);
  // password
  const [pw, setPw] = useState({ a: '', b: '' });
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    setS(settings);
    setVatText(String(settings.vatRate));
    setExpText(String(settings.expiryAlertDays));
  }, [settings]);
  useEffect(() => {
    setP({ pharmacyName: pharmacy.pharmacyName, location: pharmacy.location || '', phone: pharmacy.phone || '', email: pharmacy.email || '', PanOrVat: pharmacy.PanOrVat || '' });
  }, [pharmacy]);

  const changed = JSON.stringify(s) !== JSON.stringify(settings) || vatText !== String(settings.vatRate) || expText !== String(settings.expiryAlertDays);

  const saveSettings = async () => {
    const vatRate = Number(vatText);
    const expiryAlertDays = parseInt(expText, 10);
    if (!vatText || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return toast('VAT rate must be between 0 and 100.', 'error');
    if (!Number.isFinite(expiryAlertDays) || expiryAlertDays < 1 || expiryAlertDays > 730) return toast('Expiry warning must be 1 to 730 days.', 'error');
    setSavingS(true);
    const r = await api<Settings>('/settings', { method: 'PUT', body: { ...s, vatRate, expiryAlertDays } });
    setSavingS(false);
    if (!r.ok) return toast(r.message, 'error');
    toast('Settings saved. New bills use them now.');
    reloadSettings();
  };

  const saveProfile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!p.pharmacyName.trim()) return toast('Pharmacy name is required.', 'error');
    if (p.pharmacyName.trim() !== pharmacy.pharmacyName && !confirm(`Change the pharmacy name to “${p.pharmacyName.trim()}”? Everyone must use the NEW name to log in.`)) return;
    setSavingP(true);
    const r = await api<PharmacyUser>(`/admin/users/${pharmacy._id}`, { method: 'PUT', body: p });
    setSavingP(false);
    if (!r.ok) return toast(r.message, 'error');
    setPharmacy({ ...pharmacy, ...r.data });
    toast('Pharmacy details saved.');
  };

  const savePassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pw.a.length < 8) return toast('Password must be at least 8 characters.', 'error');
    if (pw.a !== pw.b) return toast('The two passwords are not the same.', 'error');
    setSavingPw(true);
    const r = await api(`/admin/users/${pharmacy._id}`, { method: 'PUT', body: { password: pw.a } });
    setSavingPw(false);
    if (!r.ok) return toast(r.message, 'error');
    setPw({ a: '', b: '' });
    toast('Pharmacy password changed. Use it next time you log in.');
  };

  const left = plan?.remainingTime ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <span className="inline-block rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">Account Settings</span>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-[34px]">Pharmacy Profile</h1>
        <p className="mt-1.5 text-sm text-slate-500 sm:text-base">Manage your pharmacy information, password, payment QR and billing rules.</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2.5" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => pick(t.key)}
            className={cx(
              'inline-flex flex-[1_1_calc(50%-0.5rem)] cursor-pointer items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition sm:flex-none sm:px-5',
              tab === t.key
                ? 'border-transparent bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/25'
                : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-sm'
            )}
          >
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Card */}
      <div key={tab} className="anim-fade-up rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-sm sm:p-9" role="tabpanel">
        {tab === 'details' && (
          <>
            <SectionHead title="Overview Details" text="Your registered pharmacy information on record" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="Pharmacy name" value={pharmacy.pharmacyName} icon="🏥" />
              <DetailRow label="PAN / VAT number" value={pharmacy.PanOrVat || 'Not provided'} icon="🧾" />
              <DetailRow label="Phone number" value={pharmacy.phone || 'Not provided'} icon="📞" />
              <DetailRow label="Email address" value={pharmacy.email || 'Not provided'} icon="✉️" />
              <DetailRow label="Location" value={pharmacy.location || 'Not provided'} icon="📍" />
              <DetailRow label="Pharmacy ID" value={pharmacy.id} icon="🆔" />
              <DetailRow label="Account security" value="•••••••• (Secured)" icon="🔒" />
              <DetailRow label="VAT on bills" value={settings.vatEnabled ? `On · ${settings.vatRate}%` : 'Off'} icon="💰" />
              <DetailRow label="Bill size" value={settings.printSize} icon="🖨️" />
            </div>
            {left !== null && plan && (
              <div className={cx('mt-6 rounded-2xl border p-5', left <= 7 ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/50')}>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className={cx('text-[11px] font-black uppercase tracking-wider', left <= 7 ? 'text-amber-700' : 'text-emerald-700')}>Your plan</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{left} <span className="text-base font-semibold text-slate-400">/ {plan.totalTime} days left</span></p>
                  </div>
                  <p className="text-xs text-slate-500">To renew, contact Argya Health.</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div className={cx('h-full rounded-full', left <= 7 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, (Math.max(0, left) / Math.max(1, plan.totalTime)) * 100)}%` }} />
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'password' && (
          <div className="max-w-lg">
            <SectionHead title="Change Password" text="The password used to log the pharmacy in. Staff passwords are changed in Manage Staff." />
            <form onSubmit={savePassword} autoComplete="off" className="space-y-4">
              <FormField label="New password" hint="At least 8 characters">
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} name="ah-set-pw1" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} autoComplete="new-password" maxLength={72} placeholder="Enter new password" className={cx(FIELD, 'pr-11')} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5 cursor-pointer text-slate-400 hover:text-slate-600" aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </FormField>
              <FormField label="Confirm new password">
                <input type={showPw ? 'text' : 'password'} name="ah-set-pw2" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} autoComplete="new-password" maxLength={72} placeholder="Type it again" className={FIELD} />
              </FormField>
              <PrimaryBtn type="submit" loading={savingPw} disabled={!pw.a}>{savingPw ? 'Updating password…' : 'Update password'}</PrimaryBtn>
            </form>
          </div>
        )}

        {tab === 'edit' && (
          <div className="max-w-2xl">
            <SectionHead title="Edit Pharmacy Details" text="Printed at the top of every bill. Keep them up to date." />
            <form onSubmit={saveProfile} autoComplete="off" className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><FormField label="Pharmacy ID" hint="Only the Argya Health admin can change this."><input value={pharmacy.id} disabled className={FIELD} /></FormField></div>
              <div className="sm:col-span-2"><FormField label="Pharmacy name" hint="Also used to log in."><input name="ah-set-name" value={p.pharmacyName} onChange={(e) => setP({ ...p, pharmacyName: e.target.value })} maxLength={120} className={FIELD} /></FormField></div>
              <div className="sm:col-span-2"><FormField label="Address"><input name="ah-set-addr" value={p.location} onChange={(e) => setP({ ...p, location: e.target.value })} maxLength={200} placeholder="e.g. Butwal-6, Rupandehi" className={FIELD} /></FormField></div>
              <FormField label="Phone"><input name="ah-set-phone" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} maxLength={30} inputMode="tel" placeholder="98XXXXXXXX" className={FIELD} /></FormField>
              <FormField label="PAN / VAT no."><input name="ah-set-pan" value={p.PanOrVat} onChange={(e) => setP({ ...p, PanOrVat: e.target.value })} maxLength={30} placeholder="e.g. 609876543" className={FIELD} /></FormField>
              <div className="sm:col-span-2"><FormField label="Email"><input name="ah-set-mail" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} maxLength={120} type="email" placeholder="pharmacy@example.com" className={FIELD} /></FormField></div>
              <div className="sm:col-span-2"><PrimaryBtn type="submit" loading={savingP}>{savingP ? 'Saving…' : 'Save details'}</PrimaryBtn></div>
            </form>
          </div>
        )}

        {tab === 'qr' && (
          <div id="payment-qr">
            <SectionHead title="Payment QR Manage" text="Upload your eSewa, Khalti or Fonepay QR once. Every bill then shows a QR with the bill amount in it." />
            <QrManager />
          </div>
        )}

        {tab === 'billing' && (
          <div>
            <SectionHead title="Billing & Printing" text="Rules used on every new bill." />
            <div className="space-y-3">
              <Row title="Add VAT to bills" text="Turn off if your pharmacy is not VAT registered or sells VAT-free medicines only.">
                {s.vatEnabled && (
                  <div className="flex items-center gap-1.5">
                    <input value={vatText} onChange={(e) => setVatText(e.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} inputMode="decimal" className="h-10 w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 text-right font-mono text-sm outline-none focus:border-purple-500" aria-label="VAT rate" />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                )}
                <Toggle on={s.vatEnabled} onChange={(v) => setS({ ...s, vatEnabled: v })} label="Add VAT" />
              </Row>
              <Row title="Allow pending (Due / udharo) bills" text="Shows “Put in pending” on New Sale. The bill goes to Pending Bills until the customer pays.">
                <Toggle on={s.allowDue} onChange={(v) => setS({ ...s, allowDue: v })} label="Allow pending bills" />
              </Row>
              <Row title="Bill size" text="Match your printer: small thermal (58 mm), standard thermal (80 mm) or A4 paper.">
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  {(['58mm', '80mm', 'A4'] as const).map((size) => (
                    <button key={size} onClick={() => setS({ ...s, printSize: size })} aria-pressed={s.printSize === size} className={cx('cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold', s.printSize === size ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500')}>
                      {size}
                    </button>
                  ))}
                </div>
                <button onClick={() => printBill(SAMPLE, pharmacy, s)} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-purple-200 px-3 text-xs font-bold text-purple-700 hover:bg-purple-50">
                  <Printer className="h-3.5 w-3.5" /> Test print
                </button>
              </Row>
              <Row title="Message at the bottom of bills" text="Printed on every bill.">
                <input value={s.billFooter} onChange={(e) => setS({ ...s, billFooter: e.target.value.slice(0, 200) })} className="h-10 w-72 max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-purple-500" aria-label="Bill footer" />
              </Row>
              <Row title="Expiry warning" text="Medicines expiring within this many days are marked “expiring soon”.">
                <CalendarClock className="h-4 w-4 text-slate-400" />
                <input value={expText} onChange={(e) => setExpText(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" className="h-10 w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 text-right font-mono text-sm outline-none focus:border-purple-500" aria-label="Expiry alert days" />
                <span className="text-sm text-slate-500">days</span>
              </Row>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              {changed && (
                <button onClick={() => { setS(settings); setVatText(String(settings.vatRate)); setExpText(String(settings.expiryAlertDays)); }} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                  Undo changes
                </button>
              )}
              <PrimaryBtn onClick={saveSettings} loading={savingS} disabled={!changed}>Save billing settings</PrimaryBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
