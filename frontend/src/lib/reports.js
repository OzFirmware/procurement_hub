const ACTIVE = ['Submitted', 'Approved', 'Ordered', 'In Transit', 'On Hold'];
const DAY = 86400000;

export function spendBy(prs, keyFn) {
  const out = {};
  for (const p of prs) {
    const amt = Number(p.amount);
    if (!p.amount || !isFinite(amt)) continue;
    const k = keyFn(p) || '—';
    const cur = p.currency || 'Unknown';
    (out[k] = out[k] || {})[cur] = (out[k][cur] || 0) + amt;
  }
  return out;
}

export function spendByMonth(prs) {
  return spendBy(prs, p => String(p.createdAt || '').slice(0, 7));
}

export function statusCounts(prs) {
  const out = {};
  for (const p of prs) out[p.status] = (out[p.status] || 0) + 1;
  return out;
}

export function aging(prs, nowMs) {
  return prs
    .filter(p => ACTIVE.includes(p.status))
    .map(p => ({ ...p, daysInStatus: Math.floor((nowMs - Date.parse(p.updatedAt || p.createdAt)) / DAY) }))
    .sort((a, b) => b.daysInStatus - a.daysInStatus);
}

export function vendorPerformance(prs) {
  const map = {};
  for (const p of prs) {
    if (!p.vendor) continue;
    const v = map[p.vendor] = map[p.vendor] || { vendor: p.vendor, orders: 0, received: 0, delayed: 0, _days: [] };
    v.orders++;
    if (p.status === 'Received' && p.receivedAt) {
      v.received++;
      if (p.approvedAt) v._days.push((Date.parse(p.receivedAt) - Date.parse(p.approvedAt)) / DAY);
      if (p.expectedDate && Date.parse(p.receivedAt) > Date.parse(p.expectedDate)) v.delayed++;
    }
  }
  return Object.values(map).map(v => ({
    vendor: v.vendor, orders: v.orders, received: v.received, delayed: v.delayed,
    avgDays: v._days.length ? Math.round(v._days.reduce((a, b) => a + b, 0) / v._days.length) : null
  })).sort((a, b) => b.orders - a.orders);
}

export function toCSV(rows, cols) {
  const escape = v => {
    let s = v == null ? '' : String(v);
    // Neutralize CSV formula injection: a leading =, +, -, or @ makes
    // Excel/Sheets execute the cell as a formula on open.
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.map(c => escape(c.label)).join(',')];
  for (const r of rows) lines.push(cols.map(c => escape(r[c.key])).join(','));
  return lines.join('\r\n');
}

export function spendByMaterialType(prs) {
  const out = {};
  for (const p of prs) {
    const cur = p.currency || 'Unknown';
    for (const it of p.items || []) {
      const n = Number(it.lineTotal);
      if (it.lineTotal === '' || it.lineTotal == null || !isFinite(n)) continue;
      const k = it.materialType || '—';
      (out[k] = out[k] || {})[cur] = (out[k][cur] || 0) + n;
    }
  }
  return out;
}
