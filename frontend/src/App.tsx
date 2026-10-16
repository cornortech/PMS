// =====================================================================
// 💊 ARGYA HEALTH — the app (same design as Atithi RMS)
//   Landing page → Pharmacy login (→ admin email code) → Staff sign in → Pharmacy screens
//   Super admin → Admin Dashboard
// =====================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlarmClock, BarChart3, ChevronRight, ClipboardPlus, Fingerprint, Hourglass, LayoutDashboard, LogOut, Menu, Package,
  PanelLeftClose, PanelLeftOpen, Repeat, Settings as SettingsIcon, ShieldCheck, ShoppingCart, Timer, Truck, UserCog, Users, X,
} from 'lucide-react';
import { api, installAuthFetch, session, type PharmacyUser, type StaffUser } from './lib/api';
import { AppCtx, ROLE_LABEL, ROLE_PAGES, type Page } from './lib/app';
import { DEFAULT_SETTINGS, type Settings } from './lib/types';
import { cx } from './lib/format';
import { Logo, ToastProvider } from './components/ui';
import { AmbientBackdrop, FOCUS_RING, GlobalStyles } from './components/rmsStyle';

import LandingPage from './components/LandingPage';
import LoginScreen, { StaffLogin } from './components/LoginScreen';
// ⚡ Screens inside the app load only when they are opened, so the landing page stays small and fast (good for Google)
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const NewSale = React.lazy(() => import('./components/NewSale'));
const PendingBills = React.lazy(() => import('./components/PendingBills'));
const SalesHistory = React.lazy(() => import('./components/SalesHistory'));
const BillingAudit = React.lazy(() => import('./components/BillingAudit'));
const Medicines = React.lazy(() => import('./components/Medicines'));
const Suppliers = React.lazy(() => import('./components/Suppliers'));
const PatientManager = React.lazy(() => import('./components/PatientManager'));
const EMRManager = React.lazy(() => import('./components/EmrManager'));
const StaffManager = React.lazy(() => import('./components/StaffManager'));
const Attendance = React.lazy(() => import('./components/Attendance'));
const SettingsPage = React.lazy(() => import('./components/Settings'));

function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-purple-100 border-t-purple-600" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

installAuthFetch(); // the Patient / EMR / Attendance screens call the server directly — add the login token to them

// ---------- tiny router: /, /login, /app/<page> ----------
const pathPage = (): Page | null => {
  const m = window.location.pathname.match(/^\/app\/([a-z]+)/);
  return (m?.[1] as Page) || null;
};
const pushPath = (path: string) => {
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
};

type Stage =
  | { name: 'checking' }
  | { name: 'landing' }
  | { name: 'login'; message?: string }
  | { name: 'admin'; user: PharmacyUser }
  | { name: 'staffLogin'; user: PharmacyUser; message?: string }
  | { name: 'app'; user: PharmacyUser; staff: StaffUser };

// ---------- Sidebar pages (same groups as RMS) ----------
type GroupKey = 'overview' | 'operations' | 'billing' | 'admin';
const NAV_GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'operations', label: 'Operations' },
  { key: 'billing', label: 'Billing' },
  { key: 'admin', label: 'Administration' },
];
const NAV: { page: Page; label: string; icon: LucideIcon; group: GroupKey }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'overview' },
  { page: 'sale', label: 'New Sale', icon: ShoppingCart, group: 'operations' },
  { page: 'medicines', label: 'Medicines & Stock', icon: Package, group: 'operations' },
  { page: 'suppliers', label: 'Suppliers', icon: Truck, group: 'operations' },
  { page: 'patients', label: 'Patients', icon: Users, group: 'operations' },
  { page: 'emr', label: 'Medical Records', icon: ClipboardPlus, group: 'operations' },
  { page: 'pending', label: 'Pending Bills', icon: Hourglass, group: 'billing' },
  { page: 'sales', label: 'Total Sales', icon: BarChart3, group: 'billing' },
  { page: 'audit', label: 'Billing & VAT Audit', icon: ShieldCheck, group: 'billing' },
  { page: 'staff', label: 'Manage Staff', icon: UserCog, group: 'admin' },
  { page: 'attendance', label: 'Attendance', icon: Fingerprint, group: 'admin' },
  { page: 'settings', label: 'Settings', icon: SettingsIcon, group: 'admin' },
];
const TITLES: Record<Page, string> = Object.fromEntries(NAV.map((n) => [n.page, n.label])) as any;

