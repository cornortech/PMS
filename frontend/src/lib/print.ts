// =====================================================================
// 🖨️ BILL PRINTING (fixed)
// Before: window.print() printed the WHOLE screen (sidebar, buttons, popup).
// Now: the bill is drawn on its own hidden page in the right size
// (58 mm / 80 mm thermal roll, or A4) and only that page is printed.
// =====================================================================
import type { Sale, Settings } from './types';
import type { PharmacyUser } from './api';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (n: number) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (d: string) =>
  new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
const exp = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'UTC', month: '2-digit', year: '2-digit' }) : '';

export function buildBillHtml(sale: Sale, pharmacy: PharmacyUser | null, settings: Pick<Settings, 'printSize' | 'billFooter'>) {
  const size = settings.printSize || '80mm';
  const thermal = size !== 'A4';
  const pageWidth = size === '58mm' ? '58mm' : size === '80mm' ? '80mm' : '210mm';
  const bodyWidth = size === '58mm' ? '48mm' : size === '80mm' ? '72mm' : '180mm';
  const base = size === '58mm' ? 10 : size === '80mm' ? 11.5 : 12.5;

  const rows = sale.items
    .map(
      (i) => `
      <tr>
        <td class="item">${esc(i.name)}${i.dosage && !String(i.name).replace(/\s/g, '').toLowerCase().includes(String(i.dosage).replace(/\s/g, '').toLowerCase()) ? ` <span class="muted">${esc(i.dosage)}</span>` : ''}
          ${i.batchNo || i.expiryDate ? `<div class="muted small">${i.batchNo ? `B: ${esc(i.batchNo)}` : ''}${i.batchNo && i.expiryDate ? ' · ' : ''}${i.expiryDate ? `Exp: ${esc(exp(i.expiryDate))}` : ''}</div>` : ''}
        </td>
        <td class="num">${i.quantity}</td>
        ${thermal ? '' : `<td class="num">${money(i.unitPrice)}</td>`}
        <td class="num">${money(i.total)}</td>
      </tr>`
    )
    .join('');

  const status =
    sale.status === 'cancelled'
      ? `<div class="stamp void">CANCELLED${sale.creditNoteNo ? ` · ${esc(sale.creditNoteNo)}` : ''}</div>`
      : sale.status === 'pending'
      ? `<div class="stamp due">DUE — NOT PAID</div>`
      : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Bill ${esc(sale.invoiceNo)}</title>
<style>
  @page { size: ${thermal ? `${pageWidth} auto` : 'A4'}; margin: ${thermal ? '3mm 2mm' : '14mm'}; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ${thermal ? "'Courier New', ui-monospace, monospace" : "Arial, Helvetica, sans-serif"}; font-size: ${base}px; color: #000; }
  .bill { width: ${bodyWidth}; margin: 0 auto; }
  h1 { font-size: ${base + 4}px; margin: 0; text-align: center; text-transform: uppercase; letter-spacing: .3px; }
  .center { text-align: center; }
  .muted { color: #333; }
  .small { font-size: ${base - 1.5}px; }
  .title { text-align: center; font-weight: 700; margin: 6px 0; padding: 3px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; letter-spacing: 1px; }
  .meta { display: flex; justify-content: space-between; gap: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: inherit; }
  th { text-align: left; border-bottom: 1px dashed #000; padding: 2px 0; font-size: ${base - 1}px; }
  td { padding: 3px 0; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; padding-left: 8px; }
  th.num { text-align: right; }
  .totals { margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px; }
  .totals div { display: flex; justify-content: space-between; padding: 1px 0; }
  .grand { font-weight: 700; font-size: ${base + 2}px; border-top: 1px solid #000; margin-top: 3px; padding-top: 3px !important; }
  .stamp { margin: 6px 0; text-align: center; font-weight: 700; border: 2px solid #000; padding: 3px; letter-spacing: 1px; }
  .foot { margin-top: 10px; text-align: center; border-top: 1px dashed #000; padding-top: 6px; }
  ${thermal ? '' : `.bill { border: 1px solid #ccc; padding: 18px; } .sign { display:flex; justify-content:space-between; margin-top: 40px; } .sign span { border-top: 1px solid #000; padding-top: 3px; width: 40%; text-align: center; }`}
</style></head><body><div class="bill">
  <h1>${esc(pharmacy?.pharmacyName || 'Pharmacy')}</h1>
  ${pharmacy?.location ? `<div class="center">${esc(pharmacy.location)}</div>` : ''}
  ${pharmacy?.phone ? `<div class="center">Tel: ${esc(pharmacy.phone)}</div>` : ''}
  ${pharmacy?.PanOrVat ? `<div class="center">PAN/VAT: ${esc(pharmacy.PanOrVat)}</div>` : ''}
  <div class="title">${sale.vatAmount > 0 ? 'TAX INVOICE' : 'INVOICE'}</div>
  <div class="meta"><span>Bill: <b>${esc(sale.invoiceNo)}</b></span></div>
  <div class="meta"><span>${esc(when(sale.createdAt))}</span>${sale.dateBS ? `<span>BS ${esc(sale.dateBS)}</span>` : ''}</div>
  <div>Name: ${esc(sale.customerName || 'Walk-in Customer')}</div>
  ${sale.customerPhone ? `<div>Phone: ${esc(sale.customerPhone)}</div>` : ''}
  ${status}
  <table>
    <thead><tr><th>Item</th><th class="num">Qty</th>${thermal ? '' : '<th class="num">Rate</th>'}<th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Sub total</span><span>${money(sale.subTotal)}</span></div>
    ${sale.discount > 0 ? `<div><span>Discount</span><span>-${money(sale.discount)}</span></div>` : ''}
    ${sale.vatAmount > 0 ? `<div><span>Taxable</span><span>${money(sale.taxableAmount)}</span></div><div><span>VAT ${sale.vatRate}%</span><span>${money(sale.vatAmount)}</span></div>` : ''}
    <div class="grand"><span>TOTAL Rs</span><span>${money(sale.grandTotal)}</span></div>
    <div><span>Payment</span><span>${esc(sale.status === 'pending' ? 'Due (not paid)' : sale.paymentMethod)}</span></div>
  </div>
  ${sale.note ? `<div class="small" style="margin-top:4px">Note: ${esc(sale.note)}</div>` : ''}
  ${thermal ? '' : '<div class="sign"><span>Customer</span><span>Authorised signature</span></div>'}
  <div class="foot">${esc(settings.billFooter || 'Thank you!')}${sale.soldBy ? `<div class="small muted">Billed by: ${esc(sale.soldBy)}</div>` : ''}</div>
</div></body></html>`;
}

/** Prints only the bill. Works on desktop and mobile browsers. */
export function printBill(sale: Sale, pharmacy: PharmacyUser | null, settings: Pick<Settings, 'printSize' | 'billFooter'>) {
  printHtml(buildBillHtml(sale, pharmacy, settings));
}

/** Prints any ready-made HTML page on its own (hidden frame), never the whole screen. */
export function printHtml(html: string) {
  const old = document.getElementById('argya-print-frame');
  if (old) old.remove();

  const frame = document.createElement('iframe');
  frame.id = 'argya-print-frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);

  const doc = frame.contentWindow!.document;
  doc.open();
  doc.write(html);
  doc.close();

  const go = () => {
    try {
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
    } catch {
      // Very old browsers: open it in a new tab instead
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.print(); }
    }
    setTimeout(() => frame.remove(), 60000);
  };
  // Wait a moment so fonts/layout are ready before printing
  setTimeout(go, 250);
}

/**
 * 🧾 A4 report (day sales summary, VAT sales register …)
 * head = column titles, rows = table rows, totals = label/value lines under the table.
 * Columns listed in `numCols` are right-aligned.
 */
export function printReport(opts: {
  title: string;
  subtitle?: string;
  pharmacy: PharmacyUser | null;
  head: string[];
  rows: (string | number)[][];
  numCols?: number[];
  totals?: [string, string][];
  landscape?: boolean;
}) {
  const num = new Set(opts.numCols || []);
  const th = opts.head.map((h, i) => `<th class="${num.has(i) ? 'num' : ''}">${esc(h)}</th>`).join('');
  const body = opts.rows.length
    ? opts.rows.map((r) => `<tr>${r.map((c, i) => `<td class="${num.has(i) ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${opts.head.length}" style="text-align:center;padding:14px;color:#666">No records</td></tr>`;
  const totals = (opts.totals || []).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  const printed = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
<style>
  @page { size: A4 ${opts.landscape ? 'landscape' : 'portrait'}; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  h1 { margin: 0; font-size: 18px; text-transform: uppercase; }
  h2 { margin: 2px 0 0; font-size: 13px; color: #6b21a8; }
  .muted { color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3e8ff; text-align: left; padding: 6px; border: 1px solid #ccc; font-size: 10px; text-transform: uppercase; }
  td { padding: 5px 6px; border: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  .num { text-align: right; white-space: nowrap; }
  .totals { margin: 12px 0 0 auto; width: 320px; border: 1px solid #ccc; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 8px; border-bottom: 1px solid #eee; }
  .sign { display: flex; justify-content: space-between; margin-top: 50px; }
  .sign span { border-top: 1px solid #000; padding-top: 3px; width: 35%; text-align: center; }
</style></head><body>
  <div class="top">
    <div>
      <h1>${esc(opts.pharmacy?.pharmacyName || 'Pharmacy')}</h1>
      <div class="muted">${esc([opts.pharmacy?.location, opts.pharmacy?.phone && `Tel: ${opts.pharmacy.phone}`, opts.pharmacy?.PanOrVat && `PAN/VAT: ${opts.pharmacy.PanOrVat}`].filter(Boolean).join(' · '))}</div>
      <h2>${esc(opts.title)}</h2>
      ${opts.subtitle ? `<div class="muted">${esc(opts.subtitle)}</div>` : ''}
    </div>
    <div class="muted" style="text-align:right">Printed ${esc(printed)}</div>
  </div>
  <table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>
  ${totals ? `<div class="totals">${totals}</div>` : ''}
  <div class="sign"><span>Prepared by</span><span>Checked by</span></div>
</body></html>`);
}
