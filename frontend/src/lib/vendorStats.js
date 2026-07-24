import { KPI_FILTERS } from './metrics.js';

// Per-vendor PR aggregation for vendor cards. Money is never summed across
// currencies. PR↔vendor join is the raw name string, case-insensitive.

export function vendorPrs(prs, name) {
  const n = String(name || '').toLowerCase();
  return prs.filter(p => String(p.vendor || '').toLowerCase() === n);
}

export function vendorStats(prs, name) {
  const mine = vendorPrs(prs, name);
  const active = mine.filter(KPI_FILTERS.spend);
  const t = {};
  for (const p of active) {
    const amt = Number(p.amount);
    if (!p.amount || !isFinite(amt)) continue;
    const cur = p.currency || 'INR';
    t[cur] = (t[cur] || 0) + amt;
  }
  return {
    count: mine.length,
    spendTotals: Object.entries(t).sort((a, b) => b[1] - a[1]),
    unpaid: mine.filter(KPI_FILTERS.unpaid).length,
    lastOrder: mine.reduce((m, p) => {
      const d = String(p.createdAt || '');
      return /^\d{4}-\d{2}-\d{2}/.test(d) && d > m ? d : m;
    }, '')
  };
}

export function vendorBadge(vendor, prs) {
  if (vendor.type === 'Domestic') return 'Domestic';
  if (vendor.type === 'International') return 'Foreign';
  const curs = new Set(vendorPrs(prs, vendor.name)
    .filter(p => p.amount && isFinite(Number(p.amount)))
    .map(p => p.currency || 'INR'));
  if (!curs.size) return '';
  const hasInr = curs.has('INR');
  const hasFx = [...curs].some(c => c !== 'INR');
  return hasInr && hasFx ? 'Mixed' : hasFx ? 'Foreign' : 'Domestic';
}
