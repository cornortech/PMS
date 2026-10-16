// 🧾 One bill in a popup: see it, print it, receive payment (if due), cancel it (manager)
import React, { useState } from 'react';
import { Ban, CheckCircle2, HandCoins, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/app';
import { fmtDateTime, fmtExpiry, npr } from '../lib/format';
import { printBill } from '../lib/print';
import { PAID_METHODS, type Sale } from '../lib/types';
import { Badge, Button, Field, Modal, Textarea, useToast } from './ui';
import BillQR, { type WalletId } from './BillQR';

export function StatusBadge({ sale }: { sale: Sale }) {
  if (sale.status === 'cancelled') return <Badge tone="red">Cancelled</Badge>;
  if (sale.status === 'pending') return <Badge tone="amber">Due</Badge>;
  return <Badge tone="green">Paid · {sale.paymentMethod}</Badge>;
}

export function PayMethodPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PAID_METHODS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={value === m}
          className={`h-10 cursor-pointer rounded-xl border text-sm font-semibold transition ${
            value === m ? 'border-green bg-mint text-green-dark ring-2 ring-green/20' : 'border-foil bg-white text-ink/70 hover:border-ink/30'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export default function BillModal({
  sale,
  onClose,
  onChanged,
  justCreated = false,
}: {
  sale: Sale | null;
  onClose: () => void;
  onChanged?: (s: Sale) => void;
  justCreated?: boolean;
}) {
  const { pharmacy, settings, isManager, can } = useApp();
  const toast = useToast();
  const [mode, setMode] = useState<'view' | 'settle' | 'cancel'>('view');
  const [method, setMethod] = useState('Cash');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (!sale) return null;
  const close = () => {
    setMode('view');
    setReason('');
    onClose();
  };

  const settle = async () => {
    setBusy(true);
    const r = await api<Sale>(`/sales/${sale.id}/settle`, { method: 'PATCH', body: { paymentMethod: method } });
    setBusy(false);
    if (!r.ok) return toast(r.message, 'error');
    toast(r.message || 'Payment received.');
    setMode('view');
    onChanged?.(r.data);
  };

  const cancel = async () => {
    if (reason.trim().length < 3) return toast('Please write why this bill is cancelled.', 'error');
    setBusy(true);
    const r = await api<Sale>(`/sales/${sale.id}/cancel`, { method: 'POST', body: { reason: reason.trim() } });
    setBusy(false);
    if (!r.ok) return toast(r.message, 'error');
    toast(r.message || 'Bill cancelled.');
    setMode('view');
    setReason('');
    onChanged?.(r.data);
  };

  const footer =
    mode === 'settle' ? (
      <>
        <Button variant="secondary" onClick={() => setMode('view')} disabled={busy}>Back</Button>
        <Button onClick={settle} loading={busy} icon={<CheckCircle2 className="h-4 w-4" />}>Receive {npr(sale.grandTotal)}</Button>
      </>
    ) : mode === 'cancel' ? (
      <>
        <Button variant="secondary" onClick={() => setMode('view')} disabled={busy}>Back</Button>
        <Button variant="danger" onClick={cancel} loading={busy} icon={<Ban className="h-4 w-4" />}>Cancel this bill</Button>
      </>
    ) : (
      <>
        {!sale.legacy && isManager && sale.status !== 'cancelled' && (
          <Button variant="ghost" className="mr-auto !text-danger hover:bg-danger/5" onClick={() => setMode('cancel')} icon={<Ban className="h-4 w-4" />}>
            Cancel bill
          </Button>
        )}
        {sale.status === 'pending' && can('pending') && (
          <Button variant="secondary" onClick={() => setMode('settle')} icon={<HandCoins className="h-4 w-4" />}>Receive payment</Button>
        )}
        <Button onClick={() => printBill(sale, pharmacy, settings)} icon={<Printer className="h-4 w-4" />} data-autofocus>
          Print bill
        </Button>
      </>
    );

  return (
    <Modal
      open={!!sale}
      onClose={close}
      busy={busy}
      width="max-w-xl"
      title={justCreated ? (sale.status === 'pending' ? 'Saved as Due' : 'Sale complete') : `Bill ${sale.invoiceNo}`}
      subtitle={justCreated ? `Bill ${sale.invoiceNo} · ${fmtDateTime(sale.createdAt)}` : `${fmtDateTime(sale.createdAt)}${sale.dateBS ? ` · BS ${sale.dateBS}` : ''}${sale.legacy ? ' · old bill' : ''}`}
      footer={footer}
    >
      {justCreated && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-mint p-4">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-green" />
          <div>
            <p className="font-display text-2xl font-bold text-ink tabular">{npr(sale.grandTotal)}</p>
            <p className="text-xs text-ink/60">{sale.status === 'pending' ? `To be collected from ${sale.customerName}` : `Received by ${sale.paymentMethod}`}</p>
          </div>
        </div>
      )}

      {mode === 'settle' && (
        <div className="space-y-3">
          <p className="text-sm text-ink/70">
            <b>{sale.customerName}</b> is paying <b>{npr(sale.grandTotal)}</b> for bill {sale.invoiceNo}. How did they pay?
          </p>
          <PayMethodPicker value={method} onChange={setMethod} />
          {(method === 'eSewa' || method === 'Khalti' || method === 'Fonepay') && sale.grandTotal > 0 && (
            <div className="rounded-2xl border border-purple-100 bg-white p-4">
              <BillQR amount={Number(sale.grandTotal)} billNo={sale.invoiceNo} method={method as WalletId} />
            </div>
          )}
        </div>
      )}

      {mode === 'cancel' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-ink/75">
            The bill keeps its number and is marked <b>Cancelled</b> with a credit note (bills are never deleted). All medicines go back into stock.
          </div>
          <Field label="Why is it cancelled?" required>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Customer returned the medicine, wrong item billed" />
          </Field>
        </div>
      )}

      {mode === 'view' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">{sale.customerName}</p>
              {sale.customerPhone && <p className="text-xs text-ink/55">{sale.customerPhone}</p>}
            </div>
            <StatusBadge sale={sale} />
          </div>

          {sale.status === 'cancelled' && (
            <div className="rounded-xl bg-danger/5 p-3 text-xs text-danger">
              Cancelled {fmtDateTime(sale.cancelledAt)} {sale.creditNoteNo && <>· Credit note <b className="font-mono">{sale.creditNoteNo}</b></>}
              <br />Reason: {sale.cancelReason}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-foil/70">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-[11px] uppercase tracking-wide text-ink/50">
                <tr>
                  <th className="px-3 py-2 font-semibold">Medicine</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foil/50">
                {sale.items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink">{i.name}</p>
                      {(i.batchNo || i.expiryDate) && (
                        <p className="font-mono text-[10px] text-ink/45">
                          {i.batchNo && `B ${i.batchNo}`} {i.expiryDate && `· Exp ${fmtExpiry(String(i.expiryDate))}`}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular">{i.quantity}</td>
                    <td className="hidden px-3 py-2 text-right tabular text-ink/60 sm:table-cell">{npr(i.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular">{npr(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto max-w-xs space-y-1 text-sm">
            <Row label="Sub total" value={npr(sale.subTotal)} />
            {sale.discount > 0 && <Row label="Discount" value={`− ${npr(sale.discount)}`} />}
            {sale.vatAmount > 0 && <Row label={`VAT ${sale.vatRate}%`} value={npr(sale.vatAmount)} />}
            <div className="flex justify-between border-t border-foil pt-2 font-display text-lg font-bold">
              <dt>Total</dt>
              <dd className="tabular">{npr(sale.grandTotal)}</dd>
            </div>
            {isManager && !sale.legacy && sale.status !== 'cancelled' && <Row label="Profit" value={npr(sale.profit)} muted />}
          </dl>
          {(sale.note || sale.soldBy) && (
            <p className="text-xs text-ink/50">
              {sale.note && <>Note: {sale.note} · </>}
              {sale.soldBy && <>Billed by {sale.soldBy}</>}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-ink/45' : 'text-ink/70'}`}>
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
