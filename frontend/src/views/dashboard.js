import { api } from '../api.js';
import { store } from '../state.js';
import { esc, chip, fmtDate, displayName, toast } from '../ui.js';
import { fmtCompact } from '../lib/currency.js';
import { kpis, KPI_FILTERS, ownPrs, approvedPrs, approvalStats, prsForDept, pendingPayments } from '../lib/metrics.js';
import { hasEdge, STATUSES, PAYMENT_STATUSES } from '../lib/status.js';

// the options an approver's inline status dropdown offers — Approve or
// Reject a Submitted PR, their only move (see statusCell below)
const APPROVAL_LOOP = ['Submitted', 'Approved', 'Rejected'];

const UI = { sel: 'total', tab: 'mine', filters: { q: '', dept: '', vendor: '', status: '', from: '', to: '' } };

// full re-render (matches the rest of the module's state-change convention)
// but restores focus/caret on the element that triggered it, so typing in
// the search box doesn't get interrupted every keystroke.
function rerender(root, s) {
  const active = document.activeElement;
  const restore = active && root.contains(active) && active.id
    ? { id: active.id, start: active.selectionStart, end: active.selectionEnd }
    : null;
  dashboardView(root, s);
  if (!restore) return;
  const el = root.querySelector('#' + restore.id);
  if (!el) return;
  el.focus();
  if (restore.start != null && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(restore.start, restore.end); } catch {}
  }
}

const day = d => String(d || '').slice(0, 10);
function matchesFilters(p) {
  const f = UI.filters;
  if (f.dept && p.department !== f.dept) return false;
  if (f.vendor && p.vendor !== f.vendor) return false;
  if (f.status && p.status !== f.status) return false;
  if (f.from && day(p.createdAt) < f.from) return false;
  if (f.to && day(p.createdAt) > f.to) return false;
  if (f.q) {
    const hay = `${p.id} ${p.item} ${p.vendor} ${p.department}`.toLowerCase();
    if (!hay.includes(f.q.trim().toLowerCase())) return false;
  }
  return true;
}

export function dashboardView(el, s) {
  el.innerHTML = `
    <div class="dash">
      <div class="adm-head">
        <div>
          <h1>Dashboard</h1>
          <p>Your purchase requests at a glance — cards filter the list below.</p>
        </div>
        <a class="adm-addbtn" href="#/new">
          <span class="material-symbols-outlined" style="font-size:20px">add</span>
          New PR
        </a>
      </div>
      <div id="tabBody"></div>
    </div>`;
  renderOverview(el.querySelector('#tabBody'), el, s);
}

/* ---------- Overview ---------- */
const joinTotals = t => t.length ? t.map(([c, v]) => fmtCompact(c, v)).join(' + ') : '—';

