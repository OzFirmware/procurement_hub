import { api } from '../api.js';
import { store } from '../state.js';
import { esc, chip, fmtDate, displayName, toast } from '../ui.js';
import { fmtCompact } from '../lib/currency.js';
import { kpis, KPI_FILTERS, ownPrs, approvedPrs, approvalStats } from '../lib/metrics.js';
import { canTransition, STATUSES } from '../lib/status.js';

// approver may revise a decision inline; later stages stay matrix-controlled
const APPROVAL_LOOP = ['Submitted', 'Approved', 'Rejected'];

const UI = { sel: 'total', tab: 'mine' };

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
  const me = s.me || { role: '', email: '' };
  const isApprover = me.role === 'approver';
  const isAdmin = me.role === 'admin';
  const tabs = isApprover ? ['mine', 'approved'] : isAdmin ? ['mine', 'all'] : ['mine'];
  if (!tabs.includes(UI.tab)) UI.tab = 'mine';
  const onApproved = UI.tab === 'approved';
  const onAll = UI.tab === 'all';

  const mine = ownPrs(s.prs, me.email);
  const approved = isApprover ? approvedPrs(s.prs, me.email) : [];
  const base = onApproved ? approved : onAll ? s.prs : mine;
  const k = kpis(base);
  const tiles = [
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
  // admin: any status; approver: approval-loop dropdown while PR is in it; else chip
  const statusCell = p => {
    const opts = isAdmin ? STATUSES
      : isApprover && APPROVAL_LOOP.includes(p.status) ? APPROVAL_LOOP : null;
    if (!opts) return chip(p.status);
    return `<select class="status-sel" data-id="${esc(p.id)}">${opts.map(o =>
      `<option ${o === p.status ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  };

  body.innerHTML = `
    ${tabs.length > 1 ? `
    <div class="adm-tabs">
      <button class="adm-tab ${UI.tab === 'mine' ? 'active' : ''}" data-tab="mine">Your PRs</button>
      ${isApprover ? `<button class="adm-tab ${onApproved ? 'active' : ''}" data-tab="approved">Approved by you · ${approved.length}</button>` : ''}
      ${isAdmin ? `<button class="adm-tab ${onAll ? 'active' : ''}" data-tab="all">All PRs · ${s.prs.length}</button>` : ''}
    </div>` : ''}
    <div class="kpis">${tiles.map(t => `
      <div class="kpi clickable ${t.cls || ''} ${t.key === UI.sel ? 'sel' : ''}" data-key="${esc(t.key)}">
        <div class="v">${esc(String(t.n))}</div><div class="l">${esc(t.l)}</div><div class="s">${esc(t.s)}</div>
      </div>`).join('')}
    </div>
    <div class="card">
      <h2>${esc(selTile.l)} · ${rows.length}</h2>
      <table class="tbl"><thead><tr>
        <th>ID</th><th>Date</th><th>Dept</th><th>Item</th><th>Vendor</th><th>Amount</th><th>Status</th>
      </tr></thead><tbody>
        ${rows.map(p => `<tr class="rowlink" data-id="${esc(p.id)}">
          <td style="font-family:var(--mono);font-size:12px">${esc(p.id)}</td>
          <td>${fmtDate(p.createdAt)}</td><td>${esc(p.department)}</td>
          <td class="wrap">${esc(p.item)}</td><td>${esc(p.vendor)}</td>
          <td>${p.amount ? esc(fmtCompact(p.currency || 'INR', Number(p.amount))) : '—'}</td>
          <td>${statusCell(p)}</td>
        </tr>`).join('') || `<tr><td colspan="7" style="color:var(--mut)">No PRs here yet.</td></tr>`}
      </tbody></table>
    </div>`;

  body.querySelectorAll('.adm-tab').forEach(b => b.onclick = () => {
    UI.tab = b.dataset.tab;
    UI.sel = 'total';
    dashboardView(root, s);
  });
  body.querySelectorAll('.kpi.clickable').forEach(elK => elK.onclick = () => {
    UI.sel = elK.dataset.key;
    dashboardView(root, s);
  });
  body.querySelectorAll('tr.rowlink').forEach(tr => tr.onclick = () => location.hash = '#/pr/' + tr.dataset.id);
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
        const isOwn = String(p.requesterEmail || '').toLowerCase() === me.email.toLowerCase();
        // transition keeps approver/receipt stamps; admin falls back to a
        // direct field write for moves the matrix doesn't cover
        if (canTransition(p.status, to, me.role, isOwn)) {
          await api('transition', { id, to });
        } else {
          await api('update', { id, updates: { status: to } });
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
}
