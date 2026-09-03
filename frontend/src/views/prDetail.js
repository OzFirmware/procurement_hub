import { api } from '../api.js';
import { store } from '../state.js';
import { toast, esc, chip, fmtDate, initials } from '../ui.js';
import { nameIndex, personName } from '../lib/people.js';
import { nextStates } from '../lib/status.js';
import { fmtMoney } from '../lib/currency.js';

const COURIER_URLS = {
  'BlueDart': t => `https://www.bluedart.com/tracking?trackFor=0&trackNo=${t}`,
  'DHL': t => `https://www.dhl.com/in-en/home/tracking.html?tracking-id=${t}`,
  'FedEx': t => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
  'DTDC': t => `https://txn.dtdc.com/ctbs-tracking/customerInterface.tr?submitName=showCITrackingDetails&cnNo=${t}`,
  'Delhivery': t => `https://www.delhivery.com/track-v2/package/${t}`
};
const trackUrl = (courier, t) =>
  (COURIER_URLS[courier] || (x => `https://t.17track.net/en#nums=${x}`))(encodeURIComponent(t));

const field = (label, value) =>
  `<div class="pd-f"><span class="vc-l">${esc(label)}</span><b>${value || '—'}</b></div>`;

// PO fields (poNo/poDate/paymentTerm) are ADMIN_FIELDS server-side — an
// approver's 'update' call would silently drop them, leaving the PR marked
// Ordered with no PO actually recorded. Keep this admin-only until the
// backend opens those fields to more roles.
let showPo = false;
let showPoFor = null;

const person = (label, name, email, sub) => `
  <div class="pd-person">
    <span class="avatar avatar-txt">${esc(initials(email || name))}</span>
    <div>
      <span class="vc-l">${esc(label)}</span>
      <b>${esc(name)}</b>
      <div class="pd-sub">${esc(sub || '')}</div>
    </div>
  </div>`;

