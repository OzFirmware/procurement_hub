import { esc, chip, fmtDate } from '../ui.js';
import { fmtCompact } from '../lib/currency.js';
import { vendorStats, vendorBadge, vendorPrs } from '../lib/vendorStats.js';
import { searchVendors } from '../lib/vendorSearch.js';
import { searchBar } from './adminSearch.js';

// Survives the re-render every store refresh triggers, the way VENDOR_Q does
// in adminVendors.js.
let QUERY = '';

const BADGE_CLS = { Domestic: 'dom', Foreign: 'for', Mixed: 'mix' };

// "Cubic Sensor & Instrument" → "CS"
const vinitials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2)
  .map(w => w[0]).join('').toUpperCase() || '?';

// Initials render underneath; the <img> overlays them and removes itself on
// load failure, so a dead logoUrl/favicon degrades to the initials avatar.
function logoHtml(v) {
  let src = v.logoUrl || '';
  if (!src && v.website) {
    const domain = String(v.website).replace(/^https?:\/\//, '').split('/')[0];
    if (domain) src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  }
  return `<span class="vc-logo">${esc(vinitials(v.displayName || v.name))}${
    src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
}

function chipRow(v) {
  const chips = [
    ...(v.bankName ? [{ t: v.bankName, cls: 'bank' }] : []),
    ...(v.departments || []).map(d => ({ t: d, cls: '' }))
  ];
  const shown = chips.slice(0, 3);
  const extra = chips.length - shown.length;
  return shown.map(c => `<span class="vc-chip ${c.cls}">${esc(c.t)}</span>`).join('') +
    (extra > 0 ? `<span class="vc-chip more">+${extra} more</span>` : '');
}

function cardHtml(s, v) {
  const k = vendorStats(s.prs, v.name);
  const badge = vendorBadge(v, s.prs);
  const spend = k.spendTotals.length
    ? fmtCompact(...k.spendTotals[0]) + (k.spendTotals.length > 1 ? ' +' : '')
    : '—';
  return `
    <div class="vcard" data-name="${esc(v.name)}">
      <div class="vc-top">
        ${logoHtml(v)}
        <div class="vc-title">
          <b>${esc(v.displayName || v.name)}</b>
          ${v.category ? `<span class="vc-sub">${esc(v.category)}</span>` : ''}
        </div>
        ${badge ? `<span class="vc-badge ${BADGE_CLS[badge]}">${esc(badge.toUpperCase())}</span>` : ''}
      </div>
      <div class="vc-stats">
        <div><span class="vc-l">Purchase reqs</span><b>${k.count}</b></div>
        <div><span class="vc-l">Total spend</span><b>${esc(spend)}</b></div>
        <div><span class="vc-l">Unpaid</span><b class="${k.unpaid ? 'vc-bad' : ''}">${k.unpaid}</b></div>
        <div><span class="vc-l">Last order</span><b>${fmtDate(k.lastOrder)}</b></div>
      </div>
      <div class="vc-chips">${chipRow(v)}</div>
    </div>`;
}

const alphabetical = vendors => [...(vendors || [])]
  .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));

// Ranked results must keep their order, so an empty query is the only case that
// sorts by name — searchVendors already returns best-match-first.
function gridHtml(s, q) {
  const all = alphabetical(s.vendors);
  const list = q.trim() ? searchVendors(all, q) : all;
  if (list.length) return list.map(v => cardHtml(s, v)).join('');
  return all.length
    ? `<div class="card" style="color:var(--mut)">No vendors match “${esc(q)}”.</div>`
    : '<div class="card" style="color:var(--mut)">No vendors yet — an admin can add them in Admin → Vendors.</div>';
}

export function vendorsView(el, s, param) {
  if (param) return detailView(el, s, decodeURIComponent(param));
  el.innerHTML = `
    <div class="dash">
      <div class="adm-head">
        <div>
          <h1>Vendors</h1>
          <p>Registered vendors and their purchase activity.</p>
        </div>
      </div>
      <div class="vsearch">${searchBar(QUERY, 'Search vendors — try “sensor”, “fab”, “ahmedabad”…', 'vendorSearch')}</div>
      <div class="vgrid" id="vgrid">${gridHtml(s, QUERY)}</div>
    </div>`;

  const grid = el.querySelector('#vgrid');
  const box = el.querySelector('#vendorSearch');
  const clear = el.querySelector('.admSearchClear');
  // Repaint only the grid, never the whole view: re-rendering the input would
  // drop focus and the caret on every keystroke.
  const run = () => {
    QUERY = box.value;
    clear.hidden = !QUERY;
    grid.innerHTML = gridHtml(s, QUERY);
    wireCards(grid);
  };
  box.oninput = run;
  box.onkeydown = e => { if (e.key === 'Escape' && box.value) { box.value = ''; run(); } };
  clear.onclick = () => { box.value = ''; run(); box.focus(); };
  wireCards(grid);
}

function wireCards(grid) {
  grid.querySelectorAll('.vcard').forEach(c =>
    c.onclick = () => location.hash = '#/vendors/' + encodeURIComponent(c.dataset.name));
}

// Read-only for every role. Banking numbers, IFSC, SWIFT and GST are
// deliberately never rendered here — admin editor only (see design spec).
function detailView(el, s, name) {
  const v = (s.vendors || []).find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!v) {
    el.innerHTML = `<div class="dash"><div class="card">Vendor not found: <b>${esc(name)}</b> — <a href="#/vendors">back to vendors</a></div></div>`;
    return;
  }
  const k = vendorStats(s.prs, v.name);
  const badge = vendorBadge(v, s.prs);
  const isAdmin = s.me && s.me.role === 'admin';
  const rows = vendorPrs(s.prs, v.name)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const info = [
    ['Contact person', v.contactPerson], ['Phone', v.phone], ['Email', v.email],
    ['Website', v.website], ['Address', v.address],
    ['Payment terms', v.paymentTerms], ['Bank', v.bankName]
  ].filter(([, val]) => val);
  el.innerHTML = `
    <div class="dash">
      <div class="adm-head">
        <div style="display:flex;gap:14px;align-items:center">
          ${logoHtml(v)}
          <div>
            <h1 style="display:flex;gap:10px;align-items:center">${esc(v.displayName || v.name)}
              ${badge ? `<span class="vc-badge ${BADGE_CLS[badge]}">${esc(badge.toUpperCase())}</span>` : ''}
            </h1>
            <p>${esc(v.category || 'Vendor')}</p>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          ${isAdmin ? '<a class="btn" href="#/admin">Edit in Admin</a>' : ''}
          <a class="btn" href="#/vendors">← All vendors</a>
        </div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="v">${k.count}</div><div class="l">Purchase requests</div></div>
        <div class="kpi ${k.unpaid ? 'bad' : ''}"><div class="v">${k.unpaid}</div><div class="l">Unpaid</div></div>
        <div class="kpi"><div class="v">${k.spendTotals.length ? esc(fmtCompact(...k.spendTotals[0])) : '—'}</div><div class="l">Total spend</div>
          <div class="s">${k.spendTotals.length > 1 ? esc(k.spendTotals.slice(1).map(([c, n]) => fmtCompact(c, n)).join(' + ')) : ''}</div></div>
        <div class="kpi"><div class="v">${fmtDate(k.lastOrder)}</div><div class="l">Last order</div></div>
      </div>
      ${info.length || (v.departments || []).length ? `<div class="card"><h2>Details</h2>
        <div class="vd-info">${info.map(([l, val]) => `<div><span class="vc-l">${esc(l)}</span><b>${esc(val)}</b></div>`).join('')}</div>
        ${(v.departments || []).length ? `<div class="vc-chips" style="margin-top:12px">${v.departments.map(d => `<span class="vc-chip">${esc(d)}</span>`).join('')}</div>` : ''}
      </div>` : ''}
      <div class="card">
        <h2>Purchase requests · ${rows.length}</h2>
        <table class="tbl"><thead><tr>
          <th>ID</th><th>Date</th><th>Dept</th><th>Item</th><th>Amount</th><th>Status</th>
        </tr></thead><tbody>
          ${rows.map(p => `<tr class="rowlink" data-id="${esc(p.id)}">
            <td style="font-family:var(--mono);font-size:12px">${esc(p.id)}</td>
            <td>${fmtDate(p.createdAt)}</td><td>${esc(p.department)}</td>
            <td class="wrap">${esc(p.item)}</td>
            <td>${p.amount ? esc(fmtCompact(p.currency || 'INR', Number(p.amount))) : '—'}</td>
            <td>${chip(p.status)}</td>
          </tr>`).join('') || '<tr><td colspan="6" style="color:var(--mut)">No PRs with this vendor yet.</td></tr>'}
        </tbody></table>
      </div>
    </div>`;
  el.querySelectorAll('tr.rowlink').forEach(tr =>
    tr.onclick = () => location.hash = '#/pr/' + tr.dataset.id);
}