// Colour per role (avatar + badge), like RMS
const ROLE_TONE: Record<string, { avatar: string; badge: string; dot: string }> = {
  Manager: { avatar: 'from-purple-500 via-violet-600 to-indigo-600', badge: 'bg-purple-50 text-purple-700 ring-purple-200', dot: 'bg-purple-500' },
  Pharmacist: { avatar: 'from-amber-400 to-orange-500', badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  'Accounts & Billing Officer': { avatar: 'from-emerald-500 to-teal-600', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  'Inventory Manager': { avatar: 'from-orange-500 to-rose-500', badge: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  Doctor: { avatar: 'from-sky-500 to-indigo-500', badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  Receptionist: { avatar: 'from-pink-500 to-rose-500', badge: 'bg-pink-50 text-pink-700 ring-pink-200', dot: 'bg-pink-500' },
};
const toneOf = (role: string) => ROLE_TONE[role] || ROLE_TONE.Manager;

// ---------- Splash (same as RMS) ----------
function SplashScreen() {
  const messages = ['Verifying secure session…', 'Setting up your workspace…', 'Checking the medicine shelf…', 'Almost ready…'];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % messages.length), 1100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#fbfaff] font-sans" role="status" aria-live="polite">
      <GlobalStyles />
      <AmbientBackdrop />
      <div className="anim-fade-up relative z-10 flex flex-col items-center">
        <div className="anim-floaty relative flex h-24 w-24 items-center justify-center">
          <span className="anim-pulse-ring absolute inset-0 rounded-[28px] bg-purple-400/30" />
          <span className="anim-spin-slow absolute -inset-2.5 rounded-[34px] border-2 border-purple-100 border-t-purple-600" />
          <Logo className="relative h-24 w-24 rounded-[28px] p-1.5 shadow-2xl shadow-purple-500/40" />
        </div>
        <h1 className="mt-10 text-4xl font-black tracking-tight text-slate-900">
          Argya <span className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">Health</span>
        </h1>
        <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">Pharmacy Management System</p>
        <div className="mt-9 h-1.5 w-60 overflow-hidden rounded-full bg-purple-100">
          <div className="anim-progress h-full w-2/5 rounded-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500" />
        </div>
        <p key={idx} className="anim-text-swap mt-4 h-4 text-xs font-medium text-slate-500">{messages[idx]}</p>
      </div>
    </div>
  );
}

// ---------- Header pieces ----------
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hidden items-center gap-2.5 rounded-xl border border-purple-100/80 bg-white/70 px-3 py-1.5 lg:flex">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <time dateTime={now.toISOString()} className="leading-tight">
        <span className="block font-mono text-xs font-bold tabular-nums text-slate-900">
          {now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          {now.toLocaleDateString('en-US', { timeZone: 'Asia/Kathmandu', weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </time>
    </div>
  );
}

function ShiftTimer() {
  const [start] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('staffShiftStart'));
      return v > 0 ? v : Date.now();
    } catch {
      return Date.now();
    }
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const mins = Math.max(0, Math.floor((now - start) / 60000));
  const h = Math.floor(mins / 60);
  const text = h > 0 ? `${h}h ${String(mins % 60).padStart(2, '0')}m` : `${mins}m`;
  return (
    <div className="hidden items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-amber-800 xl:flex" title="Time since you signed in">
      <Timer className="h-4 w-4" aria-hidden="true" />
      <span className="text-[11px] font-bold">
        On shift <span className="font-mono tabular-nums">{text}</span>
      </span>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Gateway />
    </ToastProvider>
  );
}

function Gateway() {
  const [stage, setStage] = useState<Stage>({ name: 'checking' });

  // On open: is there a saved login? Check it with the server.
  const check = useCallback(async (message?: string) => {
    const pharmacyToken = session.pharmacyToken();
    if (!pharmacyToken) {
      setStage(window.location.pathname.startsWith('/login') || message ? { name: 'login', message } : { name: 'landing' });
      return;
    }
    const r = await api('/auth/verify', { method: 'POST', token: pharmacyToken });
    if (!r.ok) {
      if (r.status === 0) {
        // offline / server waking up — try again shortly instead of logging out
        setTimeout(() => check(message), 4000);
        return;
      }
      session.clearAll();
      setStage({ name: 'login', message: r.message });
      pushPath('/login');
      return;
    }
    const user: PharmacyUser = r.body.user;
    session.setUser(user);
    if (user.isAdmin) return setStage({ name: 'admin', user });

    const staffToken = session.staffToken();
    if (staffToken) {
      const s = await api('/auth/verify', { method: 'POST', token: staffToken });
      if (s.ok && s.body?.staff) return setStage({ name: 'app', user, staff: s.body.staff });
      session.clearStaff();
    }
    setStage({ name: 'staffLogin', user, message });
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  // Any request that says "login expired" → go back to the right login screen
  useEffect(() => {
    const onSession = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.code === 'SUBSCRIPTION_EXPIRED') {
        session.clearAll();
        setStage({ name: 'login', message: d.message });
        return;
      }
      if (d.code === 'STAFF_GONE') session.clearStaff();
      check(d.message);
    };
    window.addEventListener('argya:session', onSession);
    return () => window.removeEventListener('argya:session', onSession);
  }, [check]);

  // Browser back / forward between landing and login
  useEffect(() => {
    const onPop = () => {
      setStage((s) => {
        if (s.name === 'landing' && window.location.pathname.startsWith('/login')) return { name: 'login' };
        if (s.name === 'login' && window.location.pathname === '/') return { name: 'landing' };
        return s;
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const logoutAll = () => {
    session.clearAll();
    pushPath('/login');
    setStage({ name: 'login' });
  };

  switch (stage.name) {
    case 'checking':
      return <SplashScreen />;
    case 'landing':
      return <LandingPage onLogin={() => { pushPath('/login'); setStage({ name: 'login' }); window.scrollTo(0, 0); }} />;
    case 'login':
      return (
        <LoginWithMessage
          message={stage.message}
          onBack={() => { pushPath('/'); setStage({ name: 'landing' }); }}
          onLoggedIn={(token, user) => {
            session.setPharmacy(token, user);
            session.clearStaff();
            if (user.isAdmin) {
              pushPath('/admin');
              setStage({ name: 'admin', user });
            } else setStage({ name: 'staffLogin', user });
          }}
        />
      );
    case 'admin':
      return (
        <React.Suspense fallback={<PageLoading />}>
          <AdminDashboard admin={stage.user} onLogout={logoutAll} />
        </React.Suspense>
      );
    case 'staffLogin':
      return (
        <>
          {stage.message && <TopNotice text={stage.message} />}
          <StaffLogin
            pharmacyName={stage.user.pharmacyName}
            onSwitchPharmacy={logoutAll}
            onSignedIn={(token, staff) => {
              session.setStaff(token, staff);
              setStage({ name: 'app', user: stage.user, staff });
            }}
          />
        </>
      );
    case 'app':
      return (
        <Shell
          user={stage.user}
          staff={stage.staff}
          onStaffLogout={() => {
            session.clearStaff();
            setStage({ name: 'staffLogin', user: stage.user });
          }}
          onLogoutAll={logoutAll}
        />
      );
  }
}

function TopNotice({ text }: { text: string }) {
  return <div className="fixed inset-x-0 top-0 z-50 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-slate-900">{text}</div>;
}

function LoginWithMessage({ message, ...rest }: { message?: string } & React.ComponentProps<typeof LoginScreen>) {
  return (
    <>
      {message && <TopNotice text={message} />}
      <LoginScreen {...rest} />
    </>
  );
}

// =====================================================================
// The pharmacy app: sidebar + header + page (same layout as RMS)
// =====================================================================
function Sidebar({
  pages, page, go, collapsed, isMobile, onClose, pharmacyName, staff, pendingCount, onStaffLogout, onLogoutAll,
}: {
  pages: Page[];
  page?: Page;
  go: (p: Page) => void;
  collapsed: boolean;
  isMobile?: boolean;
  onClose?: () => void;
  pharmacyName: string;
  staff: StaffUser;
  pendingCount: number;
  onStaffLogout: () => void;
  onLogoutAll: () => void;
}) {
  const compact = collapsed && !isMobile;
  const tone = toneOf(staff.role);
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: NAV.filter((n) => n.group === g.key && pages.includes(n.page)) })).filter((g) => g.items.length);

  return (
    <div className="flex h-full flex-col border-r border-purple-100/80 bg-white/85 backdrop-blur-xl">
      {/* Brand */}
      <div className={`relative flex items-center ${compact ? 'justify-center px-2' : 'justify-between px-5'} pb-5 pt-6`}>
        <div className="flex min-w-0 items-center gap-3">
          <Logo className="h-11 w-11 shrink-0 shadow-md shadow-purple-500/20 ring-1 ring-purple-100" />
          {!compact && (
            <div className="min-w-0">
              <p className="text-[17px] font-black leading-tight tracking-tight text-slate-900">
                Argya <span className="text-purple-600">Health</span>
              </p>
              <span className="mt-1 block truncate text-[10px] font-bold uppercase leading-none tracking-[0.16em] text-slate-500">{pharmacyName}</span>
            </div>
          )}
        </div>
        {isMobile && (
          <button onClick={onClose} aria-label="Close menu" className={`cursor-pointer rounded-xl border border-purple-100 p-2 text-slate-500 transition-all hover:bg-purple-50 hover:text-purple-700 active:scale-[0.96] ${FOCUS_RING}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className={`thin-scroll flex-1 space-y-6 overflow-y-auto pb-4 ${compact ? 'px-3' : 'px-4'}`}>
        {groups.map((group) => (
          <div key={group.key} role="group" aria-label={group.label}>
            {compact ? (
              <div className="mx-3 mb-2.5 h-px bg-purple-100/80" aria-hidden="true" />
            ) : (
              <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{group.label}</p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = page === item.page;
                const Icon = item.icon;
                return (
                  <li key={item.page}>
                    <button
                      onClick={() => go(item.page)}
                      title={compact ? item.label : undefined}
                      aria-label={compact ? item.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-xl text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] ${FOCUS_RING} ${
                        compact ? 'justify-center py-3' : 'px-3 py-2.5'
                      } ${active ? 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25' : 'text-slate-600 hover:bg-purple-50/80 hover:text-purple-700'}`}
                    >
                      {active && !compact && <span className="absolute -left-4 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-purple-600" aria-hidden="true" />}
                      <Icon aria-hidden="true" className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-white' : 'text-slate-400 group-hover:text-purple-600'}`} />
                      {!compact && <span className="truncate">{item.label}</span>}
                      {!compact && item.page === 'pending' && pendingCount > 0 && (
                        <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${active ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'}`}>{pendingCount}</span>
                      )}
                      {!compact && active && item.page !== 'pending' && <ChevronRight className="ml-auto h-4 w-4 opacity-80" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: staff + logout */}
      <div className={`space-y-2.5 border-t border-purple-100/60 bg-gradient-to-b from-white/60 to-purple-50/40 ${compact ? 'p-3' : 'p-4'}`}>
        <div className={`flex items-center gap-3 rounded-2xl border border-purple-100/80 bg-white/90 shadow-sm ${compact ? 'justify-center p-2' : 'p-3'}`}>
          <div className="relative shrink-0">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tone.avatar} text-sm font-black text-white shadow-md`} aria-hidden="true">
              {(staff.staffName || staff.role).charAt(0).toUpperCase()}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" aria-hidden="true" />
          </div>
          {!compact && (
            <div className="min-w-0 leading-tight">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">User role</p>
              <p className="truncate text-sm font-bold text-slate-900">{ROLE_LABEL[staff.role] || staff.role}</p>
              <p className="truncate font-mono text-[10px] text-slate-500">{staff.staffName ? `${staff.staffName} · ${staff.id}` : staff.id}</p>
            </div>
          )}
        </div>

        <button
          onClick={onStaffLogout}
          title="Log Out Staff"
          aria-label="Log Out Staff"
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50/80 px-3 py-2.5 text-xs font-bold text-red-700 outline-none transition-all hover:border-red-200 hover:bg-red-100 focus-visible:ring-4 focus-visible:ring-red-500/20 active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {!compact && <span>Log Out Staff</span>}
        </button>

        <button
          onClick={onLogoutAll}
          title="Switch pharmacy account"
          aria-label="Switch pharmacy account"
          className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:text-purple-700 ${FOCUS_RING}`}
        >
          <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
          {!compact && <span>Switch pharmacy account</span>}
        </button>
      </div>
    </div>
  );
}

function Shell({ user, staff, onStaffLogout, onLogoutAll }: { user: PharmacyUser; staff: StaffUser; onStaffLogout: () => void; onLogoutAll: () => void }) {
  const pages = useMemo(() => ROLE_PAGES[staff.role] || [], [staff.role]);
  const [page, setPage] = useState<Page | undefined>(() => {
    const p = pathPage();
    return p && pages.includes(p) ? p : pages[0];
  });
  const [pharmacy, setPharmacy] = useState<PharmacyUser>(user);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebarCollapsed') === '1'; } catch { return false; }
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [plan, setPlan] = useState<{ totalTime: number; remainingTime: number | null } | null>(null);
  const [patientForSale, setPatientForSale] = useState<any>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientsList, setPatientsList] = useState<any[]>([]);

  const reloadSettings = useCallback(async () => {
    const r = await api('/settings');
    if (r.ok) setSettings({ ...DEFAULT_SETTINGS, ...r.data });
  }, []);

  const loadPlan = useCallback(async () => {
    const r = await api('/subscription');
    if (r.ok) setPlan({ totalTime: r.data?.totalTime ?? 0, remainingTime: r.data?.remainingTime ?? null });
  }, []);

  useEffect(() => {
    reloadSettings();
    loadPlan();
  }, [reloadSettings, loadPlan]);

  const refreshPending = useCallback(async () => {
    if (!pages.includes('pending')) return;
    const r = await api('/sales?status=pending');
    if (r.ok && Array.isArray(r.data)) setPendingCount(r.data.length);
  }, [pages]);
  useEffect(() => {
    refreshPending();
    const t = window.setInterval(refreshPending, 60000);
    return () => window.clearInterval(t);
  }, [refreshPending, page]);

  const loadPatients = useCallback(async () => {
    if (!pages.includes('patients')) return;
    const r = await api('/patients');
    if (r.ok && Array.isArray(r.data)) setPatientsList(r.data);
  }, [pages]);
  useEffect(() => {
    if (page === 'patients' || page === 'emr') loadPatients();
  }, [page, loadPatients]);

  const go = useCallback(
    (p: Page) => {
      if (!pages.includes(p)) return;
      setPage(p);
      setDrawer(false);
      pushPath(`/app/${p}`);
      window.scrollTo(0, 0);
    },
    [pages]
  );

  useEffect(() => {
    if (page) pushPath(`/app/${page}`);
    const onPop = () => {
      const p = pathPage();
      if (p && pages.includes(p)) setPage(p);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = page ? `${TITLES[page]} · ${pharmacy.pharmacyName} · Argya Health` : 'Argya Health';
  }, [page, pharmacy.pharmacyName]);

  const toggleSidebar = () => {
    setCollapsed((c) => {
      try { localStorage.setItem('sidebarCollapsed', c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  };

  const ctx = useMemo(
    () => ({
      pharmacy,
      staff,
      settings,
      reloadSettings,
      setPharmacy: (p: PharmacyUser) => {
        setPharmacy(p);
        session.setUser(p);
      },
      can: (p: Page) => pages.includes(p),
      go,
      isManager: staff.role === 'Manager',
      plan,
    }),
    [pharmacy, staff, settings, reloadSettings, pages, go, plan]
  );

  const currentItem = NAV.find((n) => n.page === page);
  const currentGroup = currentItem ? NAV_GROUPS.find((g) => g.key === currentItem.group) : undefined;
  const CurrentIcon = currentItem?.icon || LayoutDashboard;
  const tone = toneOf(staff.role);
  const daysLeft = plan?.remainingTime ?? null;

  const sidebarProps = {
    pages, page, go, pharmacyName: pharmacy.pharmacyName, staff, pendingCount,
    onStaffLogout: () => { setDrawer(false); onStaffLogout(); },
    onLogoutAll: () => { setDrawer(false); onLogoutAll(); },
  };

  return (
    <AppCtx.Provider value={ctx}>
      <div className="relative flex min-h-screen bg-[#fbfaff] font-sans text-slate-800 antialiased">
        <GlobalStyles />
        <AmbientBackdrop intensity="soft" />

        {/* Desktop sidebar */}
        <aside className={`relative sticky top-0 z-10 hidden h-screen shrink-0 transition-[width] duration-300 ease-out md:block ${collapsed ? 'w-[84px]' : 'w-72'}`} id="app-sidebar">
          <Sidebar {...sidebarProps} collapsed={collapsed} />
        </aside>

        {/* Mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="anim-fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <aside className="absolute inset-y-0 left-0 w-[85%] max-w-80 animate-slide-up shadow-2xl">
              <Sidebar {...sidebarProps} collapsed={false} isMobile onClose={() => setDrawer(false)} />
            </aside>
          </div>
        )}

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-3 border-b border-purple-100/70 bg-white/75 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setDrawer(true)} className={`cursor-pointer rounded-xl border border-purple-100 bg-white p-2.5 text-slate-600 transition-all hover:bg-purple-50 hover:text-purple-700 active:scale-[0.96] md:hidden ${FOCUS_RING}`} aria-label="Open navigation menu" aria-expanded={drawer}>
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                onClick={toggleSidebar}
                className={`hidden cursor-pointer rounded-xl border border-purple-100 bg-white p-2.5 text-slate-500 transition-all hover:bg-purple-50 hover:text-purple-700 active:scale-[0.96] md:flex ${FOCUS_RING}`}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
              </button>
              <div className="flex min-w-0 items-center gap-3">
                <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 via-violet-100 to-indigo-100 text-purple-700 ring-1 ring-purple-200/60 sm:flex">
                  <CurrentIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                </div>
                <div className="min-w-0 leading-tight">
                  <nav aria-label="Breadcrumb" className="hidden sm:block">
                    <ol className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <li className="max-w-[160px] truncate">{pharmacy.pharmacyName}</li>
                      {currentGroup && (
                        <>
                          <li aria-hidden="true"><ChevronRight className="h-3 w-3 text-slate-300" /></li>
                          <li className="truncate">{currentGroup.label}</li>
                        </>
                      )}
                    </ol>
                  </nav>
                  <h1 className="truncate text-base font-black tracking-tight text-slate-900 sm:text-lg">{currentItem?.label || ''}</h1>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5">
              {daysLeft !== null && daysLeft <= 7 && (
                <span className={`hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold sm:inline-flex ${daysLeft <= 0 ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  <AlarmClock className="h-4 w-4" />
                  {daysLeft <= 0 ? 'Plan expired' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                </span>
              )}
              <ShiftTimer />
              <LiveClock />
              <div className="flex items-center gap-2.5 rounded-xl border border-purple-100/80 bg-white/90 p-1 shadow-sm sm:pr-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${tone.avatar} text-xs font-black text-white`} aria-hidden="true">
                  {(staff.staffName || staff.role).charAt(0).toUpperCase()}
                </div>
                <div className="hidden leading-tight sm:block">
                  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${tone.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                    {ROLE_LABEL[staff.role] || staff.role}
                  </span>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-500">{staff.id}</p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 outline-none sm:p-6 lg:p-8" id="app-main" tabIndex={-1}>
            {!page ? (
              <div className="mx-auto mt-16 max-w-md rounded-3xl border border-purple-100 bg-white p-6 text-center shadow-sm">
                <p className="text-lg font-black text-slate-900">No pages for this role</p>
                <p className="mt-1 text-sm text-slate-500">Your role “{staff.role}” has no pages. Ask your manager to set your role in Manage Staff.</p>
              </div>
            ) : (
              <div key={page} className="anim-fade-up mx-auto w-full max-w-[1600px]">
                <React.Suspense fallback={<PageLoading />}>
                {page === 'dashboard' && <Dashboard />}
                {page === 'sale' && <NewSale patientShortcut={patientForSale} clearShortcut={() => setPatientForSale(null)} onSaved={refreshPending} />}
                {page === 'pending' && <PendingBills onChange={refreshPending} />}
                {page === 'sales' && <SalesHistory onChange={refreshPending} />}
                {page === 'audit' && <BillingAudit />}
                {page === 'medicines' && <Medicines />}
                {page === 'suppliers' && <Suppliers />}
                {page === 'patients' && (
                  <PatientManager
                    patients={patientsList}
                    onPatientsUpdated={loadPatients}
                    lang="en"
                    selectedPatient={selectedPatient}
                    setSelectedPatient={setSelectedPatient}
                    onStartSaleForPatient={(p: any) => {
                      if (!pages.includes('sale')) return;
                      setPatientForSale(p);
                      go('sale');
                    }}
                  />
                )}
                {page === 'emr' && <EMRManager patients={patientsList} lang="en" onRefreshPatients={loadPatients} />}
                {page === 'staff' && <StaffManager currentStaffId={staff.id} />}
                {page === 'attendance' && <Attendance />}
                {page === 'settings' && <SettingsPage />}
                </React.Suspense>
              </div>
            )}
          </main>
        </div>
      </div>
    </AppCtx.Provider>
  );
}
