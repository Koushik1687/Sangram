/* ==========================================================================
   invoice.js — dependency-free invoice generation.
   Opens a print-ready A4 invoice in a new window (the browser's print dialog
   offers "Save as PDF"), so the ₹ symbol and layout render perfectly without
   any PDF library.
   ========================================================================== */

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function two(n) {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '')
}
function three(n) {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return (h ? `${ONES[h]} Hundred${rest ? ' ' : ''}` : '') + (rest ? two(rest) : '')
}

/** Indian numbering: Rupees in words (supports up to crores). */
export function amountInWords(num) {
  const n = Math.round(Number(num) || 0)
  if (n === 0) return 'Zero Rupees Only'
  let remaining = n
  const parts = []
  const crore = Math.floor(remaining / 10000000); remaining %= 10000000
  const lakh = Math.floor(remaining / 100000); remaining %= 100000
  const thousand = Math.floor(remaining / 1000); remaining %= 1000
  if (crore) parts.push(`${three(crore)} Crore`)
  if (lakh) parts.push(`${two(lakh)} Lakh`)
  if (thousand) parts.push(`${two(thousand)} Thousand`)
  if (remaining) parts.push(three(remaining))
  return `${parts.join(' ')} Rupees Only`
}

export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Build a self-contained HTML invoice document.
 * @param {object} order — { order_number, created_at, items, discount, coupon_code, total, address }
 * @param {object} opts — { customer_name, customer_email, customer_phone }
 */
export function buildInvoiceHtml(order, opts = {}) {
  const rows = (order.items || [])
    .map(
      (it, i) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e2d8;color:#333;font-size:13px;text-align:center;">${i + 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e2d8;color:#333;font-size:13px;">${String(it.product_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e2d8;color:#333;font-size:13px;text-align:center;">${it.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e2d8;color:#333;font-size:13px;text-align:right;white-space:nowrap;">${fmt(it.price)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e2d8;color:#333;font-size:13px;text-align:right;white-space:nowrap;">${fmt(Number(it.price) * it.quantity)}</td>
        </tr>`,
    )
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${order.order_number} — Sree Sangram</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; margin: 0; }
    .sheet { max-width: 720px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #8a650e; padding-bottom: 14px; }
    .brand { font-size: 22px; font-weight: 700; letter-spacing: 3px; color: #8a650e; }
    .brand small { display: block; font-size: 10px; font-weight: 400; letter-spacing: 2px; color: #a97b10; text-transform: uppercase; margin-top: 3px; }
    .doc-title { text-align: right; }
    .doc-title h1 { margin: 0; font-size: 20px; letter-spacing: 2px; color: #8a650e; text-transform: uppercase; }
    .doc-title div { font-size: 12px; color: #666; margin-top: 3px; }
    .meta { display: flex; justify-content: space-between; gap: 20px; margin: 18px 0; }
    .meta h4 { margin: 0 0 6px; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #a97b10; }
    .meta p { margin: 2px 0; font-size: 13px; color: #333; }
    .meta .muted { color: #777; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #8a650e; color: #fff; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; padding: 9px 12px; text-align: left; }
    thead th.right, td.right { text-align: right; }
    tbody td { }
    .totals { margin-top: 14px; margin-left: auto; width: 280px; }
    .totals tr td { padding: 6px 12px; font-size: 13px; }
    .totals .disc td { color: #2e7d4f; }
    .totals .grand td { border-top: 2px solid #8a650e; font-size: 15px; font-weight: 700; }
    .words { margin-top: 14px; font-size: 12px; color: #444; border-top: 1px solid #e5e2d8; padding-top: 10px; }
    .words b { color: #8a650e; }
    .foot { margin-top: 26px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #e5e2d8; padding-top: 12px; }
    .toolbar { text-align: center; margin-bottom: 16px; }
    .toolbar button { background: #8a650e; color: #fff; border: none; border-radius: 6px; padding: 10px 22px; font-size: 14px; cursor: pointer; margin: 0 6px; }
    .toolbar button.ghost { background: #fff; color: #8a650e; border: 1px solid #8a650e; }
    @media print { .toolbar { display: none; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="toolbar">
      <button onclick="window.print()">🖨 Print / Save as PDF</button>
      <button class="ghost" onclick="window.close()">Close</button>
    </div>

    <div class="head">
      <div>
        <div class="brand">SREE SANGRAM<small>Vedic Astrology &amp; Spiritual Store</small></div>
      </div>
      <div class="doc-title">
        <h1>Tax Invoice</h1>
        <div>Invoice No: ${order.order_number}</div>
        <div>Date: ${formatDate(order.created_at)}</div>
      </div>
    </div>

    <div class="meta">
      <div>
        <h4>Bill To</h4>
        <p><b>${String(opts.customer_name || 'Customer').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</b></p>
        <p class="muted">${String(opts.customer_email || '').replace(/&/g, '&amp;')}</p>
        <p class="muted">${String(opts.customer_phone || '')}</p>
      </div>
      <div>
        <h4>Ship To</h4>
        <p class="muted">${String(order.address || '—').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr><th style="width:36px;">#</th><th>Item</th><th style="width:60px;text-align:center;">Qty</th><th class="right" style="width:100px;">Rate</th><th class="right" style="width:110px;">Amount</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="totals">
      <tr><td>Subtotal</td><td class="right">${fmt((Number(order.total) || 0) + (Number(order.discount) || 0) - (Number(order.shipping_fee) || 0))}</td></tr>
      ${Number(order.discount) > 0
        ? `<tr class="disc"><td>Discount ${order.coupon_code ? `(${order.coupon_code})` : ''}</td><td class="right">− ${fmt(order.discount)}</td></tr>`
        : ''}
      ${Number(order.shipping_fee) > 0
        ? `<tr><td>Shipping</td><td class="right">${fmt(order.shipping_fee)}</td></tr>`
        : ''}
      <tr class="grand"><td>Total</td><td class="right">${fmt(order.total)}</td></tr>
    </table>

    <div class="words"><b>Amount in words:</b> ${amountInWords(order.total)}</div>

    <div class="foot">
      Thank you for shopping with Sree Sangram ✦ &nbsp;·&nbsp; Payment received via PhonePe<br />
      This invoice was generated automatically on ${formatDate(new Date().toISOString())}.
    </div>
  </div>
</body>
</html>`
}

/** Open the invoice in a new window and prompt the browser's print/Save-as-PDF dialog. */
export function openInvoice(order, opts = {}) {
  const win = window.open('', '_blank', 'width=820,height=920')
  if (!win) return false
  win.document.write(buildInvoiceHtml(order, opts))
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 350)
  return true
}
