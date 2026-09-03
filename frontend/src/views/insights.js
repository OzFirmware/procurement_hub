import { esc } from '../ui.js';
import { fmtCompact } from '../lib/currency.js';
import {
  prsForDept, currenciesOf, monthlyTrend, spendByDept, spendByVendor,
  statusCounts, cycleTimes, agingUnpaid
} from '../lib/metrics.js';
import { barListHtml, lineChartSvg } from '../lib/charts.js';

// Presentation order (progression, then terminal states last) — distinct
// from status.js's STATUSES, which orders by the transition matrix instead.
const STATUS_ORDER = ['Submitted', 'Approved', 'Ordered', 'In Transit', 'Received', 'On Hold', 'Rejected', 'Cancelled'];
// Mirrors the chip colors in styles.css (.chip.Approved etc.) so a status
// means the same color everywhere in the app.
const STATUS_COLOR = {
  Submitted: 'var(--blue)', Approved: 'var(--brand)', Ordered: 'var(--amber)',
  'In Transit': 'var(--amber)', Received: 'var(--brand)', 'On Hold': 'var(--mut)',
  Rejected: 'var(--red)', Cancelled: 'var(--red)'
};
const AGING_COLOR = { '0–7 days': 'var(--brand)', '8–14 days': 'var(--brand)', '15–30 days': 'var(--amber)', '30+ days': 'var(--red)' };

// Survives the re-render every currency switch triggers, same pattern as
// dashboard.js's UI object.
const UI = { currency: '' };

export function insightsView(el, s) {
  const me = s.me || { role: '', department: '' };
  const isApprover = me.role === 'approver';
  // An approver only ever sees their own department's PRs elsewhere in the
  // app (see prsForDept in dashboard.js) — insights stay within that same
  // boundary rather than exposing company-wide numbers to them.
  const scope = isApprover ? prsForDept(s.prs, me.department) : (s.prs || []);

  const currencies = currenciesOf(scope);
  if (!currencies.includes(UI.currency)) UI.currency = currencies[0] || '';
  const cur = UI.currency;
  const fmt = n => cur ? fmtCompact(cur, n) : String(n);

  const trend = cur ? monthlyTrend(scope, 'spend', cur) : [];
  const volumeTrend = monthlyTrend(scope, 'count');
  const vendorRows = cur ? spendByVendor(scope, cur, 6).map(r => ({ label: r.vendor, value: r.total })) : [];
  // one department in scope for an approver — a ranking of one bar isn't insight
  const deptRows = !isApprover && cur ? spendByDept(scope, cur).map(r => ({ label: r.department, value: r.total })) : [];
  const counts = statusCounts(scope);
  const statusRows = STATUS_ORDER.filter(st => counts[st]).map(st => ({ label: st, value: counts[st] }));
  const ct = cycleTimes(scope);
  const aging = agingUnpaid(scope);
  const agingRows = aging.map(b => ({ label: b.label, value: b.count }));
  const unpaidCount = aging.reduce((sum, b) => sum + b.count, 0);
  const totalSpend = trend.reduce((sum, p) => sum + p.value, 0);

  el.innerHTML = `
    <div class="dash">
      <div class="adm-head">
        <div>
          <h1>Insights</h1>
          <p>${isApprover
            ? `Spend and cycle-time trends for ${esc(me.department || 'your department')}.`
            : 'Spend, vendor and cycle-time trends across every purchase request.'}</p>
        </div>
        ${currencies.length > 1 ? `<select id="insCur">${currencies.map(c =>
          `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}
      </div>

      <div class="kpis">
        <div class="kpi"><div class="v">${cur ? esc(fmt(totalSpend)) : '—'}</div><div class="l">Total spend${cur ? ' · ' + esc(cur) : ''}</div></div>
        <div class="kpi"><div class="v">${ct.avgApprovalDays != null ? ct.avgApprovalDays.toFixed(1) + 'd' : '—'}</div>
          <div class="l">Avg. time to decide</div></div>
        <div class="kpi"><div class="v">${ct.avgDeliveryDays != null ? ct.avgDeliveryDays.toFixed(1) + 'd' : '—'}</div>
          <div class="l">Avg. PO to delivery</div></div>
        <div class="kpi ${unpaidCount ? 'warn' : ''}"><div class="v">${unpaidCount}</div><div class="l">Unpaid POs awaiting payment</div></div>
      </div>

      <div class="card">
        <h2>Monthly spend${cur ? ' · ' + esc(cur) : ''}</h2>
        <div class="pd-body">${cur ? lineChartSvg(trend, { valueFmt: v => fmtCompact(cur, v) }) : '<div class="chart-empty">No priced purchase requests yet.</div>'}</div>
      </div>

      <div class="adm-grid2">
        ${deptRows.length ? `<div class="card"><h2>Spend by department${cur ? ' · ' + esc(cur) : ''}</h2>
          <div class="pd-body">${barListHtml(deptRows, { valueFmt: fmt })}</div></div>` : ''}
        <div class="card"><h2>Top vendors${cur ? ' · ' + esc(cur) : ''}</h2>
          <div class="pd-body">${barListHtml(vendorRows, { valueFmt: fmt })}</div></div>
      </div>

      <div class="adm-grid2">
        <div class="card"><h2>Requests by status</h2>
          <div class="pd-body">${barListHtml(statusRows, { colorOf: r => STATUS_COLOR[r.label] || 'var(--mut)' })}</div></div>
        <div class="card"><h2>Unpaid PO aging</h2>
          <div class="pd-body">${barListHtml(agingRows, { colorOf: r => AGING_COLOR[r.label] || 'var(--brand)' })}</div></div>
      </div>

      <div class="card">
        <h2>Request volume, by month</h2>
        <div class="pd-body">${lineChartSvg(volumeTrend, { valueFmt: v => v + ' PR' + (v === 1 ? '' : 's') })}</div>
      </div>
    </div>`;

  const curSel = el.querySelector('#insCur');
  if (curSel) curSel.onchange = () => { UI.currency = curSel.value; insightsView(el, s); };
}
