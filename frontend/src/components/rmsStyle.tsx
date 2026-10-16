// Shared look from Atithi RMS: animations, soft purple background glow and class recipes
import React from 'react';

export const FOCUS_RING = 'outline-none focus-visible:ring-4 focus-visible:ring-purple-500/25 focus-visible:ring-offset-0';
export const GRADIENT_BTN =
  'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200';
export const GLASS_PANEL = 'bg-white/80 backdrop-blur-xl border border-purple-100/80 shadow-xl shadow-purple-950/5';

export function GlobalStyles() {
  return (
    <style>{`
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes popIn { from { opacity: 0; transform: scale(.96) translateY(10px); } to { opacity: 1; transform: none; } }
      @keyframes spinSlow { to { transform: rotate(360deg); } }
      @keyframes floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      @keyframes progressBar { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }
      @keyframes blobMove { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(24px,-30px) scale(1.1); } }
      @keyframes pulseRing { 0% { transform: scale(.9); opacity: .55; } 100% { transform: scale(1.7); opacity: 0; } }
      @keyframes textSwap { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

      .anim-fade-up { animation: fadeUp .45s cubic-bezier(.22,1,.36,1) both; }
      .anim-fade-in { animation: fadeIn .25s ease-out both; }
      .anim-pop { animation: popIn .32s cubic-bezier(.22,1,.36,1) both; }
      .anim-spin-slow { animation: spinSlow 1.4s linear infinite; }
      .anim-floaty { animation: floaty 3s ease-in-out infinite; }
      .anim-progress { animation: progressBar 1.4s ease-in-out infinite; }
      .anim-blob { animation: blobMove 12s ease-in-out infinite; }
      .anim-pulse-ring { animation: pulseRing 1.8s ease-out infinite; }
      .anim-text-swap { animation: textSwap .4s ease-out both; }
      .anim-shimmer {
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
        background-size: 200% 100%;
        animation: shimmer 2.4s ease-in-out infinite;
      }
      .thin-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .thin-scroll::-webkit-scrollbar-track { background: transparent; }
      .thin-scroll::-webkit-scrollbar-thumb { background: #e9d5ff; border-radius: 999px; }
      .thin-scroll::-webkit-scrollbar-thumb:hover { background: #c084fc; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
      }
    `}</style>
  );
}

/** Soft purple glow behind the screen. Only decoration. */
export function AmbientBackdrop({ intensity = 'normal' }: { intensity?: 'normal' | 'soft' }) {
  const o = intensity === 'soft' ? 'opacity-60' : 'opacity-100';
  return (
    <div aria-hidden="true" className={`pointer-events-none fixed inset-0 -z-0 overflow-hidden ${o}`}>
      <div className="anim-blob absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-purple-300/30 blur-3xl" />
      <div className="anim-blob absolute -bottom-48 -right-40 h-[32rem] w-[32rem] rounded-full bg-violet-300/25 blur-3xl" style={{ animationDelay: '-5s' }} />
      <div className="anim-blob absolute left-1/2 top-1/3 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" style={{ animationDelay: '-2s' }} />
    </div>
  );
}

/** Big logo for the login card: your /logo.png, or the Argya Health name until you add it */
export function BigLogo() {
  const [broken, setBroken] = React.useState(false);
  if (!broken) {
    return <img src="/logo.png" alt="Argya Health" className="block h-48 w-auto rounded-t-2xl object-contain" onError={() => setBroken(true)} />;
  }
  return (
    <div className="flex items-center gap-3 py-10">
      <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
        <defs>
          <linearGradient id="bl-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9333ea" />
            <stop offset="1" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill="url(#bl-g)" />
        <rect x="26" y="12" width="12" height="40" rx="4" fill="#fff" />
        <rect x="12" y="26" width="40" height="12" rx="4" fill="#fff" />
      </svg>
      <div className="text-left">
        <p className="text-3xl font-black leading-none tracking-tight text-purple-700">
          ARGYA <span className="font-semibold">HEALTH</span>
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-purple-500">Pharmacy Management System</p>
      </div>
    </div>
  );
}
