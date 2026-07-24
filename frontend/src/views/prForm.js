import { api } from '../api.js';
import { store } from '../state.js';
import { toast, esc, chip } from '../ui.js';
import { STATUSES } from '../lib/status.js';
import { computeLineTotal, computeTotalAmount } from '../lib/items.js';
import { fmtMoney } from '../lib/currency.js';

const PAYMENTS = ['Unpaid', 'Paid', 'Partially Paid', 'FOC / Free'];
const FALLBACK = {
  priorities: ['High', 'Medium', 'Low'],
  currencies: ['INR', 'USD', 'EUR'],
  couriers: ['BlueDart', 'DHL', 'FedEx', 'DTDC', 'India Post', 'Other'],
  departments: [], materialTypes: [], paymentTerms: [], units: []
};

const list = (s, name) => (s.lists && s.lists[name] && s.lists[name].length ? s.lists[name] : FALLBACK[name]) || [];

// Keep a stored value selectable even if it's not in the list (e.g. legacy data),
// otherwise saving silently rewrites it to the first <option>.
function opts(values, sel, blank) {
  const all = sel && !values.includes(sel) ? [...values, sel] : values;
  return (blank ? ['', ...all] : all)
    .map(v => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

function itemRowHtml(s, it = {}, i = 0, typeNames = [], showZoho = true) {
  return `<div class="itemrow ${showZoho ? '' : 'nz'}" data-i="${i}">
    <input type="hidden" name="i_lineTotal" value="${esc(it.lineTotal)}">
    <input name="i_description" placeholder="Item / description*" value="${esc(it.description)}">
    ${showZoho
      ? `<input name="i_partNo" placeholder="Zoho no" value="${esc(it.partNo)}">`
      : `<input type="hidden" name="i_partNo" value="${esc(it.partNo)}">`}
    <select name="i_materialType" required>${opts(typeNames, it.materialType || '', true)}</select>
    <input name="i_qty" type="number" step="any" min="0" placeholder="Qty*" required value="${esc(it.qty)}">
    <select name="i_unit" required>${opts(list(s, 'units'), it.unit || 'pcs')}</select>
    <input name="i_unitPrice" type="number" step="0.01" min="0" placeholder="Unit price" value="${esc(it.unitPrice)}">
    <input name="i_purchaseLink" placeholder="Purchase link" value="${esc(it.purchaseLink)}">
    <input name="i_datasheetDoc" placeholder="Datasheet / doc URL" value="${esc(it.datasheetDoc)}">
    <button type="button" class="btn danger rmItem" title="Remove item">×</button>
  </div>`;
}

function collectItems(form) {
  return [...form.querySelectorAll('.itemrow')].map(row => {
    const get = n => row.querySelector(`[name="${n}"]`).value.trim();
    return {
      description: get('i_description'), partNo: get('i_partNo'),
      materialType: get('i_materialType'), qty: get('i_qty'), unit: get('i_unit'),
      unitPrice: get('i_unitPrice'), purchaseLink: get('i_purchaseLink'),
      datasheetDoc: get('i_datasheetDoc'), lineTotal: get('i_lineTotal')
    };
  }).filter(it => it.description);
}

export function prFormView(el, s, editId) {
  const editing = editId ? s.prs.find(p => p.id === editId) : null;
  const p = editing || {};
  const items = editing ? (p.items || []) : [{}];
  const me = s.me || { role: '' };
  const staff = ['approver', 'admin'].includes(me.role);
  // projects and vendors for the PR's department (creating: the user's own)
  const dept = editing ? (p.department || '') : (me.department || '');
  const projNames = (s.projects || [])
    .filter(x => x.department.toLowerCase() === dept.toLowerCase())
    .map(x => x.project);
  const vendorNames = (s.vendors || [])
    .filter(v => (v.departments || []).some(d => d.toLowerCase() === dept.toLowerCase()))
    .map(v => v.name);
  const typeNames = (s.materialTypes || [])
    .filter(x => x.department.toLowerCase() === dept.toLowerCase())
    .map(x => x.materialType);
  // Zoho part numbers only exist in Production's workflow
  const showZoho = dept.toLowerCase() === 'production';

  el.innerHTML = `
    <div class="dash">
      <div class="crumbs"><a href="#/">PRs</a> / ${editing
        ? `<a href="#/pr/${esc(p.id)}" style="font-family:var(--mono)">${esc(p.id)}</a> / edit`
        : 'new'}</div>
      <div class="adm-head">
        <div style="display:flex;align-items:center;gap:12px">
          <h1 style="margin:0${editing ? ';font-family:var(--mono)' : ''}">${editing ? esc(p.id) : 'New Purchase Request'}</h1>
          ${editing ? chip(p.status) : ''}
        </div>
        <div style="display:flex;gap:8px">
          <a class="btn" href="${editing ? '#/pr/' + esc(p.id) : '#/'}">Cancel</a>
          <button class="btn primary" type="submit" form="prForm" id="prSave">${editing ? 'Save changes' : 'Submit PR'}</button>
        </div>
      </div>
      <form id="prForm">
        <div class="card">
          <h2>General information</h2>
          <div class="pd-body pd-form">
            <div class="pd-grid">
              <label>Project* <select name="project" required>${opts(projNames, p.project || '', true)}</select></label>
              <label>Purpose <input name="purpose" value="${esc(p.purpose)}"></label>
              <label>Vendor <select name="vendor">${opts(vendorNames, p.vendor || '', true)}</select></label>
              <label>Currency <select name="currency">${opts(list(s, 'currencies'), p.currency || 'INR')}</select></label>
              <label>Priority <select name="priority">${opts(list(s, 'priorities'), p.priority || 'Medium')}</select></label>
              <label>Expected delivery <input name="expectedDate" type="date" value="${esc((p.expectedDate || '').slice(0, 10))}"></label>
              ${staff ? `
              <label>Payment status* <select name="paymentStatus" required>${opts(PAYMENTS, p.paymentStatus || 'Unpaid')}</select></label>` : ''}
              ${editing && me.role === 'admin' ? `
              <label>Status (admin override) <select name="status">${opts(STATUSES, p.status)}</select></label>
              <label>Requester email (admin override) <input name="requesterEmail" value="${esc(p.requesterEmail)}"></label>` : ''}
            </div>
            <label style="margin-top:14px">Notes <textarea name="notes" rows="3">${esc(p.notes)}</textarea></label>
          </div>
        </div>

        ${editing && me.role === 'admin' ? `
        <div class="card">
          <h2>Procurement details</h2>
          <div class="pd-body pd-form">
            <div class="pd-grid">
              <label>PO number <input name="poNo" value="${esc(p.poNo)}"></label>
              <label>PO date <input name="poDate" type="date" value="${esc((p.poDate || '').slice(0, 10))}"></label>
              <label>Invoice / order # <input name="invoiceNo" value="${esc(p.invoiceNo)}"></label>
              <label>Invoice date <input name="invoiceDate" type="date" value="${esc((p.invoiceDate || '').slice(0, 10))}"></label>
              <label>Payment term <select name="paymentTerm">${opts(list(s, 'paymentTerms'), p.paymentTerm || '', true)}</select></label>
              <label>Quotation / PI URL <input name="quotationDoc" value="${esc(p.quotationDoc)}"></label>
            </div>
          </div>
        </div>` : ''}

        <div class="card">
          <h2>Requested items</h2>
          <div class="pd-body">
            <div id="itemRows">${items.map((it, i) => itemRowHtml(s, it, i, typeNames, showZoho)).join('')}</div>
            <div style="display:flex;align-items:center;gap:12px;margin-top:10px">
              <button type="button" class="btn" id="addItem">+ Add item</button>
              <span id="liveTotal" style="color:var(--mut)"></span>
            </div>
          </div>
        </div>
      </form>
    </div>`;

  const form = el.querySelector('#prForm');
  const rowsEl = el.querySelector('#itemRows');

  const renderTotal = () => {
    const its = collectItems(form).map(it => {
      const computed = computeLineTotal(it.qty, it.unitPrice);
      return { lineTotal: computed !== '' ? computed : it.lineTotal };
    });
    const total = computeTotalAmount(its);
    const cur = form.querySelector('[name="currency"]').value || 'INR';
    el.querySelector('#liveTotal').textContent = total === '' ? '' : 'Total: ' + fmtMoney(cur, total);
  };

  const wireRow = row => {
    row.querySelector('.rmItem').onclick = () => {
      if (rowsEl.children.length > 1) { row.remove(); renderTotal(); }
    };
    row.querySelectorAll('input, select').forEach(inp => inp.oninput = renderTotal);
  };
  [...rowsEl.children].forEach(wireRow);
  renderTotal();
  form.querySelector('[name="currency"]').oninput = renderTotal;

  el.querySelector('#addItem').onclick = () => {
    rowsEl.insertAdjacentHTML('beforeend', itemRowHtml(s, {}, rowsEl.children.length, typeNames, showZoho));
    wireRow(rowsEl.lastElementChild);
  };

  form.onsubmit = async ev => {
    ev.preventDefault();
    const btn = el.querySelector('#prSave'); // lives in the header, outside <form>
    btn.disabled = true; btn.textContent = 'Saving…';
    const fields = {};
    for (const [k, v] of new FormData(ev.target)) if (!k.startsWith('i_')) fields[k] = v;
    const items = collectItems(form);
    try {
      if (!items.length) throw new Error('Add at least one item with a description');
      if (editing) {
        await api('update', { id: p.id, updates: fields, items });
        toast('PR updated');
        location.hash = '#/pr/' + p.id;
      } else {
        const d = await api('create', { pr: fields, items });
        toast('Created ' + d.pr.id);
        location.hash = '#/pr/' + d.pr.id;
      }
      store.refresh();
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false; btn.textContent = editing ? 'Save changes' : 'Submit PR';
    }
  };
}
