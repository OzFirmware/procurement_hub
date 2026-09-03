// Pure dashboard aggregations. Money is never summed across currencies.
const EXCLUDED = ['Cancelled', 'Rejected'];

// A PR is only actually "unpaid" once there's something to pay — a PO has
// been made (status has reached Ordered or later) and it isn't fully Paid.
// paymentStatus defaults to 'Unpaid' at creation for every PR (see prs.gs
// create), well before a PO exists, so matching on paymentStatus alone
// flagged Submitted/Approved PRs as owing money when nothing had been
// ordered yet — the exact mismatch between the admin "Unpaid" KPI and
// Finance's "Awaiting payment" queue that this predicate fixes by being the
// one definition both use.
const POST_APPROVAL = ['Ordered', 'In Transit', 'Received'];
const owesPayment = p => POST_APPROVAL.includes(p.status) && p.paymentStatus !== 'Paid';

function curTotals(prs) {
  const t = {};
  for (const p of prs) {
    const amt = Number(p.amount);
    if (!p.amount || !isFinite(amt)) continue;
    const cur = p.currency || 'Unknown';
    t[cur] = (t[cur] || 0) + amt;
  }
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
}

export function kpis(prs) {
  const active = prs.filter(p => !EXCLUDED.includes(p.status));
  const unpaid = prs.filter(owesPayment);
  const received = prs.filter(p => p.status === 'Received').length;
  return {
    total: prs.length,
    pending: prs.filter(p => p.status === 'Submitted').length,
    unpaidCount: unpaid.length,
    unpaidTotals: curTotals(unpaid),
    inTransit: prs.filter(p => p.status === 'In Transit').length,
    received,
    receivedPct: Math.round(received / (prs.length || 1) * 100),
    spendTotals: curTotals(active)
  };
}

// card key → predicate; drives the dashboard card-as-filter behavior
export const KPI_FILTERS = {
  total: () => true,
  pending: p => p.status === 'Submitted',
  unpaid: owesPayment,
  transit: p => p.status === 'In Transit',
  received: p => p.status === 'Received',
  spend: p => !EXCLUDED.includes(p.status)
};

export function ownPrs(prs, email) {
  const e = String(email || '').toLowerCase();
  return prs.filter(p => String(p.requesterEmail || '').toLowerCase() === e);
}

// "approved" = this approver decided it and it wasn't a rejection
export function approvedPrs(prs, email) {
  const e = String(email || '').toLowerCase();
  return prs.filter(p => String(p.approverEmail || '').toLowerCase() === e && e && p.status !== 'Rejected');
}

// Every PR from `department`, any status — lets that department's approver
// track a request end to end even after someone else (e.g. an admin acting
// on their behalf) decided it, not just the ones still awaiting a decision.
export function prsForDept(prs, department) {
  const d = String(department || '').toLowerCase();
  return prs.filter(p => String(p.department || '').toLowerCase() === d);
}

// PRs that have a PO (moved past Approved) and aren't fully paid yet — the
// queue Finance works from, independent of department. Same predicate as
// KPI_FILTERS.unpaid, so Finance's queue and the "Unpaid" KPI card never disagree.
export function pendingPayments(prs) {
  return prs.filter(owesPayment);
}

export function approvalStats(prs) {
  const by = {};
  for (const p of prs) {
    const e = String(p.approverEmail || '').toLowerCase();
    if (!e || p.status === 'Rejected') continue;
    by[e] = (by[e] || 0) + 1;
  }
  return Object.entries(by).map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count || a.email.localeCompare(b.email));
}

export function currenciesOf(prs) {
  return [...new Set(
    prs.filter(p => p.amount && isFinite(Number(p.amount))).map(p => p.currency || 'Unknown')
  )].sort();
}

export function monthlyTrend(prs, metric, currency) {
  const months = {};
  for (const p of prs) {
    const m = String(p.createdAt || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) continue;
    let v;
    if (metric === 'count') {
      v = 1;
    } else {
      if (EXCLUDED.includes(p.status)) continue;
      if (metric === 'unpaid' && p.paymentStatus !== 'Unpaid') continue;
      const amt = Number(p.amount);
      if (!p.amount || !isFinite(amt)) continue;
      if ((p.currency || 'Unknown') !== currency) continue;
      v = amt;
    }
    months[m] = (months[m] || 0) + v;
  }
  return Object.keys(months).sort().map(month => ({ month, value: months[month] }));
}

