// Item math + the PR ⇄ Items client-side join.
// PRs carry money on `totalAmount` (server-computed) and descriptions on
// the Items tab. decoratePrs() maps that shape onto the legacy field names
// (amount, item, qty) so metrics/reports/dashboard consumers stay unchanged.

export function computeLineTotal(qty, unitPrice) {
  const q = Number(qty), u = Number(unitPrice);
  if (qty === '' || qty == null || unitPrice === '' || unitPrice == null) return '';
  if (!isFinite(q) || !isFinite(u)) return '';
  return Math.round(q * u * 100) / 100;
}

export function computeTotalAmount(items) {
  let sum = 0, any = false;
  for (const it of items) {
    const n = Number(it.lineTotal);
    if (it.lineTotal !== '' && it.lineTotal != null && isFinite(n)) { sum += n; any = true; }
  }
  return any ? Math.round(sum * 100) / 100 : '';
}

export function itemSummary(items) {
  if (!items.length) return '';
  const first = items[0].description || '';
  return items.length > 1 ? `${first} (+${items.length - 1} more)` : first;
}

export function qtySummary(items) {
  if (!items.length) return '';
  if (items.length === 1) return [items[0].qty, items[0].unit].filter(Boolean).join(' ');
  return items.length + ' items';
}

export function decoratePrs(prs, items) {
  const byPr = {};
  for (const it of items) (byPr[it.prId] = byPr[it.prId] || []).push(it);
  for (const k in byPr) byPr[k].sort((a, b) => Number(a.itemNo) - Number(b.itemNo));
  return prs.map(p => {
    const its = byPr[p.id] || [];
    return { ...p, items: its, amount: p.totalAmount, item: itemSummary(its), qty: qtySummary(its) };
  });
}
