// =====================================================================
// 🔑 LOGIN (same design as Atithi RMS)
//  1. Pharmacy login (pharmacy name + ID + password)
//  2. Super admin only: 6-digit code sent to the admin email (expires in 1 minute)
//  3. StaffLogin: each staff member signs in with their own ID on that computer
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, ArrowLeft, Building2, ChevronRight, ClipboardPlus, Eye, EyeOff, KeyRound, LayoutDashboard, Loader2, Lock,
  MailCheck, Package, RefreshCw, ShieldAlert, ShieldCheck, ShoppingCart, Store, Timer, User, User2,
} from 'lucide-react';
import { api, session, type PharmacyUser, type StaffUser } from '../lib/api';
import { AmbientBackdrop, BigLogo, FOCUS_RING, GLASS_PANEL, GRADIENT_BTN, GlobalStyles } from './rmsStyle';
import { Logo } from './ui';

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/55 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder-slate-400 transition-all focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500';

// ---------------------------------------------------------------------
// 1 + 2: Pharmacy / super admin login
// ---------------------------------------------------------------------
export default function LoginScreen({ onLoggedIn, onBack }: { onLoggedIn: (token: string, user: PharmacyUser) => void; onBack: () => void }) {
  const [pharmacyName, setPharmacyName] = useState('');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false); // stops a double click from logging in twice

  // Admin email code
  const [otp, setOtp] = useState<{ challengeId: string; sentTo: string; expiresAt: number } | null>(null);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [info, setInfo] = useState('');
  const [now, setNow] = useState(Date.now());
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!otp) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [otp]);
  const secondsLeft = otp ? Math.max(0, Math.ceil((otp.expiresAt - now) / 1000)) : 0;
  const expired = !!otp && secondsLeft === 0;
  const code = digits.join('');

  const openOtp = (data: any) => {
    setOtp({ challengeId: data.challengeId, sentTo: data.sentTo || 'your email', expiresAt: Date.now() + (Number(data.expiresIn) || 60) * 1000 });
    setDigits(['', '', '', '', '', '']);
    setInfo(data.reused ? data.message || '' : '');
    setError('');
    setNow(Date.now());
    setTimeout(() => boxes.current[0]?.focus(), 50);
  };
  const backToLogin = (msg = '') => {
    setOtp(null);
    setDigits(['', '', '', '', '', '']);
    setPassword('');
    setError(msg);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy.current) return;
    if (!pharmacyName.trim() || !id.trim() || !password) {
      setError('Please fill in pharmacy name, ID and password.');
      return;
    }
    busy.current = true;
    setLoading(true);
    setError('');
    const r = await api('/auth/login', { method: 'POST', token: null, body: { pharmacyName: pharmacyName.trim(), id: id.trim(), password } });
    setLoading(false);
    busy.current = false;
    if (r.ok && r.body?.otpRequired) return openOtp(r.body);
    if (r.ok && r.body?.token) return onLoggedIn(r.body.token, r.body.user);
    setError(r.message || 'Login failed.');
  };

  const verify = async (value: string) => {
    if (!otp || value.length !== 6 || loading) return;
    if (expired) return setError('This code has expired. Please send a new code.');
    setLoading(true);
    setError('');
    const r = await api('/auth/admin-otp/verify', { method: 'POST', token: null, body: { challengeId: otp.challengeId, code: value } });
    setLoading(false);
    if (r.ok && r.body?.token) return onLoggedIn(r.body.token, r.body.user);
    if (r.body?.code === 'OTP_RESTART') return backToLogin(r.message);
    if (r.body?.code === 'OTP_EXPIRED') setOtp((o) => (o ? { ...o, expiresAt: Date.now() } : o));
    setError(r.message || 'Wrong code.');
    setDigits(['', '', '', '', '', '']);
    setTimeout(() => boxes.current[0]?.focus(), 30);
  };

  const resend = async () => {
    if (!otp || loading) return;
    setLoading(true);
    setError('');
    const r = await api('/auth/admin-otp/resend', { method: 'POST', token: null, body: { challengeId: otp.challengeId } });
    setLoading(false);
    if (r.ok) return openOtp({ ...r.body, challengeId: otp.challengeId });
    if (r.body?.code === 'OTP_RESTART') return backToLogin(r.message);
    setError(r.message || 'Could not send a new code.');
  };

  const typeDigit = (i: number, raw: string) => {
    const nums = raw.replace(/\D/g, '');
    if (nums.length > 1) {
      const next = nums.slice(0, 6).split('');
      while (next.length < 6) next.push('');
      setDigits(next);
      boxes.current[Math.min(nums.length, 6) - 1]?.focus();
      if (nums.length >= 6) verify(next.join(''));
      return;
    }
    const next = [...digits];
    next[i] = nums;
    setDigits(next);
    if (nums && i < 5) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) verify(next.join(''));
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden bg-slate-50 p-4 pt-12 font-sans text-slate-800 selection:bg-purple-100 selection:text-purple-900 sm:pt-16">
      <div className="pointer-events-none absolute left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-purple-200/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-20%] right-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-200/20 blur-[120px]" />

      <button
        onClick={onBack}
        className="absolute left-4 top-4 z-10 flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-purple-50 hover:text-purple-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Home
      </button>

      <div className="mt-20 w-full max-w-md space-y-4" id="login-container">
        <div className={`relative overflow-hidden rounded-3xl border border-slate-100 bg-white px-6 pb-6 shadow-xl sm:px-8 sm:pb-8 ${otp ? 'pt-8 sm:pt-10' : 'pt-0'}`} id="login-card">
          {/* Logo (hidden on the admin code screen) */}
          {!otp && (
            <div className="flex flex-col items-center text-center" id="login-header">
              <BigLogo />
            </div>
          )}

          {error && (
            <div className="my-3 flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50 p-3.5 text-xs text-red-700" role="alert">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <div className="space-y-0.5">
                <span className="block font-bold">Access Denied</span>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          {otp ? (
            /* ================= 🔐 ADMIN EMAIL CODE ================= */
            <div className="space-y-5" id="admin-otp">
              <div className="flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30">
                  <ShieldCheck className="h-7 w-7" />
                </span>
                <h2 className="mt-3 text-lg font-extrabold text-slate-900">Verify it’s you</h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <MailCheck className="h-3.5 w-3.5 text-purple-600" />
                  Code sent to <b className="text-slate-700">{otp.sentTo}</b>
                </p>
              </div>

              {!expired ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Timer className="h-3.5 w-3.5" /> Code expires in
                    </span>
                    <span className={`font-mono text-sm ${secondsLeft <= 10 ? 'text-rose-600' : 'text-purple-700'}`}>
                      {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${secondsLeft <= 10 ? 'bg-rose-500' : 'bg-gradient-to-r from-purple-600 to-indigo-500'}`}
                      style={{ width: `${(secondsLeft / 60) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
                  <Timer className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <b className="block">Code expired</b>
                    This code no longer works. Send a new code to your email.
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-2" onPaste={(e) => { e.preventDefault(); typeDigit(0, e.clipboardData.getData('text')); }}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { boxes.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={6}
                    value={d}
                    disabled={loading || expired}
                    aria-label={`Digit ${i + 1}`}
                    onChange={(e) => typeDigit(i, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus(); }}
                    className={`h-13 w-full min-w-0 rounded-xl border-2 text-center font-mono text-xl font-extrabold outline-none transition-all disabled:bg-slate-100 disabled:text-slate-300 ${
                      d ? 'border-purple-500 bg-purple-50 text-purple-800' : 'border-slate-200 bg-slate-50 text-slate-800'
                    } focus:border-purple-600 focus:ring-4 focus:ring-purple-500/15`}
                  />
                ))}
              </div>

              {info && !error && !expired && <p className="text-center text-[11px] text-slate-400">{info}</p>}

              {expired ? (
                <button
                  type="button"
                  onClick={resend}
                  disabled={loading}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-purple-600/20 transition-all hover:bg-purple-500 active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Sending…' : 'Send code again'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => verify(code)}
                  disabled={loading || code.length !== 6}
                  className="w-full cursor-pointer rounded-xl bg-purple-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-purple-600/20 transition-all hover:bg-purple-500 active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {loading ? 'Checking…' : 'Verify & enter'}
                </button>
              )}

              <button
                type="button"
                onClick={() => backToLogin()}
                disabled={loading}
                className="mx-auto flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-purple-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" id="login-form" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="ph-name" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Pharmacy Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
                  <input id="ph-name" type="text" value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} placeholder="Enter registered pharmacy name" disabled={loading} autoComplete="organization" className={inputCls} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ph-id" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">User ID</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
                  <input id="ph-id" type="text" value={id} onChange={(e) => setId(e.target.value)} placeholder="Enter your ID" disabled={loading} autoComplete="username" autoCapitalize="none" spellCheck={false} className={inputCls} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ph-pw" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Access Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
                  <input id="ph-pw" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" disabled={loading} autoComplete="current-password" className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3 cursor-pointer text-slate-400 transition-colors hover:text-slate-600" aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full cursor-pointer rounded-xl bg-purple-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-purple-600/10 transition-all hover:bg-purple-500 hover:shadow-purple-600/20 active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-400"
              >
                {loading ? 'Verifying credentials…' : 'Authenticate & Enter'}
              </button>
            </form>
          )}
        </div>

        <div className="space-y-1 text-center opacity-80">
          <p className="text-base font-bold text-[#9333EA]">Argya Health — Pharmacy Management System</p>
          <p className="text-[10px] text-slate-400">Only authorized people are permitted to access this panel.</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Credentials are secure and checked in real-time with server database records.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// 3: Staff sign-in (after the pharmacy is logged in on this computer)
// ---------------------------------------------------------------------
const ROLE_HINTS: { role: string; label: string; icon: React.ElementType; desc: string; avatar: string }[] = [
  { role: 'Manager', label: 'Manager', icon: LayoutDashboard, desc: 'Full access: dashboard, staff and settings', avatar: 'from-purple-500 via-violet-600 to-indigo-600' },
  { role: 'Pharmacist', label: 'Pharmacist', icon: ShoppingCart, desc: 'Billing, medicines and patients', avatar: 'from-amber-400 to-orange-500' },
  { role: 'Accounts & Billing Officer', label: 'Cashier / Billing', icon: KeyRound, desc: 'New sale, pending bills and total sales', avatar: 'from-emerald-500 to-teal-600' },
  { role: 'Inventory Manager', label: 'Store keeper', icon: Package, desc: 'Medicines, restock and suppliers', avatar: 'from-orange-500 to-rose-500' },
  { role: 'Doctor', label: 'Doctor / Reception', icon: ClipboardPlus, desc: 'Patients and medical records', avatar: 'from-sky-500 to-indigo-500' },
];

export function StaffLogin({ pharmacyName, onSignedIn, onSwitchPharmacy }: { pharmacyName: string; onSignedIn: (token: string, staff: StaffUser) => void; onSwitchPharmacy: () => void }) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capsOn, setCapsOn] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!id.trim() || !password) return setError('Enter both staff ID and password.');
    setLoading(true);
    setError('');
    const r = await api('/staff/login', { method: 'POST', token: session.pharmacyToken(), body: { id: id.trim(), password } });
    setLoading(false);
    if (r.ok && r.body?.token) {
      try { localStorage.setItem('staffShiftStart', String(Date.now())); } catch { /* ignore */ }
      return onSignedIn(r.body.token, r.body.user);
    }
    setError(r.message || 'Invalid staff ID or password.');
  };

  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsOn(e.getModifierState?.('CapsLock') ?? false);
  const inputWrap =
    'group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 transition-all duration-200 hover:border-purple-200 hover:bg-white focus-within:border-purple-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-purple-500/20';
  const inputIcon = 'h-[18px] w-[18px] text-slate-400 transition-colors group-focus-within:text-purple-600';

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#fbfaff] font-sans">
      <GlobalStyles />
      <AmbientBackdrop />

      <header className="relative z-10 flex items-center justify-between px-4 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9 shadow-md shadow-purple-500/20 ring-1 ring-purple-100" />
          <p className="text-base font-black tracking-tight text-slate-900">
            Argya <span className="text-purple-600">Health</span>
          </p>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10 sm:px-8">
        <div className={`anim-pop grid w-full max-w-4xl overflow-hidden rounded-[28px] md:grid-cols-[1fr_1.05fr] ${GLASS_PANEL}`}>
          <section aria-label="Pharmacy and roles" className="hidden flex-col justify-between gap-8 border-r border-purple-100/70 bg-gradient-to-br from-purple-50 via-violet-50/70 to-indigo-50/60 p-9 md:flex">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Pharmacy verified
              </span>
              <div className="mt-5 flex items-center gap-3.5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-purple-600 shadow-sm ring-1 ring-purple-100">
                  <Store className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-purple-600">Staff terminal</p>
                  <p className="mt-1 truncate text-xl font-black tracking-tight text-slate-900">{pharmacyName}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-bold text-slate-500">Your role decides what you can open</p>
              <ul className="space-y-2">
                {ROLE_HINTS.map(({ role, label, icon: Icon, desc, avatar }) => (
                  <li key={role} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3.5 py-3 ring-1 ring-purple-100/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-500/10">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatar} text-white shadow-sm`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 leading-tight">
                      <p className="text-[13px] font-bold text-slate-900">{label}</p>
                      <p className="truncate text-[11px] text-slate-500">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="flex flex-col justify-center bg-white p-7 sm:p-10">
            <div className="mb-6 flex items-center gap-3 rounded-2xl bg-purple-50/70 p-3 ring-1 ring-purple-100 md:hidden">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-purple-600 ring-1 ring-purple-100">
                <Store className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-purple-600">Staff terminal</p>
                <p className="truncate text-sm font-black text-slate-900">{pharmacyName}</p>
              </div>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-700 ring-1 ring-purple-200/70">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-900 sm:text-[28px]">Sign in to your shift</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">Use the staff ID and password your pharmacy manager gave you.</p>

            {error && (
              <div role="alert" className="anim-fade-in mt-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} noValidate className="mt-6 space-y-4">
              <div>
                <label htmlFor="staff-id" className="mb-1.5 block text-xs font-bold text-slate-700">Staff ID</label>
                <div className={inputWrap}>
                  <User2 className={inputIcon} aria-hidden="true" />
                  <input
                    id="staff-id"
                    type="text"
                    value={id}
                    onChange={(e) => { setId(e.target.value); if (error) setError(''); }}
                    placeholder="e.g. ram01"
                    className="w-full bg-transparent font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label htmlFor="staff-password" className="mb-1.5 block text-xs font-bold text-slate-700">Password</label>
                <div className={inputWrap}>
                  <Lock className={inputIcon} aria-hidden="true" />
                  <input
                    id="staff-password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                    onKeyUp={checkCaps}
                    onKeyDown={checkCaps}
                    onBlur={() => setCapsOn(false)}
                    placeholder="••••••••"
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} className={`cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-purple-50 hover:text-purple-600 ${FOCUS_RING}`}>
                    {showPw ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {capsOn && (
                  <p className="anim-fade-in mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> Caps Lock is on
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className={`relative mt-2 flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 text-sm font-bold disabled:cursor-wait disabled:opacity-75 ${GRADIENT_BTN} ${FOCUS_RING}`}
              >
                {loading && <span className="anim-shimmer absolute inset-0" aria-hidden="true" />}
                {loading && <Loader2 className="relative h-4 w-4 animate-spin" aria-hidden="true" />}
                <span className="relative">{loading ? 'Checking credentials…' : 'Sign in'}</span>
                {!loading && <ChevronRight className="relative h-4 w-4" aria-hidden="true" />}
              </button>
            </form>

            <p className="mt-5 text-center text-[11px] text-slate-500">Forgot your password? Ask your manager to reset it.</p>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <button type="button" onClick={onSwitchPharmacy} className={`mx-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-purple-50 hover:text-purple-700 ${FOCUS_RING}`}>
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to pharmacy login
              </button>
            </div>
          </section>
        </div>
      </main>

      <footer className="relative z-10 pb-5 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Argya Health</footer>
    </div>
  );
}