// Total spend per department, in ONE currency at a time — money is never
// summed across currencies (see currenciesOf). Cancelled/Rejected excluded,
// same rule as kpis().spendTotals.
export function spendByDept(prs, currency) {
  const t = {};
  for (const p of prs) {
    if (EXCLUDED.includes(p.status)) continue;
    if ((p.currency || 'Unknown') !== currency) continue;
    const amt = Number(p.amount);
    if (!p.amount || !isFinite(amt)) continue;
    const d = p.department || 'Unassigned';
    t[d] = (t[d] || 0) + amt;
  }
  return Object.entries(t).map(([department, total]) => ({ department, total }))
    .sort((a, b) => b.total - a.total);
}

// Top N vendors by spend, ONE currency at a time; everyone past N folds
// into a single "Other" row so a long tail doesn't crowd out the chart.
export function spendByVendor(prs, currency, topN = 6) {
  const t = {};
  for (const p of prs) {
    if (EXCLUDED.includes(p.status)) continue;
    if ((p.currency || 'Unknown') !== currency) continue;
    const amt = Number(p.amount);
    if (!p.amount || !isFinite(amt)) continue;
    const v = p.vendor || 'Unspecified';
    t[v] = (t[v] || 0) + amt;
  }
  const rows = Object.entries(t).map(([vendor, total]) => ({ vendor, total }))
    .sort((a, b) => b.total - a.total);
  if (rows.length <= topN) return rows;
  const rest = rows.slice(topN).reduce((s, r) => s + r.total, 0);
  return [...rows.slice(0, topN), { vendor: 'Other', total: rest }];
}

// {status: count} for every PR, no filtering — a distribution chart draws
// this against the full STATUSES list so an empty status still gets a bar.
export function statusCounts(prs) {
  const by = {};
  for (const p of prs) by[p.status] = (by[p.status] || 0) + 1;
  return by;
}

// The two waits a requester actually feels: how long a decision takes, and
// how long delivery takes once ordered. Only counts PRs that completed that
// step — an in-flight PR has no end timestamp yet and would just drag a
// running average toward zero if it were counted as 0 days.
export function cycleTimes(prs) {
  const daysBetween = (from, to) => {
    const t1 = Date.parse(from), t2 = Date.parse(to);
    return isFinite(t1) && isFinite(t2) ? (t2 - t1) / 86400000 : null;
  };
  const avg = arr => arr.length ? arr.reduce((s, d) => s + d, 0) / arr.length : null;
  const approvalDays = prs
    .map(p => p.createdAt && p.approvedAt ? daysBetween(p.createdAt, p.approvedAt) : null)
    .filter(d => d != null && d >= 0);
  const deliveryDays = prs
    .map(p => p.poDate && p.receivedAt ? daysBetween(p.poDate, p.receivedAt) : null)
    .filter(d => d != null && d >= 0);
  return {
    avgApprovalDays: avg(approvalDays), approvalSamples: approvalDays.length,
    avgDeliveryDays: avg(deliveryDays), deliverySamples: deliveryDays.length
  };
}

// Unpaid POs bucketed by how long they've been waiting, since poDate (or the
// last update if that's missing) — the aging breakdown Finance needs, not
// just a single total. Buckets are cumulative-exclusive and always all four,
// so a quiet bucket still renders as zero rather than disappearing.
const AGING_BUCKETS = [
  { key: '0-7', label: '0–7 days', min: 0, max: 7 },
  { key: '8-14', label: '8–14 days', min: 8, max: 14 },
  { key: '15-30', label: '15–30 days', min: 15, max: 30 },
  { key: '30+', label: '30+ days', min: 31, max: Infinity }
];
export function agingUnpaid(prs, now = Date.now()) {
  const buckets = AGING_BUCKETS.map(b => ({ ...b, count: 0 }));
  prs.filter(owesPayment).forEach(p => {
    const since = Date.parse(p.poDate || p.updatedAt || p.createdAt);
    if (!isFinite(since)) return;
    const ageDays = (now - since) / 86400000;
    (buckets.find(b => ageDays >= b.min && ageDays <= b.max) || buckets[buckets.length - 1]).count++;
  });
  return buckets;
}

export function pipelineGroups(prs) {
  const by = s => prs.filter(p => p.status === s);
  const age = p => Date.parse(p.updatedAt || p.createdAt) || 0;
  const sortOld = arr => [...arr].sort((a, b) => age(a) - age(b));
  return {
    awaiting: sortOld(by('Submitted')),
    ready: sortOld(by('Approved')),
    moving: sortOld([...by('Ordered'), ...by('In Transit')]),
    onHold: sortOld(by('On Hold'))
  };
}
