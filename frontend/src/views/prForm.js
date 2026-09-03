import { api } from '../api.js';
import { store } from '../state.js';
import { toast, esc, chip } from '../ui.js';
import { STATUSES, PAYMENT_STATUSES } from '../lib/status.js';
import { computeLineTotal, computeTotalAmount } from '../lib/items.js';
import { fmtMoney } from '../lib/currency.js';
import { searchCurrencies, isCurrency, currencyLabel } from '../lib/currencies.js';
import { saveDraft, peekDraft, clearDraft } from '../lib/prDraft.js';

const PAYMENTS = PAYMENT_STATUSES;
const FALLBACK = {
  priorities: ['Critical', 'High', 'Medium', 'Low'],
  couriers: ['BlueDart', 'DHL', 'FedEx', 'DTDC', 'India Post', 'Other'],
  departments: [], materialTypes: [], paymentTerms: [], units: []
};

const list = (s, name) => (s.lists && s.lists[name] && s.lists[name].length ? s.lists[name] : FALLBACK[name]) || [];

// field-name → hover hint shown via the "?" bubble next to the label
const HINTS = {
  project: 'Which running project this purchase belongs to. Only your department’s projects are listed — ask an admin to add one if yours is missing.',
  purpose: 'One line on why this purchase is needed, e.g. “Calibration jigs for the EnvizomPro batch”.',
  vendor: 'The registered vendor you’ll buy from. Only vendors mapped to your department appear — an admin can register new ones.',
  currency: 'Currency of the vendor’s quote. Type to search any world currency by code, name or symbol.',
  priority: 'Critical = must-have immediately, expedite even at extra cost. High = procure as soon as possible. Medium = needed within the normal purchase cycle. Low = procure when budget allows.',
  expected: 'Date you expect the goods to arrive — used for the In-Transit tracking on the dashboard.',
  payment: 'Whether the vendor has been paid. Usually Unpaid when raising the request.',
  notes: 'Anything the approver or purchase team should know — links, context, constraints.',
  iDesc: 'What you’re buying — one line per item, e.g. “ESP32-S3 DevKit N16R8”.',
  iZoho: 'Zoho part number, links the item to Production inventory (e.g. Z-0042).',
  iType: 'Item category for your department — drives reporting. Ask an admin to add a missing type.',
  iQty: 'How many, counted in the unit chosen next to it.',
  iUnit: 'Unit of measure: pcs, kg, m, set…',
  iPrice: 'Price for ONE unit, in the PR’s currency. Line total = qty × unit price; leave blank if unknown.',
  iLink: 'URL of the exact product page / variant you want ordered.',
  iDoc: 'Datasheet or spec document URL, if relevant.'
};
// edge=true anchors the tooltip to the icon's right edge — for fields in the
// last grid column, where a left-anchored bubble clips at the card boundary
const lbl = (text, hintKey, edge) => `<span class="lblrow">${esc(text)}${
  HINTS[hintKey] ? `<span class="hq ${edge ? 'r' : ''}" data-tip="${esc(HINTS[hintKey])}">?</span>` : ''}</span>`;

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
  // :not(.ithead) — the column-label header row shares the .itemrow grid class
  return [...form.querySelectorAll('.itemrow:not(.ithead)')].map(row => {
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
  let p = editing || {};
  let items = editing ? (p.items || []) : [{}];
  // Returning from the "+ Add new vendor" redirect: restore whatever the
  // requester had already typed (and the newly picked vendor) before we
  // navigated them away — see lib/prDraft.js.
  const draft = peekDraft();
  clearDraft(); // one-shot: never let a stale draft leak into an unrelated visit
  if (draft && draft.editId === (editId || '')) {
    p = { ...p, ...draft.fields };
    if (draft.items && draft.items.length) items = draft.items;
  }
  const me = s.me || { role: '' };
  const staff = ['approver', 'admin', 'finance'].includes(me.role);
  // projects and vendors for the PR's department (creating: the user's own)
  const dept = editing ? (p.department || '') : (me.department || '');
  const projNames = (s.projects || [])
    .filter(x => x.department.toLowerCase() === dept.toLowerCase())
    .map(x => x.project);
  const deptVendors = (s.vendors || [])
    .filter(v => (v.departments || []).some(d => d.toLowerCase() === dept.toLowerCase()));
  const vendorLabelOf = name => {
    const v = deptVendors.find(x => x.name.toLowerCase() === String(name || '').toLowerCase());
    return v ? (v.displayName || v.name) : String(name || '');
  };
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
              <label>${lbl('Project*', 'project')} <select name="project" required>${opts(projNames, p.project || '', true)}</select></label>
              <label>${lbl('Purpose', 'purpose')} <input name="purpose" value="${esc(p.purpose)}"></label>
              <div class="pd-field full">${lbl('Vendor', 'vendor')}
                <input id="venSearch" class="combo" autocomplete="off" spellcheck="false" placeholder="Search vendors…" value="${esc(vendorLabelOf(p.vendor))}">
                <input type="hidden" name="vendor" value="${esc(p.vendor || '')}">
                <div class="curList" id="venList" hidden></div>
                <div><button type="button" class="btn" id="venAddNewBtn" style="margin-top:8px">Vendor not listed? Add new vendor</button></div>
              </div>
              <div class="pd-field">${lbl('Currency', 'currency')}
                <input id="curSearch" class="combo" autocomplete="off" spellcheck="false" value="${esc(currencyLabel(p.currency || 'INR'))}">
                <input type="hidden" name="currency" value="${esc(p.currency || 'INR')}">
                <div class="curList" id="curList" hidden></div>
              </div>
              <label>${lbl('Priority', 'priority', true)} <select name="priority">${opts(list(s, 'priorities'), p.priority || 'Medium')}</select></label>
              <label>${lbl('Expected delivery', 'expected')} <input name="expectedDate" type="date" value="${esc((p.expectedDate || '').slice(0, 10))}"></label>
              ${staff ? `
              <label>${lbl('Payment status*', 'payment')} <select name="paymentStatus" required>${opts(PAYMENTS, p.paymentStatus || 'Unpaid')}</select></label>` : ''}
              ${editing && me.role === 'admin' ? `
              <label>Status (admin override) <select name="status">${opts(STATUSES, p.status)}</select></label>
              <label>Requester email (admin override) <input name="requesterEmail" value="${esc(p.requesterEmail)}"></label>` : ''}
            </div>
            <label style="margin-top:14px">${lbl('Notes', 'notes')} <textarea name="notes" rows="3">${esc(p.notes)}</textarea></label>
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
          <div class="pd-body pd-form">
            <div class="itemrow ithead ${showZoho ? '' : 'nz'}">
              <span>${lbl('Description*', 'iDesc')}</span>
              ${showZoho ? `<span>${lbl('Zoho no', 'iZoho')}</span>` : ''}
              <span>${lbl('Type*', 'iType')}</span>
              <span>${lbl('Qty*', 'iQty')}</span>
              <span>${lbl('Unit*', 'iUnit')}</span>
              <span>${lbl('Unit price', 'iPrice')}</span>
              <span>${lbl('Purchase link', 'iLink', true)}</span>
              <span>${lbl('Datasheet', 'iDoc', true)}</span>
              <span></span>
            </div>
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

  // Searchable combobox: the visible input drives the option list; the hidden
  // input holds the committed value the form submits. Options render as
  // {value, main, name, sub}. resolve(text) maps typed text to a value (or
  // null to snap back); toLabel(value) formats the committed display text.
  const wireCombo = (inputId, listId, hiddenName, { search, resolve, toLabel, allowEmpty, onCommit }) => {
    const input = el.querySelector('#' + inputId);
    const listBox = el.querySelector('#' + listId);
    const hidden = form.querySelector(`[name="${hiddenName}"]`);
    const done = () => { if (onCommit) onCommit(); };
    const show = q => {
      const rows = search(q).slice(0, 30);
      listBox.innerHTML = rows.map(r =>
        `<div class="curOpt" data-v="${esc(r.value)}"><b>${esc(r.main)}</b> ${esc(r.name || '')}<span>${esc(r.sub || '')}</span></div>`
      ).join('') || '<div class="curEmpty">No match</div>';
      listBox.hidden = false;
    };
    input.onfocus = () => { input.select(); show(''); };
    input.oninput = () => show(input.value);
    listBox.onmousedown = e => {
      e.preventDefault(); // keep focus in the input — no blur/refocus loop
      const opt = e.target.closest('.curOpt');
      if (!opt) return;
      hidden.value = opt.dataset.v;
      input.value = toLabel(opt.dataset.v);
      listBox.hidden = true;
      done();
    };
    input.onblur = () => setTimeout(() => {
      listBox.hidden = true;
      const t = input.value.trim();
      if (!t && allowEmpty) hidden.value = '';
      else {
        const v = resolve(t);
        if (v != null) hidden.value = v;
      }
      input.value = toLabel(hidden.value);
      done();
    }, 120);
  };

  wireCombo('curSearch', 'curList', 'currency', {
    search: q => searchCurrencies(q).map(c => ({ value: c.code, main: c.code, name: c.name, sub: c.sym || '' })),
    resolve: t => {
      const code = t.split('—')[0].trim().toUpperCase(); // accept a typed bare code
      return isCurrency(code) ? code : null;
    },
    toLabel: v => currencyLabel(v),
    onCommit: renderTotal
  });

  const vendorSearch = q => {
    const t = String(q || '').trim().toLowerCase();
    return deptVendors
      .filter(v => !t || v.name.toLowerCase().includes(t)
        || (v.displayName || '').toLowerCase().includes(t)
        || (v.category || '').toLowerCase().includes(t))
      .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name))
      .map(v => ({ value: v.name, main: v.displayName || v.name, name: v.displayName ? v.name : '', sub: v.category || '' }));
  };
  wireCombo('venSearch', 'venList', 'vendor', {
    search: vendorSearch,
    resolve: t => {
      const hit = deptVendors.find(v => v.name.toLowerCase() === t.toLowerCase()
        || (v.displayName || '').toLowerCase() === t.toLowerCase());
      return hit ? hit.name : null;
    },
    toLabel: v => vendorLabelOf(v),
    allowEmpty: true // vendor is optional
  });

  const venSearchInput = el.querySelector('#venSearch');
  // Redirects to a dedicated Add Vendor page (open to every role, unlike the
  // admin-only Vendors section) and back — snapshot everything typed so far
  // into sessionStorage first, since the navigation fully unmounts this view.
  el.querySelector('#venAddNewBtn').onclick = () => {
    const fields = {};
    for (const [k, v] of new FormData(form)) if (!k.startsWith('i_')) fields[k] = v;
    const draftItems = collectItems(form);
    saveDraft({
      editId: editId || '',
      fields,
      items: draftItems.length ? draftItems : [{}],
      department: dept,
      prefillVendorName: venSearchInput.value.trim(),
      returnHash: location.hash
    });
    location.hash = '#/vendor-new';
  };

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
