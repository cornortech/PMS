// 📅 Subscription plan card (days remaining) — same as Atithi RMS
import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Clock } from 'lucide-react';

export default function SubscriptionCard({
  loading,
  total,
  remaining,
  pharmacyId = '',
}: {
  loading: boolean;
  total: number | null;
  remaining: number | null;
  pharmacyId?: string;
}) {
  const [showModal, setShowModal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const safeTotal = total && total > 0 ? total : 0;
  const safeRemaining = remaining !== null && remaining !== undefined ? Math.max(0, remaining) : 0;
  const pct = safeTotal > 0 ? Math.min(100, (safeRemaining / safeTotal) * 100) : 0;

  const status =
    safeTotal === 0
      ? {
          bg: 'from-slate-100 via-white to-white',
          border: 'border-slate-200/70',
          bar: 'bg-slate-300',
          text: 'text-slate-500',
          chip: 'bg-slate-100 text-slate-600',
          iconBg: 'text-slate-500',
          label: '',
          isCritical: false,
          isWarning: false,
          isActive: false,
        }
      : safeRemaining <= 0
      ? {
          bg: 'from-rose-50 via-rose-50/20 to-white',
          border: 'border-rose-300 shadow-rose-100 animate-pulse',
          bar: 'bg-rose-600',
          text: 'text-rose-700',
          chip: 'bg-rose-100 text-rose-800 font-extrabold border border-rose-200',
          iconBg: 'text-rose-600 bg-rose-50 ring-rose-200',
          label: "Subscription Expired",
          isCritical: true,
          isWarning: false,
          isActive: false,
        }
      : pct <= 15
      ? {
          bg: 'from-amber-50 via-amber-50/20 to-white',
          border: 'border-amber-300 shadow-amber-100',
          bar: 'bg-amber-500',
          text: 'text-amber-700',
          chip: 'bg-amber-100 text-amber-800 font-extrabold border border-amber-200',
          iconBg: 'text-amber-600 bg-amber-50 ring-amber-200',
          label: "Expiring Soon",
          isCritical: false,
          isWarning: true,
          isActive: false,
        }
      : {
          bg: 'from-emerald-50 via-emerald-50/10 to-white',
          border: 'border-emerald-200/80 shadow-emerald-50',
          bar: 'bg-emerald-600',
          text: 'text-emerald-700',
          chip: 'bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-200',
          iconBg: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
          label: "Active",
          isCritical: false,
          isWarning: false,
          isActive: true,
        };

  const handleCopyDetails = () => {
    navigator.clipboard.writeText(`Pharmacy ID: ${pharmacyId} - Plan: ${safeRemaining} of ${safeTotal} days left`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div
        id="subscription-time-card"
        className={`relative w-full overflow-hidden rounded-3xl border ${status.border} bg-gradient-to-r ${status.bg} p-5 shadow-lg sm:p-6 transition-all`}
      >
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-emerald-200/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-inset ${status.iconBg}`}>
              {status.isCritical || status.isWarning ? <AlertTriangle className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Subscription Plan</p>
                {!loading && status.label && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.chip}`}>
                    {status.isActive ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                    {status.label}
                  </span>
                )}
              </div>
              {loading ? (
                <div className="mt-1.5 h-8 w-44 animate-pulse rounded-md bg-slate-200/70" />
              ) : (
                <div className="flex items-baseline gap-2 mt-0.5">
                  <p className={`text-2xl font-extrabold tabular-nums sm:text-[28px] ${status.isCritical ? 'text-rose-700' : status.isWarning ? 'text-amber-700' : 'text-slate-900'}`}>
                    {safeRemaining}
                  </p>
                  <span className="text-base font-semibold text-slate-400">/ {safeTotal} days</span>
                </div>
              )}
            </div>
          </div>

          <div className="w-full sm:max-w-xs flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Days remaining</span>
              <span className={`tabular-nums ${status.text}`}>{loading ? '—' : `${Math.round(pct)}%`}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/70 ring-1 ring-inset ring-black/5">
              <div
                className={`h-full rounded-full ${status.bar} transition-all duration-700`}
                style={{ width: loading ? '0%' : `${pct}%` }}
              />
            </div>

            {/* Expired Warning & CTA */}
            {status.isCritical && !loading && (
              <div className="mt-2 space-y-2 rounded-2xl bg-rose-100/80 p-3 border border-rose-200 text-left">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-rose-900 leading-tight">
                  ⚠️ System will be deactivated any time. Please contact administrator to renew your plan.
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  Renew Subscription
                </button>
              </div>
            )}

            {/* Expiring Soon Warning & CTA */}
            {status.isWarning && !loading && (
              <div className="mt-2 space-y-2 rounded-2xl bg-amber-100/80 p-3 border border-amber-200 text-left">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-900 leading-tight">
                  ⚡ Your plan is expiring soon. Renew now to ensure uninterrupted service.
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  Renew Plan Early
                </button>
              </div>
            )}

            {/* Active / Healthy Plan Info Box & CTA */}
            {status.isActive && !loading && (
              <div className="mt-2 space-y-2 rounded-2xl bg-emerald-100/60 p-3 border border-emerald-200/80 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-900 leading-tight">
                  ✓ Your subscription is active and running smoothly. All systems operational.
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  View Plan Details
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Gorgeous Popup Modal (Positioned Higher up) */}
     {showModal &&
        createPortal(
          <div
            className="anim-fade-in fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="anim-pop w-full max-w-md space-y-5 rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-2xl"
            >
            
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl shadow-inner ${safeRemaining <= 0 ? 'bg-rose-100 text-rose-600' : pct <= 15 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {safeRemaining <= 0 || pct <= 15 ? <AlertTriangle className="h-8 w-8 animate-bounce" /> : <Clock className="h-8 w-8" />}
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {safeRemaining <= 0 ? "Plan Renewal Required" : pct <= 15 ? "Extend Your Subscription" : "Subscription Status Overview"}
              </h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed px-2">
                {safeRemaining <= 0 
                  ? "Your pharmacy's access has expired. To resume unhindered access and prevent system shutdown, please reach out to your system administrator."
                  : pct <= 15
                  ? "Your plan is running low on time. Renew early with your administrator to avoid any disruption at your pharmacy."
                  : "Your pharmacy subscription is fully verified and running smoothly. You have complete access to all pharmacy features."}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-left space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Pharmacy ID:</span>
                <span className="text-slate-900 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">{pharmacyId}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Time Status:</span>
                <span className={safeRemaining <= 0 ? "text-rose-600 uppercase" : pct <= 15 ? "text-amber-600 uppercase" : "text-emerald-700 uppercase"}>
                  {safeRemaining <= 0 ? "Expired (0 Days)" : `${safeRemaining} of ${safeTotal} Days Remaining`}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleCopyDetails}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
              >
                {copied ? "✓ Details Copied to Clipboard!" : "Copy Account Details"}
              </button>
              
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
}

