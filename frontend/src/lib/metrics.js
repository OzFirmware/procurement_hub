// Pure dashboard aggregations. Money is never summed across currencies.
const EXCLUDED = ['Cancelled', 'Rejected'];

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
  const unpaid = active.filter(p => p.paymentStatus === 'Unpaid');
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
  unpaid: p => !EXCLUDED.includes(p.status) && p.paymentStatus === 'Unpaid',
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