function renderOverview(body, root, s) {
  const me = s.me || { role: '', email: '', department: '' };
  const isApprover = me.role === 'approver';
  const isAdmin = me.role === 'admin';
  const isFinance = me.role === 'finance';
  const tabs = isApprover ? ['mine', 'dept', 'approved'] : isAdmin ? ['mine', 'all'] : isFinance ? ['mine', 'payments'] : ['mine'];
  if (!tabs.includes(UI.tab)) UI.tab = 'mine';
  const onDept = UI.tab === 'dept';
  const onApproved = UI.tab === 'approved';
  const onAll = UI.tab === 'all';
  const onPayments = UI.tab === 'payments';

  const mine = ownPrs(s.prs, me.email);
  const approved = isApprover ? approvedPrs(s.prs, me.email) : [];
  // every PR from the approver's own department, any status — so a PR an
  // admin decided on their behalf doesn't vanish from their view once it
  // leaves Submitted (it just won't be in "Approved by you" either, since
  // they didn't decide it)
  const deptPrs = isApprover ? prsForDept(s.prs, me.department) : [];
  // Finance is centralized, not department-scoped — one queue of every PO
  // still needing payment, across every department
  const paymentsQueue = isFinance ? pendingPayments(s.prs) : [];
  const base = onDept ? deptPrs : onApproved ? approved : onAll ? s.prs : onPayments ? paymentsQueue : mine;
  const k = kpis(base);
  const tiles = onPayments ? [
    // every PR here already matches KPI_FILTERS.unpaid by construction
    // (paymentsQueue = pendingPayments = filter(owesPayment)), so a separate
    // "Unpaid" tile would just repeat k.total — the useful breakdown is by
    // shipment stage instead
    { key: 'total', n: k.total, l: 'Awaiting payment', s: joinTotals(k.unpaidTotals) },
    { key: 'transit', n: k.inTransit, l: 'In transit', s: 'trackable shipments', cls: 'warn' },
    { key: 'received', n: k.receivedPct + '%', l: 'Received', s: k.received + ' of ' + k.total, cls: 'go' },
    { key: 'spend', n: k.spendTotals.length ? fmtCompact(...k.spendTotals[0]) : '—', l: 'Total value', s: k.spendTotals.length > 1 ? '+ ' + joinTotals(k.spendTotals.slice(1)) : '' }
  ] : onDept ? [
    { key: 'total', n: k.total, l: 'Department PRs', s: me.department ? 'in ' + me.department : '' },
    { key: 'pending', n: k.pending, l: 'Pending approval', s: 'awaiting decision', cls: 'warn' },
    { key: 'unpaid', n: k.unpaidCount, l: 'Unpaid', s: joinTotals(k.unpaidTotals), cls: 'bad' },
    { key: 'transit', n: k.inTransit, l: 'In transit', s: 'trackable shipments', cls: 'warn' },
    { key: 'received', n: k.receivedPct + '%', l: 'Received', s: k.received + ' of ' + k.total, cls: 'go' },
    { key: 'spend', n: k.spendTotals.length ? fmtCompact(...k.spendTotals[0]) : '—', l: 'Total spend', s: k.spendTotals.length > 1 ? '+ ' + joinTotals(k.spendTotals.slice(1)) : '' }
  ] : [
    { key: 'total', n: k.total, l: onApproved ? 'Approved PRs' : onAll ? 'All PRs' : 'Total PRs', s: onApproved ? 'across all requesters' : onAll ? 'every department' : '' },
    ...(onApproved ? [] : [{ key: 'pending', n: k.pending, l: 'Pending approval', s: 'awaiting approver', cls: 'warn' }]),
    { key: 'unpaid', n: k.unpaidCount, l: 'Unpaid', s: joinTotals(k.unpaidTotals), cls: 'bad' },
    { key: 'transit', n: k.inTransit, l: 'In transit', s: 'trackable shipments', cls: 'warn' },
    { key: 'received', n: k.receivedPct + '%', l: 'Received', s: k.received + ' of ' + k.total, cls: 'go' },
    { key: 'spend', n: k.spendTotals.length ? fmtCompact(...k.spendTotals[0]) : '—', l: onApproved ? 'Approved spend' : 'Total spend', s: k.spendTotals.length > 1 ? '+ ' + joinTotals(k.spendTotals.slice(1)) : '' }
  ];
  if (onAll) {
    for (const a of approvalStats(s.prs)) {
      tiles.push({ key: 'ap:' + a.email, n: a.count, l: 'Approved by ' + displayName(a.email), s: a.email, cls: 'go' });
    }
  }
  if (!tiles.some(t => t.key === UI.sel)) UI.sel = 'total';
  const rows = (UI.sel.startsWith('ap:')
    ? approvedPrs(s.prs, UI.sel.slice(3))
    : base.filter(KPI_FILTERS[UI.sel])
  ).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const selTile = tiles.find(t => t.key === UI.sel);

  // filter-bar option lists come from the tab's full base list, not the
  // narrower card selection, so switching cards doesn't shrink the dropdowns
  const depts = [...new Set(base.map(p => p.department).filter(Boolean))].sort();
  const vendors = [...new Set(base.map(p => p.vendor).filter(Boolean))].sort();
  if (UI.filters.dept && !depts.includes(UI.filters.dept)) UI.filters.dept = '';
  if (UI.filters.vendor && !vendors.includes(UI.filters.vendor)) UI.filters.vendor = '';
  const filtered = rows.filter(matchesFilters);
  const hasFilters = Object.values(UI.filters).some(Boolean);
  // admin: any status; approver: Approve/Reject dropdown, only while the PR
  // is still Submitted in their own department (their whole scope, per
  // status.js's matrix — everything past that decision, even reverting an
  // Approved PR, is admin-only now); else a read-only chip
  const sameDept = p => String(p.department || '').toLowerCase() === String(me.department || '').toLowerCase();
  const statusCell = p => {
    const opts = isAdmin ? STATUSES
      : isApprover && p.status === 'Submitted' && sameDept(p) ? APPROVAL_LOOP : null;
    if (!opts) return chip(p.status);
    return `<select class="status-sel" data-id="${esc(p.id)}">${opts.map(o =>
      `<option ${o === p.status ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  };
  const paymentStatusCell = p => `<select class="pay-sel" data-id="${esc(p.id)}">${PAYMENT_STATUSES.map(o =>
    `<option ${o === p.paymentStatus ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;

  body.innerHTML = `
    ${tabs.length > 1 ? `
    <div class="adm-tabs">
      <button class="adm-tab ${UI.tab === 'mine' ? 'active' : ''}" data-tab="mine">Your PRs</button>
      ${isApprover ? `<button class="adm-tab ${onDept ? 'active' : ''}" data-tab="dept">${esc(me.department || 'Your dept')} · ${deptPrs.length}</button>` : ''}
      ${isApprover ? `<button class="adm-tab ${onApproved ? 'active' : ''}" data-tab="approved">Approved by you · ${approved.length}</button>` : ''}
      ${isAdmin ? `<button class="adm-tab ${onAll ? 'active' : ''}" data-tab="all">All PRs · ${s.prs.length}</button>` : ''}
      ${isFinance ? `<button class="adm-tab ${onPayments ? 'active' : ''}" data-tab="payments">Awaiting payment · ${paymentsQueue.length}</button>` : ''}
    </div>` : ''}
    <div class="kpis">${tiles.map(t => `
      <div class="kpi clickable ${t.cls || ''} ${t.key === UI.sel ? 'sel' : ''}" data-key="${esc(t.key)}">
        <div class="v">${esc(String(t.n))}</div><div class="l">${esc(t.l)}</div><div class="s">${esc(t.s)}</div>
      </div>`).join('')}
    </div>
    <div class="card">
      <h2>${esc(selTile.l)} · ${filtered.length}</h2>
      <div class="filters">
        <input id="dashQ" type="search" autocomplete="off" spellcheck="false"
               placeholder="Search ID, item, vendor…" value="${esc(UI.filters.q)}">
        <select id="dashDept">
          <option value="">All departments</option>
          ${depts.map(d => `<option value="${esc(d)}" ${UI.filters.dept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
        </select>
        <select id="dashVendor">
          <option value="">All vendors</option>
          ${vendors.map(v => `<option value="${esc(v)}" ${UI.filters.vendor === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
        </select>
        <select id="dashStatus">
          <option value="">All statuses</option>
          ${STATUSES.map(st => `<option value="${esc(st)}" ${UI.filters.status === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
        </select>
        <input id="dashFrom" type="date" title="From date" value="${esc(UI.filters.from)}">
        <input id="dashTo" type="date" title="To date" value="${esc(UI.filters.to)}">
        ${hasFilters ? '<button type="button" class="btn" id="dashFilterClear">Clear filters</button>' : ''}
      </div>
      <table class="tbl"><thead><tr>
        ${onPayments
          ? '<th>ID</th><th>Date</th><th>Vendor</th><th>PO #</th><th>Payment term</th><th>Amount</th><th>Payment status</th>'
          : '<th>ID</th><th>Date</th><th>Dept</th><th>Item</th><th>Vendor</th><th>Amount</th><th>Status</th>'}
      </tr></thead><tbody>
        ${filtered.map(p => onPayments ? `<tr class="rowlink" data-id="${esc(p.id)}">
          <td style="font-family:var(--mono);font-size:12px">${esc(p.id)}</td>
          <td>${fmtDate(p.createdAt)}</td><td>${esc(p.vendor)}</td>
          <td style="font-family:var(--mono);font-size:12px">${p.poNo ? esc(p.poNo) : '—'}</td>
          <td>${p.paymentTerm ? esc(p.paymentTerm) : '—'}</td>
          <td>${p.amount ? esc(fmtCompact(p.currency || 'INR', Number(p.amount))) : '—'}</td>
          <td>${paymentStatusCell(p)}</td>
        </tr>` : `<tr class="rowlink" data-id="${esc(p.id)}">
          <td style="font-family:var(--mono);font-size:12px">${esc(p.id)}</td>
          <td>${fmtDate(p.createdAt)}</td><td>${esc(p.department)}</td>
          <td class="wrap">${esc(p.item)}</td><td>${esc(p.vendor)}</td>
          <td>${p.amount ? esc(fmtCompact(p.currency || 'INR', Number(p.amount))) : '—'}</td>
          <td>${statusCell(p)}</td>
        </tr>`).join('') || `<tr><td colspan="7" style="color:var(--mut)">No PRs match these filters.</td></tr>`}
      </tbody></table>
    </div>`;

  body.querySelectorAll('.adm-tab').forEach(b => b.onclick = () => {
    UI.tab = b.dataset.tab;
    UI.sel = 'total';
    rerender(root, s);
  });
  body.querySelectorAll('.kpi.clickable').forEach(elK => elK.onclick = () => {
    UI.sel = elK.dataset.key;
    rerender(root, s);
  });
  body.querySelectorAll('tr.rowlink').forEach(tr => tr.onclick = () => location.hash = '#/pr/' + tr.dataset.id);

  const setFilter = (key, val) => { UI.filters[key] = val; rerender(root, s); };
  body.querySelector('#dashQ').oninput = e => setFilter('q', e.target.value);
  body.querySelector('#dashDept').onchange = e => setFilter('dept', e.target.value);
  body.querySelector('#dashVendor').onchange = e => setFilter('vendor', e.target.value);
  body.querySelector('#dashStatus').onchange = e => setFilter('status', e.target.value);
  body.querySelector('#dashFrom').onchange = e => setFilter('from', e.target.value);
  body.querySelector('#dashTo').onchange = e => setFilter('to', e.target.value);
  const clearBtn = body.querySelector('#dashFilterClear');
  if (clearBtn) clearBtn.onclick = () => {
    UI.filters = { q: '', dept: '', vendor: '', status: '', from: '', to: '' };
    rerender(root, s);
  };
  body.querySelectorAll('.status-sel').forEach(sel => {
    sel.onclick = e => e.stopPropagation();
    sel.onchange = async () => {
      const id = sel.dataset.id;
      const p = s.prs.find(x => x.id === id);
      const to = sel.value;
      if (!p || to === p.status) return;
      if ((to === 'Rejected' || to === 'Cancelled') && !confirm(`Mark ${id} as ${to}?`)) {
        sel.value = p.status;
        return;
      }
      sel.disabled = true;
      try {
        // transition keeps approver/receipt stamps and lets the backend
        // enforce role/department (surfacing a clear error if denied); admin
        // falls back to a direct field write only for moves the matrix
        // never defined for any role (e.g. Received → On Hold)
        if (me.role === 'admin' && !hasEdge(p.status, to)) {
          await api('update', { id, updates: { status: to } });
        } else {
          await api('transition', { id, to });
        }
        toast(`${id} → ${to}`);
        store.refresh();
      } catch (err) {
        toast(err.message, true);
        sel.value = p.status;
        sel.disabled = false;
      }
    };
  });
  body.querySelectorAll('.pay-sel').forEach(sel => {
    sel.onclick = e => e.stopPropagation();
    sel.onchange = async () => {
      const id = sel.dataset.id;
      const p = s.prs.find(x => x.id === id);
      const to = sel.value;
      if (!p || to === p.paymentStatus) return;
      sel.disabled = true;
      try {
        await api('update', { id, updates: { paymentStatus: to } });
        toast(`${id} payment → ${to}`);
        store.refresh();
      } catch (err) {
        toast(err.message, true);
        sel.value = p.paymentStatus;
        sel.disabled = false;
      }
    };
  });
}