export function prDetailView(el, s, id) {
  const p = s.prs.find(x => x.id === id);
  if (!p) { el.innerHTML = `<div class="card">PR ${esc(id)} not found ${s.prs.length ? '' : '(still syncing…)'}</div>`; return; }
  if (showPoFor !== id) { showPo = false; showPoFor = id; } // navigating to a different PR closes any open panel
  const me = s.me || { role: '', email: '', department: '' };
  const isAdmin = me.role === 'admin';
  // built from every PR, not just this one — an approver whose name cell is
  // empty here is usually named on some other row
  const names = nameIndex(s.prs);
  const isOwn = p.requesterEmail.toLowerCase() === me.email.toLowerCase();
  // finance needs the Procurement details card (PO #, payment term) to know
  // what they're paying, but never gets status-changing buttons (nextStates
  // below is keyed off the STAFF token list in status.js, which finance isn't in)
  const isStaff = ['approver', 'admin', 'finance'].includes(me.role);
  const canEdit = isStaff || (isOwn && p.status === 'Submitted');
  const sameDept = String(p.department || '').toLowerCase() === String(me.department || '').toLowerCase();
  const targets = nextStates(p.status, me.role, isOwn, sameDept);
  // Zoho part numbers only exist in Production's workflow
  const showZoho = (p.department || '').toLowerCase() === 'production';
  const canMakePo = isAdmin && p.status === 'Approved';
  const canPushZoho = isAdmin && p.poNo && !p.zohoPoId;

  // payment term is owned by the vendor record, not typed per PR (see the
  // 'lives on the vendor record now' comment in prs.gs create) — prefill
  // from there so Finance gets a consistent term without retyping it
  const vendor = (s.vendors || []).find(v => String(v.name || '').toLowerCase() === String(p.vendor || '').toLowerCase());
  const defaultTerm = p.paymentTerm || (vendor && vendor.paymentTerms) || '';
  const termsList = (s.lists && s.lists.paymentTerms) || [];
  const termOptions = ['', ...(defaultTerm && !termsList.includes(defaultTerm) ? [defaultTerm, ...termsList] : termsList)]
    .map(t => `<option value="${esc(t)}" ${t === defaultTerm ? 'selected' : ''}>${t ? esc(t) : '— select —'}</option>`).join('');

  el.innerHTML = `
    <div class="dash">
      <div class="crumbs"><a href="#/">PRs</a> / <span style="font-family:var(--mono)">${esc(p.id)}</span></div>
      <div class="adm-head">
        <div style="display:flex;align-items:center;gap:12px">
          <h1 style="font-family:var(--mono);margin:0">${esc(p.id)}</h1>${chip(p.status)}
        </div>
        <div style="display:flex;gap:8px">
          ${targets.map(t => `<button class="btn ${t === 'Approved' || t === 'Received' ? 'primary' : t === 'Rejected' || t === 'Cancelled' ? 'danger' : ''}" data-to="${esc(t)}">Mark ${esc(t)}</button>`).join('')}
          ${canMakePo ? `<button class="btn primary" id="makePoBtn">Make a PO</button>` : ''}
          ${canPushZoho ? `<button class="btn" id="zohoPushBtn">Send to Zoho Books</button>` : ''}
          ${canEdit ? `<a class="btn" href="#/new/${esc(p.id)}">Edit</a>` : ''}
        </div>
      </div>

      ${canMakePo && showPo ? `
      <div class="card">
        <h2>Make a purchase order</h2>
        <div class="pd-body">
        <form class="pr" id="poForm">
          <label>PO number* <input name="poNo" required value="${esc(p.poNo)}"></label>
          <label>PO date <input name="poDate" type="date" value="${esc(p.poDate || new Date().toISOString().slice(0, 10))}"></label>
          <label class="full">Payment term
            <select name="paymentTerm">${termOptions}</select>
          </label>
          ${vendor && vendor.paymentTerms && !p.paymentTerm ? `<div class="full pd-sub">Prefilled from ${esc(vendor.name)}'s vendor record — change it here if this order is different.</div>` : ''}
          <div class="full" style="display:flex;gap:8px">
            <button class="btn primary" type="submit">Create PO &amp; mark Ordered</button>
            <button class="btn" type="button" id="poCancelBtn">Cancel</button>
          </div>
        </form>
        </div>
      </div>` : ''}

      <div class="card">
        <h2>General information</h2>
        <div class="pd-body">
        <div class="pd-grid">
          ${field('Department', esc(p.department))}
          ${field('Project', esc(p.project))}
          ${field('Vendor', esc(p.vendor))}
          ${field('Purpose', esc(p.purpose))}
          ${field('Priority', esc(p.priority))}
          ${field('Payment status', esc(p.paymentStatus))}
        </div>
        <div class="pd-people">
          ${person('Requested by', personName(p.requestedByName, p.requesterEmail, names), p.requesterEmail, 'Created on ' + fmtDate(p.createdAt))}
          ${(p.approverEmail || p.approvedByName)
            ? person('Approved by', personName(p.approvedByName, p.approverEmail, names), p.approverEmail, p.approvedAt ? 'on ' + fmtDate(p.approvedAt) : '')
            : ''}
        </div>
        </div>
      </div>

      <div class="card">
        <h2>Requested items</h2>
        <table class="tbl"><thead><tr>
          <th>#</th><th>Description</th>${showZoho ? '<th>Zoho no</th>' : ''}<th>Type</th><th>Qty</th><th>Unit price</th><th>Line total</th><th>Links</th>
        </tr></thead><tbody>
          ${(p.items || []).map(it => `<tr>
            <td>${esc(it.itemNo)}</td>
            <td class="wrap">${esc(it.description)}</td>${showZoho ? `<td>${esc(it.partNo)}</td>` : ''}<td>${esc(it.materialType)}</td>
            <td>${esc([it.qty, it.unit].filter(Boolean).join(' '))}</td>
            <td>${it.unitPrice ? esc(fmtMoney(p.currency || 'INR', Number(it.unitPrice))) : '—'}</td>
            <td>${it.lineTotal ? esc(fmtMoney(p.currency || 'INR', Number(it.lineTotal))) : '—'}</td>
            <td>${it.purchaseLink ? `<a href="${esc(it.purchaseLink)}" target="_blank" rel="noopener">buy ↗</a>` : ''}
                ${it.datasheetDoc ? ` <a href="${esc(it.datasheetDoc)}" target="_blank" rel="noopener">doc ↗</a>` : ''}</td>
          </tr>`).join('') || `<tr><td colspan="${showZoho ? 8 : 7}" style="color:var(--mut)">No items.</td></tr>`}
        </tbody></table>
        <div class="pd-total">Request total&nbsp;<b>${p.totalAmount ? esc(fmtMoney(p.currency || 'INR', Number(p.totalAmount))) : '—'}</b></div>
      </div>

      <div class="card">
        <h2>Delivery</h2>
        <div class="pd-body">
        <div class="pd-grid">
          ${field('Expected', fmtDate(p.expectedDate))}
          ${field('Received', fmtDate(p.receivedAt))}
          ${field('Tracking', p.trackingNo
            ? `${esc(p.courier || '')} <a href="${p.trackingLink ? esc(p.trackingLink) : trackUrl(p.courier, p.trackingNo)}" target="_blank" rel="noopener">${esc(p.trackingNo)} ↗</a>`
            : '')}
          ${field('Notes', esc(p.notes))}
        </div>
        </div>
      </div>

      ${isStaff ? `
      <div class="card">
        <h2>Procurement details</h2>
        <div class="pd-body">
        <div class="pd-grid">
          ${field('PO reference', [esc(p.poNo), fmtDate(p.poDate)].filter(Boolean).join(' · '))}
          ${field('Invoice / order #', [esc(p.invoiceNo), fmtDate(p.invoiceDate)].filter(Boolean).join(' · '))}
          ${field('Payment term', esc(p.paymentTerm))}
          ${field('Quotation / PI', p.quotationDoc ? `<a href="${esc(p.quotationDoc)}" target="_blank" rel="noopener">open ↗</a>` : '')}
          ${field('Zoho Books PO', p.zohoPoNumber ? esc(p.zohoPoNumber) : '')}
        </div>
        </div>
      </div>` : ''}

      ${me.role === 'admin' ? `
      <div class="card pd-danger">
        <div>
          <b>Delete this purchase request</b>
          <div class="pd-sub">Deletion is permanent and cannot be undone. Item rows and this PR leave all active views.</div>
        </div>
        <button class="btn danger" id="devDelete">Delete PR permanently</button>
      </div>` : ''}
    </div>`;

  el.querySelectorAll('[data-to]').forEach(btn => btn.onclick = async () => {
    const to = btn.dataset.to;
    if ((to === 'Rejected' || to === 'Cancelled') && !confirm(`Mark ${p.id} as ${to}?`)) return;
    btn.disabled = true;
    try {
      await api('transition', { id: p.id, to });
      toast(p.id + ' → ' + to);
      store.refresh();
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  });

  const makePoBtn = el.querySelector('#makePoBtn');
  if (makePoBtn) makePoBtn.onclick = () => { showPo = true; prDetailView(el, s, id); };

  const poCancelBtn = el.querySelector('#poCancelBtn');
  if (poCancelBtn) poCancelBtn.onclick = () => { showPo = false; prDetailView(el, s, id); };

  const poForm = el.querySelector('#poForm');
  if (poForm) poForm.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(poForm);
    const poNo = String(fd.get('poNo') || '').trim();
    if (!poNo) return;
    const btn = poForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await api('update', { id: p.id, updates: { poNo, poDate: fd.get('poDate') || '', paymentTerm: fd.get('paymentTerm') || '' } });
      await api('transition', { id: p.id, to: 'Ordered' });
      toast(p.id + ' → Ordered (PO ' + poNo + ')');
      showPo = false;
      store.refresh();
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  };

  const zohoBtn = el.querySelector('#zohoPushBtn');
  if (zohoBtn) zohoBtn.onclick = async () => {
    zohoBtn.disabled = true;
    try {
      const { pr: updated } = await api('zohoPushPo', { id: p.id });
      toast(p.id + ' → Zoho Books PO ' + updated.zohoPoNumber);
      store.refresh();
    } catch (e) { toast(e.message, true); zohoBtn.disabled = false; }
  };

  const del = el.querySelector('#devDelete');
  if (del) del.onclick = async () => {
    if (!confirm('Permanently DELETE ' + p.id + '? This cannot be undone.')) return;
    del.disabled = true;
    try {
      await api('delete', { id: p.id });
      toast(p.id + ' deleted');
      location.hash = '#/';
      store.refresh();
    } catch (e) { toast(e.message, true); del.disabled = false; }
  };
}
