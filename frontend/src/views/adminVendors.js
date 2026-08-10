import { api } from '../api.js';
import { toast, esc } from '../ui.js';
import { fmtMoney } from '../lib/currency.js';
import { vendorStats } from '../lib/vendorStats.js';
import { searchBar, wireSearch, noMatchRow, hay } from './adminSearch.js';
import { searchVendors } from '../lib/vendorSearch.js';

let VENDORS = null;   // seeded from store, refreshed from route responses
let SELECTED = null;  // vendor name open in the detail editor
let VENDOR_Q = '';    // list filter, survives the re-render every save triggers

const TYPES = ['Domestic', 'International'];

function vendors(s) {
  if (VENDORS === null) VENDORS = s.vendors || [];
  return VENDORS;
}

function allDepts(s) {
  const fromLists = (s.lists && s.lists.departments) || [];
  const fromVendors = vendors(s).flatMap(v => v.departments || []);
  return [...new Set([...fromLists, ...fromVendors])];
}

const field = (label, name, value, ph = '') =>
  `<label class="adm-field">${esc(label)}
    <input class="adm-input" name="${name}" value="${esc(value || '')}" placeholder="${esc(ph)}">
  </label>`;

export function vendorsSection(s, showAdd) {
  const list = vendors(s);
  const sel = SELECTED && list.find(v => v.name.toLowerCase() === SELECTED.toLowerCase());
  if (sel) return detailHtml(s, sel);

  const rows = [...list].sort((a, b) => a.name.localeCompare(b.name));
  return `
    <div class="adm-card">
      ${searchBar(VENDOR_Q, 'Search vendors — try “sensor”, “fab”, “ahmedabad”…')}
      ${showAdd ? `
      <div class="adm-addrow">
        <input id="nvName" placeholder="Vendor name" class="adm-input">
        <button class="adm-addbtn" id="nvAdd">Add Vendor</button>
      </div>` : ''}
      <div style="overflow-x:auto">
        <table class="adm-tbl">
          <thead><tr>
            <th>Vendor</th><th>Departments</th><th>Type</th><th>Category</th><th style="text-align:right">Actions</th>
          </tr></thead>
          <tbody>
          ${rows.map(v => `<tr class="vRow" data-name="${esc(v.name)}"
            data-search="${hay(v.name, v.displayName, v.category, v.type, (v.departments || []).join(' '))}"
            style="cursor:pointer">
            <td class="adm-name">${esc(v.name)}</td>
            <td>${(v.departments || []).map(d => `<span class="adm-chip on">${esc(d)}</span>`).join(' ') || '<span class="adm-email">—</span>'}</td>
            <td>${esc(v.type || '—')}</td>
            <td>${esc(v.category || '—')}</td>
            <td style="text-align:right">
              <button class="adm-del vRm" data-name="${esc(v.name)}" title="Remove vendor">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </td>
          </tr>`).join('') || '<tr><td colspan="5" style="color:var(--adm-on-var)">No vendors yet — add the first one.</td></tr>'}
          ${noMatchRow(5, 'No vendor matches that name, category or department.')}
          </tbody>
        </table>
      </div>
      <div class="adm-foot"><span class="adm-count">${vendorCount(rows.length, rows.length)}</span></div>
    </div>`;
}

const vendorCount = (shown, total) => shown === total
  ? `Showing ${total} vendor${total === 1 ? '' : 's'}`
  : `Showing ${shown} of ${total} vendors`;

