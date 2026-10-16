import React, { useEffect, useState } from 'react';
import {
  QrCode, BellRing, Wallet, Users, ShieldAlert, Percent, PackagePlus, Fingerprint, FileX2, Sunrise, Smartphone,
  Printer, CalendarClock, Barcode, History, Truck, Stethoscope, LockKeyhole,
} from 'lucide-react';
import { FeatureMedia, VisualKind } from './LandingVisuals';
import { Logo } from './ui';

// =====================================================================
// ARGYA HEALTH — FIRST PAGE (shown before login). Same design as Atithi RMS.
// ✏️ All the text is written directly below, so you can change it easily.
// The "Login" buttons open the normal login page.
//
// Images (optional): put them in  frontend/public/
//   /logo.png                          → your logo (top bar, login, sidebar)
//   /products/argya-health.png         → big picture at the top
//   /products/argya/dashboard.png …    → feature screenshots (if missing, a small drawing is shown)
// =====================================================================

// ✏️ Change these to your own details
const BRAND = 'Argya Health';
const COMPANY = 'Argya Health';
const EMAIL = 'info@cornortech.com';
const WEBSITE = 'cornortech.com'; // leave '' to hide
const PRICE_PREMIUM = 'NPR 11,111';
const PRICE_PREMIUM_OLD = 'NPR 20,000';

// 🎊 Festive offer: true = show the offer, false = hide it
const FESTIVE_OFFER = true;

// WhatsApp number for all "Request a Demo" / plan buttons
const WHATSAPP = '9779828750115';
const wa = (text: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

// ---------------- small icons ----------------
type IconProps = { className?: string };
const ArrowRight = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);
const ChevronDown = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);
const CheckIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const BoltIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const LockIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const ChartIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const ScaleIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const MailIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const SparkIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

// ---------------- small building blocks (the text is passed in where they are used) ----------------
function SectionHeading({ eyebrow, title, subtitle, center = false }: { eyebrow: string; title: string; subtitle?: React.ReactNode; center?: boolean }) {
  return (
    <div className={`mb-10 ${center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}`}>
      <span className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-purple-700">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-[#1e003a] lg:text-4xl">{title}</h2>
      {subtitle && <div className="mt-3 text-sm font-medium leading-relaxed text-slate-500 lg:text-base">{subtitle}</div>}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3.5 py-1.5 text-[11px] font-bold text-purple-800 ring-1 ring-inset ring-purple-100">
      <CheckIcon className="h-3 w-3 text-purple-600" />
      {children}
    </span>
  );
}

function StoryParagraph({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 flex gap-4 border-t border-slate-100 pt-6">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-purple-100 to-indigo-100 text-xs font-black text-purple-700">
        {n}
      </span>
      <p className="text-[15px] font-medium leading-relaxed text-slate-600 lg:text-base">{children}</p>
    </div>
  );
}