function detailHtml(s, v) {
  const k = vendorStats(s.prs, v.name);
  const inr = (k.spendTotals.find(([c]) => c === 'INR') || ['INR', 0])[1];
  const terms = (s.lists && s.lists.paymentTerms) || [];
  const termOpts = ['', ...(v.paymentTerms && !terms.includes(v.paymentTerms) ? [v.paymentTerms, ...terms] : terms)]
    .map(t => `<option value="${esc(t)}" ${t === (v.paymentTerms || '') ? 'selected' : ''}>${t ? esc(t) : '—'}</option>`).join('');
  return `
    <div class="adm-card" style="padding:24px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px">
        <div>
          <div class="adm-sec" style="margin:0 0 4px">${esc(v.type || 'Vendor')}${v.type ? ' vendor' : ''}</div>
          <h2 style="font-size:24px;font-weight:600;color:var(--adm-primary);margin:0">${esc(v.name)}</h2>
        </div>
        <button class="adm-del" id="vClose" title="Close"><span class="material-symbols-outlined">close</span></button>
      </div>

      <div class="adm-sec">Activity</div>
      <div class="adm-stats">
        <div class="adm-stat"><b>${k.count}</b><span>Purchase requests</span></div>
        <div class="adm-stat"><b>${esc(fmtMoney('INR', inr))}</b><span>INR spend</span></div>
        <div class="adm-stat"><b>${k.unpaid}</b><span>Unpaid</span></div>
      </div>

      <div class="adm-sec">Departments</div>
      <div class="adm-chips" id="vDepts">
        ${allDepts(s).map(d => {
          const on = (v.departments || []).some(x => x.toLowerCase() === d.toLowerCase());
          return `<button class="adm-chip ${on ? 'on' : ''}" data-dept="${esc(d)}">${esc(d)}</button>`;
        }).join('')}
      </div>

      <div class="adm-sec">Vendor details <span style="font-weight:400;text-transform:none">(editable)</span></div>
      <form id="vForm">
        <label class="adm-field" style="grid-column:1/-1">Vendor name
          <input class="adm-input" name="name" value="${esc(v.name)}">
        </label>
        <div class="adm-grid2">
          ${field('Display name', 'displayName', v.displayName, 'Shown on vendor cards')}
          ${field('Logo URL', 'logoUrl', v.logoUrl, 'https://…/logo.png')}
        </div>
        <div class="adm-grid2">
          ${field('Category', 'category', v.category, 'Sensors, PCB, Packaging…')}
          <label class="adm-field">Type
            <select class="adm-select" name="type">
              ${['', ...TYPES].map(t => `<option value="${esc(t)}" ${t === (v.type || '') ? 'selected' : ''}>${t ? esc(t) : '—'}</option>`).join('')}
            </select>
          </label>
          ${field('Contact person', 'contactPerson', v.contactPerson)}
          ${field('Phone', 'phone', v.phone)}
        </div>
        <label class="adm-field">Email <input class="adm-input" name="email" value="${esc(v.email || '')}"></label>
        <label class="adm-field">Address <input class="adm-input" name="address" value="${esc(v.address || '')}"></label>
        <div class="adm-grid2">
          ${field('GST / Tax ID', 'gstTaxId', v.gstTaxId)}
          ${field('Rating (1–5)', 'rating', v.rating)}
        </div>

        <div class="adm-sec">Banking &amp; payment</div>
        <label class="adm-field">Bank name <input class="adm-input" name="bankName" value="${esc(v.bankName || '')}"></label>
        <div class="adm-grid2">
          ${field('Account number', 'accountNumber', v.accountNumber)}
          ${field('IFSC', 'ifsc', v.ifsc)}
        </div>
        ${field('SWIFT', 'swift', v.swift)}
        <label class="adm-field">Payment terms
          <select class="adm-select" name="paymentTerms">${termOpts}</select>
        </label>

        <div style="display:flex;gap:12px;margin-top:24px">
          <button class="adm-addbtn" type="submit">Save changes</button>
          <button class="btn" type="button" id="vCancel">Cancel</button>
        </div>
      </form>
    </div>`;
}

export function wireVendors(el, s, rerender) {
  const call = async (action, body, msg) => {
    try {
      const d = await api(action, body);
      VENDORS = d.vendors;
      toast(msg);
      rerender();
    } catch (e) { toast(e.message, true); }
  };

  // list view — no-ops in the detail view, which renders no search box
  wireSearch(el, {
    get: () => VENDOR_Q,
    set: v => { VENDOR_Q = v; },
    count: vendorCount,
    // same matcher as the Vendors page, so one entity doesn't behave two ways
    match: q => new Set(searchVendors(vendors(s), q).map(v => v.name))
  });
  el.querySelectorAll('.vRow').forEach(r => r.onclick = e => {
    if (e.target.closest('.vRm')) return;
    SELECTED = r.dataset.name;
    rerender();
  });
  el.querySelectorAll('.vRm').forEach(b => b.onclick = () => {
    if (confirm(`Remove vendor "${b.dataset.name}"? PRs keep the name, but it leaves the registry.`)) {
      call('vendorRemove', { name: b.dataset.name }, `${b.dataset.name} removed`);
    }
  });
  const nvAdd = el.querySelector('#nvAdd');
  if (nvAdd) nvAdd.onclick = () => {
    const name = el.querySelector('#nvName').value.trim();
    if (!name) { toast('Vendor name required', true); return; }
    SELECTED = name;
    call('vendorSet', { name, updates: {} }, `${name} added — fill in the details`);
  };

  // detail view
  const close = () => { SELECTED = null; rerender(); };
  const vClose = el.querySelector('#vClose');
  if (vClose) vClose.onclick = close;
  const vCancel = el.querySelector('#vCancel');
  if (vCancel) vCancel.onclick = close;
  el.querySelectorAll('#vDepts .adm-chip').forEach(c => c.onclick = () => c.classList.toggle('on'));
  const form = el.querySelector('#vForm');
  if (form) form.onsubmit = ev => {
    ev.preventDefault();
    const updates = {};
    for (const [key, val] of new FormData(form)) updates[key] = val.trim();
    updates.departments = [...el.querySelectorAll('#vDepts .adm-chip.on')].map(c => c.dataset.dept);
    const newName = updates.name || SELECTED;
    call('vendorSet', { name: SELECTED, updates }, `${newName} saved`);
    SELECTED = newName;
  };
}

export function resetVendorPanel() { SELECTED = null; }