function FeatureCard({
  n,
  title,
  kind,
  image,
  tint,
  big = false,
  children,
}: {
  n: string;
  title: string;
  kind: VisualKind;
  image?: string;
  tint: string;
  big?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-[28px] border border-purple-100/70 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition-all duration-500 ease-out hover:-translate-y-1.5 hover:border-purple-200 hover:shadow-[0_28px_56px_-12px_rgba(147,51,234,0.22)] ${
        big ? 'sm:col-span-2 lg:flex-row' : ''
      }`}
    >
      <div
        className={`relative flex items-start justify-center overflow-hidden bg-linear-to-br ${tint} px-6 pt-8 ${
          big ? 'h-72 lg:h-auto lg:min-h-[340px] lg:w-[58%] lg:items-center lg:pb-8' : 'h-60'
        }`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(147,51,234,0.18) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
        />
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-purple-400/15 blur-3xl" />
        <span className="absolute left-4 top-4 z-10 flex h-7 min-w-7 items-center justify-center rounded-full bg-white/90 px-2 text-[10px] font-black text-purple-700 shadow-sm backdrop-blur">
          {n}
        </span>
        {big && (
          <span className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-linear-to-r from-purple-600 to-indigo-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
            <SparkIcon className="h-3 w-3" />
            Core
          </span>
        )}
        <div className="relative w-full transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:scale-[1.02]">
          <FeatureMedia kind={kind} title={title} image={image} wide={big} />
        </div>
        {!big && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-white/90 to-transparent" />}
      </div>

      <div className={`relative flex flex-col justify-center p-6 ${big ? 'lg:w-[42%] lg:p-9' : ''}`}>
        <h3 className={`font-black leading-snug text-[#1e003a] ${big ? 'text-xl lg:text-2xl' : 'text-base'}`}>{title}</h3>
        <div className={`mt-1.5 font-medium leading-relaxed text-slate-500 ${big ? 'text-sm lg:text-base' : 'text-[13px]'}`}>{children}</div>
      </div>
    </article>
  );
}

function MiniFeature({ icon: Icon, title, tag, children }: { icon: React.ElementType; title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="group relative flex gap-4 rounded-2xl border border-purple-100/70 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-[0_18px_40px_-14px_rgba(147,51,234,0.25)]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-700 transition-colors group-hover:from-purple-600 group-hover:to-indigo-600 group-hover:text-white">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-black leading-snug text-[#1e003a]">{title}</h3>
          {tag && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-100">{tag}</span>}
        </div>
        <p className="mt-1 text-[13px] font-medium leading-relaxed text-slate-500">{children}</p>
      </div>
    </div>
  );
}

function PlanItem({ dark = false, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full ${dark ? 'bg-[#a3e635]/20 text-[#a3e635]' : 'bg-purple-100 text-purple-600'}`}>
        <CheckIcon className="h-3 w-3" />
      </span>
      <span className={`text-sm font-semibold leading-snug ${dark ? 'text-white/90' : 'text-slate-600'}`}>{children}</span>
    </li>
  );
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'key-features', label: 'Features' },
  { id: 'more-features', label: 'More' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'why-it-works', label: 'Why It Works' },
];

// =====================================================================
// PAGE
// =====================================================================
export default function LandingPage({ onLogin }: { onLogin: () => void }) {
  const [activeSection, setActiveSection] = useState('overview');
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [storyOpen, setStoryOpen] = useState(false);
  const [heroImg, setHeroImg] = useState('/products/argya-health.png');
  const [logoOk, setLogoOk] = useState(true);
  const host = typeof window !== 'undefined' ? window.location.host : 'argyahealth.com';

  // Scroll progress bar + shadow under the top bar
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      setIsScrolled(window.scrollY > 24);
      const max = el.scrollHeight - el.clientHeight;
      setScrollProgress(max > 0 ? Math.min(window.scrollY / max, 1) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Which section is on screen (for the top tabs)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveSection(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <main className="min-h-screen overflow-x-clip bg-white font-sans">
      {/* ==== Sticky top bar ==== */}
      <div
        className={`sticky top-0 z-40 bg-white/85 backdrop-blur-xl transition-shadow duration-300 ${
          isScrolled ? 'border-b border-purple-100 shadow-[0_8px_24px_-12px_rgba(76,29,149,0.18)]' : 'border-b border-transparent'
        }`}
      >
        <div className="absolute inset-x-0 top-0 h-[3px] bg-transparent">
          <div className="h-full bg-linear-to-r from-purple-600 via-violet-500 to-indigo-500 transition-[width] duration-150" style={{ width: `${scrollProgress * 100}%` }} />
        </div>

        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 lg:px-8">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex min-w-0 cursor-pointer items-center gap-2.5">
            {logoOk ? (
              <img src="/logo.png" alt="" className="h-8 w-auto max-w-[90px] shrink-0 object-contain" onError={() => setLogoOk(false)} />
            ) : (
              <Logo className="h-8 w-8" />
            )}
            <span className="truncate text-sm font-extrabold text-[#1e003a]">{BRAND}</span>
          </button>

          <nav aria-label="Page sections" className="hidden items-center gap-1 rounded-full border border-purple-100 bg-purple-50/70 p-1 md:flex">
            {SECTIONS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id)}
                aria-current={activeSection === tab.id ? 'true' : undefined}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-black transition-all duration-200 ${
                  activeSection === tab.id
                    ? 'bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/30'
                    : 'text-purple-700 hover:bg-white hover:text-purple-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            onClick={onLogin}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-linear-to-r from-purple-600 to-indigo-600 px-5 py-2 text-xs font-black text-white shadow-md shadow-purple-500/25 transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
          >
            Login
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Mobile section tabs */}
        <nav aria-label="Page sections" className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 md:hidden [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id)}
              className={`shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-black transition-all ${
                activeSection === tab.id ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ==== Hero ==== */}
      <section className="relative overflow-hidden bg-linear-to-b from-[#f6eeff] via-[#fbf8ff] to-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(147,51,234,0.25) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            maskImage: 'linear-gradient(to bottom, black 40%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent)',
          }}
        />
        <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-purple-300/30 blur-[110px]" />
        <div className="pointer-events-none absolute -right-24 top-24 h-[380px] w-[380px] rounded-full bg-indigo-300/25 blur-[110px]" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pt-16">
          {/* Left: text */}
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-white px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-purple-700 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                Pharmacy Software
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Made for Nepal
              </span>
            </div>

            <h1 className="text-4xl font-black leading-[0.98] tracking-tight text-[#1e003a] lg:text-6xl">{BRAND}</h1>
            <p className="mt-4 bg-linear-to-r from-purple-700 via-violet-600 to-indigo-600 bg-clip-text text-lg font-extrabold text-transparent lg:text-2xl">
              Pharmacy Management, Simplified
            </p>
            <p className="mt-4 max-w-xl text-[15px] font-medium leading-relaxed text-slate-600 lg:text-base">
              One system for your whole medical store — fast billing with VAT, medicine stock with batch and expiry, expiry and low-stock alerts, due (udharo) bills, payment QR with the bill amount, patient records, suppliers and fingerprint staff attendance.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={wa(`Hello, I want ${BRAND} for my pharmacy. Could you please explain the system and available packages?`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-linear-to-r from-purple-600 via-violet-600 to-indigo-600 px-7 py-3.5 text-sm font-black text-white shadow-lg shadow-purple-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-500/40 active:scale-[0.98]"
              >
                Request a Demo
                <ArrowRight />
              </a>
              <button
                onClick={() => scrollToSection('key-features')}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-purple-200 bg-white px-7 py-3.5 text-sm font-bold text-purple-700 shadow-xs transition-all hover:border-purple-300 hover:bg-purple-50 active:scale-[0.98]"
              >
                Explore features
              </button>
            </div>

            {/* Quick facts */}
            <dl className="mt-10 grid max-w-lg grid-cols-3 divide-x divide-purple-100 rounded-2xl border border-purple-100 bg-white/80 shadow-xs backdrop-blur">
              <div className="px-3 py-3 sm:px-4">
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Features</dt>
                <dd className="mt-0.5 text-lg sm:text-xl font-black text-[#1e003a]">24 +</dd>
              </div>
              <div className="px-3 py-3 sm:px-4">
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Free trial</dt>
                <dd className="mt-0.5 truncate text-lg sm:text-xl font-black text-[#1e003a]">30 days</dd>
              </div>
              <div className="px-3 py-3 sm:px-4">
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">From</dt>
                <dd className="mt-0.5 truncate text-lg sm:text-xl font-black text-purple-700">{PRICE_PREMIUM}</dd>
              </div>
            </dl>
          </div>

          {/* Right: product picture */}
          <div className="relative flex w-full justify-center">
            <div className="absolute -inset-10 rounded-[56px] bg-linear-to-br from-purple-400/35 via-violet-300/30 to-indigo-300/35 blur-3xl" />
            <div className="relative w-full overflow-hidden rounded-3xl bg-white shadow-[0_60px_120px_-20px_rgba(76,29,149,0.45)] ring-1 ring-purple-900/10 lg:w-[120%] lg:-ml-[10%]">
              <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-rose-300" />
                <span className="h-3 w-3 rounded-full bg-amber-300" />
                <span className="h-3 w-3 rounded-full bg-emerald-300" />
                <span className="ml-3 flex-1 truncate rounded-md bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-400 ring-1 ring-slate-100">
                  {host}
                </span>
              </div>
              <div className="relative flex w-full items-center justify-center bg-slate-950">
                {heroImg ? (
                  <img
                    src={heroImg}
                    alt={`${BRAND} preview`}
                    className={heroImg === '/products/argya-health.png' ? 'block h-auto w-full object-contain' : 'my-16 max-h-36 max-w-[70%] object-contain'}
                    onError={() => setHeroImg((cur) => (cur === '/products/argya-health.png' ? '/logo.png' : ''))}
                  />
                ) : (
                  <div className="my-16 flex items-center gap-4">
                    <Logo className="h-20 w-20" />
                    <span className="text-3xl font-black tracking-tight text-white">
                      Argya <span className="text-purple-400">Health</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="absolute -left-4 top-8 z-20 hidden rounded-2xl border border-purple-100 bg-white/95 px-4 py-3 shadow-2xl shadow-purple-900/15 backdrop-blur sm:block lg:-left-16">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Built for</p>
              <p className="text-sm font-black text-[#1e003a]">Billing &amp; Medicine Stock</p>
            </div>
            <div className="absolute -bottom-6 -right-2 z-20 hidden items-center gap-3 rounded-2xl border border-emerald-100 bg-white/95 px-4 py-3 shadow-2xl shadow-emerald-900/15 backdrop-blur sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <BoltIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Always on time</p>
                <p className="text-sm font-black text-[#1e003a]">Expiry &amp; Low-Stock Alerts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Highlights strip */}
        <div className="relative border-y border-purple-100 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-6 py-4 lg:px-8">
            <Chip>Fast Billing &amp; Barcode</Chip>
            <Chip>VAT Billing</Chip>
            <Chip>Batch &amp; Expiry Tracking</Chip>
            <Chip>Expiry Alerts</Chip>
            <Chip>Low-Stock Alerts</Chip>
            <Chip>Due (Udharo) Bills</Chip>
            <Chip>eSewa · Khalti · Fonepay QR</Chip>
            <Chip>Patient Records &amp; EMR</Chip>
            <Chip>Suppliers &amp; Restock</Chip>
            <Chip>Fingerprint Attendance</Chip>
            <Chip>Daily Sales &amp; Profit</Chip>
            <Chip>Nepali (BS) Dates</Chip>
          </div>
        </div>
      </section>

      {/* ==== Body ==== */}
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 lg:px-8 lg:pt-24">
        {/* ==== Overview ==== */}
        <section id="overview" className="mb-28 scroll-mt-32">
          <SectionHeading eyebrow="Overview" title={`What ${BRAND} does for you`} subtitle="The full picture, in plain words." />

          <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-8">
              <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-[0_4px_30px_rgba(15,23,42,0.04)] lg:p-10">
                <p className="text-lg font-semibold leading-relaxed text-slate-800 lg:text-xl">
                  <span className="float-left mr-3 mt-1 text-5xl font-black leading-[0.8] text-purple-600 lg:text-6xl">A</span>
                  rgya Health is made for pharmacies and medical stores in Nepal that want to stop using notebooks, calculators and boxes of old bills. From the moment a customer asks for a medicine until the bill is paid, every step is connected — and the stock updates by itself.
                </p>

                <StoryParagraph n="01">
                  The Dashboard shows the money received today, today’s profit, money still due from customers, the last 7 days and the best-selling medicines. It also warns you about expired medicine on the shelf, medicine expiring soon and medicine running low.
                </StoryParagraph>

                <StoryParagraph n="02">
                  At the counter, New Sale finds a medicine by brand name, generic name or barcode. Stock is checked as you add it, expired medicine can never be billed, and two counters can never sell the last box twice. Type the customer’s phone and their name — and any allergy — appears.
                </StoryParagraph>

                {storyOpen && (
                  <>
                    <StoryParagraph n="03">
                      Billing works the Nepali way: fiscal-year bill numbers, Nepali (BS) dates, discount in rupees or percent, and VAT that you set once in Settings. Customers pay by Cash, eSewa, Khalti, Fonepay, bank or card — and a QR with the exact bill amount appears on screen. Regular customers can take medicine on Due (udharo) and pay later.
                    </StoryParagraph>

                    <StoryParagraph n="04">
                      A wrong bill is never deleted. A manager cancels it with a reason, it gets a credit note number and the medicine goes back into stock. Bills print cleanly on 58 mm or 80 mm thermal printers or A4 paper, with batch number and expiry on every line.
                    </StoryParagraph>

                    <StoryParagraph n="05">
                      In the store room, Restock adds new boxes with the new batch, expiry and cost. Correct Stock fixes the count when something breaks or expires, and every change is written in the stock history. Suppliers keeps every distributor’s contact and PAN in one place.
                    </StoryParagraph>

                    <StoryParagraph n="06">
                      Each staff member gets their own login — Manager, Pharmacist, Cashier, Store keeper, Doctor or Receptionist — and sees only the pages for their job. Fingerprint attendance records check-in, check-out, late and overtime. Patient records and visit notes (EMR) keep care information safe and private to your pharmacy.
                    </StoryParagraph>
                  </>
                )}

                <div className="relative mt-6">
                  {!storyOpen && <div className="pointer-events-none absolute -top-24 left-0 right-0 h-24 bg-linear-to-t from-white to-transparent" />}
                  <button
                    onClick={() => setStoryOpen((o) => !o)}
                    aria-expanded={storyOpen}
                    className="mx-auto flex cursor-pointer items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-5 py-2.5 text-xs font-black text-purple-700 transition hover:bg-purple-100 active:scale-[0.97]"
                  >
                    {storyOpen ? 'Show less' : 'Read the full story (4 more)'}
                    <ChevronDown className={`h-4 w-4 transition-transform ${storyOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            <aside className="lg:col-span-4">
              <div className="space-y-4 lg:sticky lg:top-28">
                <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#1e003a] via-[#2d0a52] to-[#3b1266] p-6 shadow-xl shadow-purple-950/15 lg:p-7">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border border-white/10" />
                  <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">
                    <BoltIcon className="h-3.5 w-3.5" />
                    Built for
                  </p>
                  <p className="text-sm font-bold leading-relaxed text-white">
                    Pharmacies, medical stores, clinic pharmacies and hospital counters — billing, stock and patients, from one system.
                  </p>
                  <div className="my-5 h-px bg-white/10" />
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">Category</p>
                  <span className="inline-block rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">Healthcare Software</span>
                </div>

                <div className="rounded-3xl border border-purple-100 bg-purple-50/50 p-6 lg:p-7">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-purple-700">Plans</p>
                  <ul className="space-y-2">
                    <li className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-purple-100">
                      <span className="font-bold text-slate-700">Demo</span>
                      <span className="font-black text-purple-700">Free</span>
                    </li>
                    <li className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-purple-100">
                      <span className="font-bold text-slate-700">Premium</span>
                      <span className="font-black text-purple-700">{PRICE_PREMIUM}</span>
                    </li>
                    <li className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-purple-100">
                      <span className="font-bold text-slate-700">Enterprise</span>
                      <span className="font-black text-purple-700">Custom</span>
                    </li>
                  </ul>
                  <button onClick={() => scrollToSection('pricing')} className="mt-3 w-full cursor-pointer text-center text-xs font-black text-purple-700 hover:text-purple-900">
                    Compare plans
                  </button>
                </div>

                <button
                  onClick={onLogin}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-purple-600 via-violet-600 to-indigo-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-purple-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
                >
                  Login to {BRAND}
                  <ArrowRight />
                </button>
              </div>
            </aside>
          </div>
        </section>

        {/* ==== Key Features ==== */}
        <section id="key-features" className="mb-28 scroll-mt-32">
          <SectionHeading
            eyebrow="Key features"
            title="Everything you need, in one clean system"
            subtitle="24 features working together, so your team spends less time on paperwork and more time on patients."
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard n="01" big title="Dashboard" kind="dashboard" image="/products/argya/dashboard.png" tint="from-[#f3e8ff] via-[#faf5ff] to-white">
              Money received today, today’s profit, money still due, the last 7 days and the best-selling medicines — with expiry and low-stock warnings on the same screen.
              <div className="mt-5 flex flex-wrap gap-1.5">
                <span className="rounded-lg bg-purple-50 px-2.5 py-1 text-[10px] font-bold text-purple-700 ring-1 ring-inset ring-purple-100">Daily Sales &amp; Profit</span>
                <span className="rounded-lg bg-purple-50 px-2.5 py-1 text-[10px] font-bold text-purple-700 ring-1 ring-inset ring-purple-100">Expiry Alerts</span>
                <span className="rounded-lg bg-purple-50 px-2.5 py-1 text-[10px] font-bold text-purple-700 ring-1 ring-inset ring-purple-100">Low-Stock Alerts</span>
              </div>
            </FeatureCard>

            <FeatureCard n="02" title="Total Sales" kind="sales" image="/products/argya/total-sales.png" tint="from-[#e0e7ff] via-[#eef2ff] to-white">
              Every bill by date, money received by payment method, profit and medicines sold — download to Excel any time.
            </FeatureCard>

            <FeatureCard n="03" title="Pending Bills (Udharo)" kind="pending" image="/products/argya/pending-bills.png" tint="from-[#fce7f3] via-[#fdf2f8] to-white">
              Give medicine on credit to trusted customers. Their bills wait in one list until they pay — receive one bill or everything at once.
            </FeatureCard>

            <FeatureCard n="04" title="New Sale" kind="bill" image="/products/argya/new-sale.png" tint="from-[#dcfce7] via-[#f0fdf4] to-white">
              Bills with discount, VAT and fiscal-year numbers. Paid by Cash, eSewa, Khalti, Fonepay, bank, card — or saved as Due.
            </FeatureCard>

            <FeatureCard n="05" title="Expiry Alerts" kind="kitchen" image="/products/argya/expiry.png" tint="from-[#fef3c7] via-[#fffbeb] to-white">
              See what expires in the next 30, 60 or 90 days. Expired medicine is marked red and can never be billed by mistake.
            </FeatureCard>

            <FeatureCard n="06" title="Stock at a Glance" kind="tables" image="/products/argya/stock-map.png" tint="from-[#e0f2fe] via-[#f0f9ff] to-white">
              Every medicine marked In stock, Low, Expiring or Empty — with rack location so staff find it fast.
            </FeatureCard>

            <FeatureCard n="07" title="Search & Barcode" kind="order" image="/products/argya/search.png" tint="from-[#f3e8ff] via-[#faf5ff] to-white">
              Find a medicine by brand, generic name or barcode scan. Press Enter and it is on the bill.
            </FeatureCard>

            <FeatureCard n="08" title="Due Payment Tracking" kind="tracking" image="/products/argya/due.png" tint="from-[#e0e7ff] via-[#eef2ff] to-white">
              Who owes how much, since when — and a warning at the counter when a customer already has unpaid bills.
            </FeatureCard>

            <FeatureCard n="09" title="Medicine Catalogue" kind="menu" image="/products/argya/medicines.png" tint="from-[#fce7f3] via-[#fdf2f8] to-white">
              Brand and generic name, type, strength, cost and selling price, batch, expiry, rack and barcode for every medicine.
            </FeatureCard>

            <FeatureCard n="10" title="Restock & Stock History" kind="stock" image="/products/argya/restock.png" tint="from-[#dcfce7] via-[#f0fdf4] to-white">
              Add new boxes in one step with batch, expiry and cost. Every sale, restock, return and correction is recorded.
            </FeatureCard>

            <FeatureCard n="11" title="Bill Cancel & VAT Records" kind="audit" image="/products/argya/vat.png" tint="from-[#fef3c7] via-[#fffbeb] to-white">
              Bills are never deleted. A wrong bill is cancelled with a reason and a credit note, and the stock goes back.
            </FeatureCard>

            <FeatureCard n="12" title="Staff Management" kind="staff" image="/products/argya/staff.png" tint="from-[#e0f2fe] via-[#f0f9ff] to-white">
              Logins for pharmacists, cashiers, store keepers, doctors and receptionists — each role sees only its own pages.
            </FeatureCard>

            <FeatureCard n="13" title="Settings" kind="settings" image="/products/argya/settings.png" tint="from-[#f3e8ff] via-[#faf5ff] to-white">
              Pharmacy details on the bill, VAT on/off and rate, bill size, due bills on/off, expiry warning days and payment QR.
            </FeatureCard>

            <FeatureCard n="14" title="Payment QR with Amount" kind="bill" tint="from-[#e0e7ff] via-[#eef2ff] to-white">
              Upload your eSewa, Khalti or Fonepay QR once. Every bill shows a QR with the exact amount — the customer just scans and pays.
            </FeatureCard>

            <FeatureCard n="15" title="Patients & Allergy Warning" kind="order" tint="from-[#fce7f3] via-[#fdf2f8] to-white">
              Type a phone number at billing — the patient’s name fills in and any drug allergy shows in red.
            </FeatureCard>

            <FeatureCard n="16" title="Medical Records (EMR)" kind="audit" tint="from-[#dcfce7] via-[#f0fdf4] to-white">
              Visit notes, vitals, diagnosis, prescription and follow-up for every patient — private to your pharmacy.
            </FeatureCard>

            <FeatureCard n="17" title="Suppliers" kind="stock" tint="from-[#fef3c7] via-[#fffbeb] to-white">
              Every distributor’s contact, phone, PAN and notes in one place — pick them while restocking.
            </FeatureCard>

            <FeatureCard n="18" title="Staff Attendance (Fingerprint)" kind="staff" tint="from-[#e0f2fe] via-[#f0f9ff] to-white">
              Staff check in and out with a fingerprint machine. See late and overtime, and download Excel reports.
            </FeatureCard>

            <FeatureCard n="19" title="Clean Bill Printing" kind="bill" tint="from-[#f3e8ff] via-[#faf5ff] to-white">
              Prints only the bill — on 58 mm or 80 mm thermal printers or A4 — with batch, expiry and BS date.
            </FeatureCard>

            <FeatureCard n="20" title="Low-Stock Alerts" kind="stock" tint="from-[#e0e7ff] via-[#eef2ff] to-white">
              Set a reorder level for each medicine and see what is running out before the shelf is empty.
            </FeatureCard>

            <FeatureCard n="21" title="Correct Stock" kind="stock" tint="from-[#fce7f3] via-[#fdf2f8] to-white">
              Broken, lost or expired boxes? Set the real counted number with a reason — it is written in the history.
            </FeatureCard>

            <FeatureCard n="22" title="Excel Download" kind="sales" tint="from-[#dcfce7] via-[#f0fdf4] to-white">
              Download sales, medicines sold and the full stock list to Excel for your accountant.
            </FeatureCard>

            <FeatureCard n="23" title="VAT & Feature Settings" kind="settings" tint="from-[#fef3c7] via-[#fffbeb] to-white">
              Turn VAT on or off and set the rate once. Allow or stop due bills for your pharmacy.
            </FeatureCard>

            <FeatureCard n="24" title="Works on Any Device" kind="dashboard" tint="from-[#e0f2fe] via-[#f0f9ff] to-white">
              Use it in the browser on computers, tablets and phones — nothing to install.
            </FeatureCard>
          </div>
        </section>

        {/* ==== Everything else ==== */}
        <section id="more-features" className="mb-28 scroll-mt-32">
          <SectionHeading eyebrow="And much more" title={`Everything else built into ${BRAND}`} subtitle="No extra apps to buy — all of this is included." />

          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-purple-700">Billing &amp; payments</p>
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MiniFeature icon={QrCode} title="Payment QR with the bill amount" tag="New">
              eSewa, Khalti and Fonepay QR shown with the exact amount — no typing mistakes.
            </MiniFeature>
            <MiniFeature icon={Wallet} title="Every payment method">
              Cash, eSewa, Khalti, Fonepay, bank or card — or Due (udharo) for regular customers.
            </MiniFeature>
            <MiniFeature icon={Percent} title="Discount & VAT">
              Discount in rupees or percent. VAT set once in Settings and added to every bill.
            </MiniFeature>
            <MiniFeature icon={Printer} title="Thermal & A4 printing">
              58 mm, 80 mm or A4 — only the bill prints, never the whole screen.
            </MiniFeature>
            <MiniFeature icon={FileX2} title="Safe bill cancel">
              Bills are never deleted. Cancelled with a reason and a credit note, stock returns.
            </MiniFeature>
            <MiniFeature icon={Sunrise} title="Nepali dates & fiscal year">
              Bill numbers restart every fiscal year, with Nepali (BS) dates on every bill.
            </MiniFeature>
          </div>

          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-purple-700">Stock &amp; expiry</p>
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MiniFeature icon={CalendarClock} title="Expiry alerts">
              Expiring in 30, 60 or 90 days — you choose. Expired medicine cannot be billed.
            </MiniFeature>
            <MiniFeature icon={PackagePlus} title="One-step restock" tag="New">
              New boxes with batch, expiry and cost in one step — no need to re-create the medicine.
            </MiniFeature>
            <MiniFeature icon={Barcode} title="Barcode scanning">
              Scan a box at the counter and it is on the bill. Works with any USB barcode scanner.
            </MiniFeature>
            <MiniFeature icon={History} title="Stock history">
              Every sale, restock, cancelled bill and correction, with who did it and when.
            </MiniFeature>
            <MiniFeature icon={Truck} title="Suppliers">
              Distributor contacts, PAN and notes — picked when you restock.
            </MiniFeature>
            <MiniFeature icon={BellRing} title="Low-stock warnings">
              A reorder level for every medicine, shown on the dashboard and stock page.
            </MiniFeature>
          </div>

          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-purple-700">Patients, team &amp; safety</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MiniFeature icon={Users} title="Patient records">
              Name, phone, allergies and long-term illness — the allergy shows at billing.
            </MiniFeature>
            <MiniFeature icon={Stethoscope} title="Medical records (EMR)">
              Visits, vitals, diagnosis, prescriptions and follow-up dates for each patient.
            </MiniFeature>
            <MiniFeature icon={Fingerprint} title="Fingerprint attendance">
              Staff check in and out with a fingerprint machine. Late, overtime and Excel reports.
            </MiniFeature>
            <MiniFeature icon={ShieldAlert} title="Role-based access">
              Each person sees only their pages. Only managers cancel bills and change settings.
            </MiniFeature>
            <MiniFeature icon={LockKeyhole} title="Secure by design">
              Encrypted passwords, and every pharmacy sees only its own data.
            </MiniFeature>
            <MiniFeature icon={Smartphone} title="Any device">
              Computers, tablets and phones — open it in the browser and start billing.
            </MiniFeature>
          </div>
        </section>

        {/* ==== Pricing ==== */}
        <section id="pricing" className="mb-28 scroll-mt-32">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple pricing, built to scale with you"
            subtitle={
              <>
                Try it risk-free, then pick the plan that fits. <span className="font-semibold text-purple-600">Paid plans are shown excluding VAT.</span>
              </>
            }
          />

          {FESTIVE_OFFER && (
            <div className="mb-10 flex items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-linear-to-r from-orange-50 via-rose-50 to-pink-50 px-5 py-3 text-center text-sm font-black text-rose-600">
              <span className="animate-bounce">🎊</span>
              Festive Offer is live. Get Premium at a special discounted price for a limited time.
              <span className="animate-bounce">🎊</span>
            </div>
          )}

          <div className="grid items-stretch gap-6 lg:grid-cols-3">
            {/* ---------- Plan 1: Demo ---------- */}
            <div className="relative flex flex-col rounded-3xl border border-slate-100 bg-white p-7 shadow-[0_4px_24px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-[0_16px_36px_-12px_rgba(147,51,234,0.18)] lg:p-8">
              <span className="absolute -top-3.5 left-7 rounded-full border border-purple-200 bg-white px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-purple-700 shadow-md">
                30-Day Trial
              </span>
              <p className="relative mb-5 mt-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Demo</p>
              <div className="relative mb-1 flex flex-wrap items-end gap-2">
                <span className="text-3xl font-black leading-none tracking-tight text-[#1e003a] lg:text-4xl">Free</span>
              </div>
              <div className="relative mb-6 flex min-h-[24px] flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400">30-day trial</span>
              </div>
              <p className="relative mb-6 text-sm font-medium leading-relaxed text-slate-500">
                Full access to every feature so you can test it at your counter before you commit.
              </p>
              <div className="relative mb-6 h-px bg-slate-100" />
              <ul className="relative mb-8 flex-1 space-y-3">
                <PlanItem>All features unlocked</PlanItem>
                <PlanItem>Live Pharmacy Dashboard</PlanItem>
                <PlanItem>Total Sales, Profit &amp; Excel</PlanItem>
                <PlanItem>Due (Udharo) Bills</PlanItem>
                <PlanItem>Fast Billing with Barcode</PlanItem>
                <PlanItem>Batch &amp; Expiry Tracking</PlanItem>
                <PlanItem>Expiry &amp; Low-Stock Alerts</PlanItem>
                <PlanItem>Restock &amp; Stock History</PlanItem>
                <PlanItem>eSewa · Khalti · Fonepay QR</PlanItem>
                <PlanItem>Patients &amp; Medical Records</PlanItem>
                <PlanItem>Suppliers</PlanItem>
                <PlanItem>Role-Based Staff Management</PlanItem>
                <PlanItem>Fingerprint Attendance</PlanItem>
                <PlanItem>Thermal &amp; A4 Bill Printing</PlanItem>
              </ul>
              <a
                href={wa(`Hello, I'm interested in the "Demo" plan for ${BRAND}. Could you please provide the details and help me get started?`)}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-6 py-3.5 text-sm font-black text-purple-700 transition-all hover:border-transparent hover:bg-linear-to-r hover:from-purple-600 hover:to-indigo-600 hover:text-white active:scale-[0.98]"
              >
                Start Free Demo
                <ArrowRight />
              </a>
            </div>

            {/* ---------- Plan 2: Premium (dark, highlighted) ---------- */}
            <div className="relative flex flex-col rounded-3xl border border-purple-400/30 bg-linear-to-br from-[#1e003a] via-[#2d0a52] to-[#3b1266] p-7 shadow-2xl shadow-purple-950/25 transition-all duration-300 lg:-translate-y-3 lg:p-8">
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl" />

              {FESTIVE_OFFER && (
                <span className="absolute -top-3.5 right-7 z-10 inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-orange-500 via-rose-500 to-pink-500 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-rose-500/40">
                  <span className="animate-pulse">🎉</span>
                  Festive Offer
                </span>
              )}
              <span className="absolute -top-3.5 left-7 rounded-full bg-[#a3e635] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#1e003a] shadow-md">
                Top Choice
              </span>

              <p className="relative mb-5 mt-3 text-[11px] font-black uppercase tracking-[0.2em] text-purple-300">Premium</p>
              <div className="relative mb-1 flex flex-wrap items-end gap-2">
                {FESTIVE_OFFER && <span className="text-base font-bold text-white/40 line-through decoration-2">{PRICE_PREMIUM_OLD}</span>}
                <span className="text-3xl font-black leading-none tracking-tight text-white lg:text-4xl">{PRICE_PREMIUM}</span>
              </div>
              <div className="relative mb-6 flex min-h-[24px] flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-purple-200">/ year</span>
                <span className="rounded-md border border-purple-400/20 bg-purple-500/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-purple-200">
                  Excluding 13% VAT
                </span>
              </div>

              <p className="relative mb-6 text-sm font-medium leading-relaxed text-purple-100/90">
                Everything a busy pharmacy or medical store needs to run at full speed.
              </p>
              <div className="relative mb-6 h-px bg-white/10" />
              <ul className="relative mb-8 flex-1 space-y-3">
                <PlanItem dark>Unlimited staff accounts</PlanItem>
                <PlanItem dark>Live Pharmacy Dashboard</PlanItem>
                <PlanItem dark>Total Sales, Profit &amp; Excel</PlanItem>
                <PlanItem dark>Due (Udharo) Bills</PlanItem>
                <PlanItem dark>Fast Billing with Barcode</PlanItem>
                <PlanItem dark>Batch &amp; Expiry Tracking</PlanItem>
                <PlanItem dark>Expiry &amp; Low-Stock Alerts</PlanItem>
                <PlanItem dark>Restock &amp; Stock History</PlanItem>
                <PlanItem dark>eSewa · Khalti · Fonepay QR</PlanItem>
                <PlanItem dark>Patients &amp; Medical Records</PlanItem>
                <PlanItem dark>Suppliers</PlanItem>
                <PlanItem dark>Role-Based Staff Management</PlanItem>
                <PlanItem dark>Fingerprint Attendance</PlanItem>
                <PlanItem dark>Thermal &amp; A4 Bill Printing</PlanItem>
                <PlanItem dark>Priority support</PlanItem>
              </ul>
              <a
                href={wa(`Hello, I'm interested in the "Premium" plan for ${BRAND}. Could you please provide the details and help me get started?`)}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-black text-[#3c2f80] shadow-lg shadow-black/20 transition-all hover:bg-slate-100 active:scale-[0.98]"
              >
                Upgrade to Premium
                <ArrowRight />
              </a>
            </div>

            {/* ---------- Plan 3: Enterprise ---------- */}
            <div className="relative flex flex-col rounded-3xl border border-slate-100 bg-white p-7 shadow-[0_4px_24px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-[0_16px_36px_-12px_rgba(147,51,234,0.18)] lg:p-8">
              <span className="absolute -top-3.5 left-7 rounded-full border border-purple-200 bg-white px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-purple-700 shadow-md">
                Chains &amp; Hospitals
              </span>
              <p className="relative mb-5 mt-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Enterprise</p>
              <div className="relative mb-1 flex flex-wrap items-end gap-2">
                <span className="text-base font-bold text-slate-400 line-through decoration-2">Tailored Quote</span>
                <span className="text-3xl font-black leading-none tracking-tight text-[#1e003a] lg:text-4xl">Custom</span>
              </div>
              <div className="relative mb-6 flex min-h-[24px] flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400">/ custom billing</span>
                <span className="rounded-md border border-slate-200/60 bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Excluding 13% VAT
                </span>
              </div>
              <p className="relative mb-6 text-sm font-medium leading-relaxed text-slate-500">
                Custom solutions for pharmacy chains, hospital pharmacies and wholesalers that need more.
              </p>
              <div className="relative mb-6 h-px bg-slate-100" />
              <ul className="relative mb-8 flex-1 space-y-3">
                <PlanItem>Everything in Premium, plus:</PlanItem>
                <PlanItem>Multi-Branch Management</PlanItem>
                <PlanItem>Central Stock &amp; Transfers</PlanItem>
                <PlanItem>Custom Reports</PlanItem>
                <PlanItem>Accounting Integrations</PlanItem>
                <PlanItem>Dedicated Account Manager</PlanItem>
                <PlanItem>Priority Phone Support</PlanItem>
                <PlanItem>On-site Staff Training</PlanItem>
              </ul>
              <a
                href={wa(`Hello, I'm interested in a custom Enterprise version of ${BRAND}. Could you please discuss the available options and pricing?`)}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-6 py-3.5 text-sm font-black text-purple-700 transition-all hover:border-transparent hover:bg-linear-to-r hover:from-purple-600 hover:to-indigo-600 hover:text-white active:scale-[0.98]"
              >
                Contact Enterprise Sales
                <ArrowRight />
              </a>
            </div>
          </div>
        </section>

        {/* ==== Why It Works ==== */}
        <section id="why-it-works" className="relative mb-28 scroll-mt-32">
          <div className="pointer-events-none absolute -top-12 left-1/2 -z-10 h-96 w-3/4 -translate-x-1/2 rounded-full bg-linear-to-b from-purple-200/40 via-purple-100/20 to-transparent blur-3xl" />

          <SectionHeading center eyebrow="Why it works" title="Engineered for speed, built for complete control" subtitle={`See how ${BRAND} keeps the counter moving, even at the busiest hours.`} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
            {/* Fast */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-purple-100 bg-linear-to-br from-white via-purple-50/40 to-purple-100/50 p-8 shadow-[0_10px_30px_rgba(147,51,234,0.05)] transition-all duration-300 hover:border-purple-300 hover:shadow-[0_20px_40px_rgba(147,51,234,0.12)] lg:col-span-7">
              <div className="relative z-10 mb-8 max-w-md">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 transition-transform group-hover:scale-110">
                  <BoltIcon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-2xl font-black text-slate-900">Fast and reliable</h3>
                <p className="text-sm font-medium leading-relaxed text-slate-600">
                  A bill in seconds, stock updated instantly, and every counter sees the same numbers.
                </p>
              </div>
              <div className="relative z-10 rounded-2xl border border-purple-100/80 bg-white/90 p-5 shadow-md backdrop-blur-md">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Stock update</span>
                  </div>
                  <span className="rounded-md border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-black text-purple-700">Instant</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-[92%] rounded-full bg-linear-to-r from-purple-500 to-indigo-500 transition-all duration-1000 group-hover:w-full" />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>Every counter updated</span>
                  <span>Every change saved</span>
                </div>
              </div>
              <div className="pointer-events-none absolute -bottom-12 -right-12 h-64 w-64 rounded-full bg-purple-300/20 blur-3xl" />
            </div>

            {/* Secure */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-[0_10px_30px_rgba(15,23,42,0.03)] transition-all duration-300 hover:border-purple-300 hover:shadow-[0_20px_40px_rgba(147,51,234,0.12)] lg:col-span-5">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 text-purple-600 transition-all group-hover:bg-purple-600 group-hover:text-white">
                  <LockIcon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-black text-slate-900">Role-based security</h3>
                <p className="mb-6 text-sm font-medium leading-relaxed text-slate-500">
                  Each person sees only what they need, which protects your money, stock and patient records.
                </p>
              </div>
              <div className="space-y-2.5 rounded-2xl border border-purple-100/60 bg-purple-50/50 p-4">
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3.5 py-2 text-xs font-bold shadow-xs">
                  <span className="text-slate-700">Manager / Owner</span>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-600">Full access</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/70 px-3.5 py-2 text-xs font-bold text-slate-500">
                  <span>Staff</span>
                  <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-black uppercase text-purple-600">Their pages only</span>
                </div>
              </div>
            </div>

            {/* Live */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-[0_10px_30px_rgba(15,23,42,0.03)] transition-all duration-300 hover:border-purple-300 hover:shadow-[0_20px_40px_rgba(147,51,234,0.12)] lg:col-span-5">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 text-purple-600 transition-all group-hover:bg-purple-600 group-hover:text-white">
                  <ChartIcon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-black text-slate-900">Live numbers, anywhere</h3>
                <p className="mb-6 text-sm font-medium leading-relaxed text-slate-500">
                  Check today’s sales, profit and dues from any device, without waiting for a report.
                </p>
              </div>
              <div className="rounded-2xl bg-linear-to-r from-purple-700 to-indigo-700 p-4 text-white shadow-lg">
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-purple-200">Today</div>
                <div className="flex items-center justify-between text-2xl font-black tracking-tight">
                  <span>NPR 48.2k</span>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/20 px-2 py-0.5 text-xs font-bold text-emerald-200">+18.4%</span>
                </div>
              </div>
            </div>

            {/* Expiry */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-100 bg-linear-to-br from-white via-purple-50/30 to-white p-8 shadow-[0_10px_30px_rgba(15,23,42,0.03)] transition-all duration-300 hover:border-purple-300 hover:shadow-[0_20px_40px_rgba(147,51,234,0.12)] lg:col-span-7">
              <div className="relative z-10 mb-6 max-w-md">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 text-purple-600 transition-all group-hover:bg-purple-600 group-hover:text-white">
                  <ScaleIcon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-2xl font-black text-slate-900">No expired medicine, no lost money</h3>
                <p className="text-sm font-medium leading-relaxed text-slate-500">
                  Know what to sell first, what to return to the supplier and what to reorder — before it costs you.
                </p>
              </div>
              <div className="relative z-10 grid gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-white p-3 shadow-xs">
                  <span className="h-3 w-3 rounded-full bg-rose-500" />
                  <div>
                    <div className="text-xs font-black text-slate-800">Expired</div>
                    <div className="text-[10px] font-bold text-rose-600">Blocked at billing</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-white p-3 shadow-xs">
                  <span className="h-3 w-3 rounded-full bg-amber-500" />
                  <div>
                    <div className="text-xs font-black text-slate-800">Expiring</div>
                    <div className="text-[10px] font-bold text-amber-600">Sell first</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-white p-3 shadow-xs">
                  <span className="h-3 w-3 rounded-full bg-purple-600" />
                  <div>
                    <div className="text-xs font-black text-slate-800">Low stock</div>
                    <div className="text-[10px] font-bold text-purple-600">Reorder now</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==== Get started ==== */}
        <section
          id="get-started"
          className="relative overflow-hidden rounded-[32px] border border-purple-500/30 bg-linear-to-br from-[#1e003a] via-[#2d0a52] to-[#3b1266] p-8 shadow-2xl shadow-purple-950/30 sm:p-12 lg:p-16"
        >
          <div className="pointer-events-none absolute right-0 top-0 -mr-12 -mt-12 h-96 w-96 rounded-full bg-[#9333EA]/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 -mb-12 -ml-12 h-96 w-96 rounded-full bg-[#a3e635]/10 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '26px 26px' }}
          />

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-[#a3e635] backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#a3e635]" />
              Start risk-free today
            </span>

            <h2 className="mb-4 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">Ready to make work easier?</h2>

            <p className="mb-8 max-w-xl text-sm font-medium leading-relaxed text-purple-100/80 sm:text-base lg:text-lg">
              Start with <span className="font-black text-white underline decoration-purple-400 decoration-2 underline-offset-4">{BRAND}</span> today and make billing and stock easier for your team.
            </p>

            <div className="mb-8 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
              <button
                onClick={onLogin}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-black text-[#1e003a] shadow-xl shadow-black/20 transition-all duration-300 hover:scale-[1.02] hover:bg-slate-100 active:scale-[0.98] sm:w-auto"
              >
                Start your 30 day trial
                <ArrowRight />
              </button>
              <a
                href={`mailto:${EMAIL}?subject=${encodeURIComponent(`Live demo request: ${BRAND}`)}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-8 py-4 text-sm font-bold text-white backdrop-blur-md transition-all duration-300 hover:bg-white/15 sm:w-auto"
              >
                <MailIcon />
                Book a live demo
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-purple-200/90">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-[#a3e635]" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-[#a3e635]" />
                <span>Quick setup</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-[#a3e635]" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ==== Footer ==== */}
      <footer className="border-t border-purple-100 bg-[#fbf8ff]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs font-semibold text-slate-500 sm:flex-row lg:px-8">
          <span>© {new Date().getFullYear()} {COMPANY} — {BRAND}</span>
          <div className="flex items-center gap-4">
            <a href={`mailto:${EMAIL}`} className="hover:text-purple-700">{EMAIL}</a>
            {WEBSITE && (
              <a href={`https://${WEBSITE}`} target="_blank" rel="noopener noreferrer" className="hover:text-purple-700">{WEBSITE}</a>
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}
