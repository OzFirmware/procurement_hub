import { describe, it, expect } from 'vitest';
import { computeLineTotal, computeTotalAmount, itemSummary, qtySummary, decoratePrs } from '../src/lib/items.js';

describe('computeLineTotal', () => {
  it('multiplies qty × unitPrice to 2 decimals', () => {
    expect(computeLineTotal('3', '10.505')).toBe(31.52);
  });
  it('returns "" when qty or unitPrice missing/non-numeric', () => {
    expect(computeLineTotal('', '10')).toBe('');
    expect(computeLineTotal('2', '')).toBe('');
    expect(computeLineTotal('abc', '10')).toBe('');
  });
});

describe('computeTotalAmount', () => {
  it('sums numeric lineTotals', () => {
    expect(computeTotalAmount([{ lineTotal: 10 }, { lineTotal: '2.5' }])).toBe(12.5);
  });
  it('ignores blank lineTotals, returns "" when none numeric', () => {
    expect(computeTotalAmount([{ lineTotal: '' }, { lineTotal: 5 }])).toBe(5);
    expect(computeTotalAmount([{ lineTotal: '' }])).toBe('');
    expect(computeTotalAmount([])).toBe('');
  });
});

describe('itemSummary / qtySummary', () => {
  it('single item → description and "qty unit"', () => {
    expect(itemSummary([{ description: 'IPA' }])).toBe('IPA');
    expect(qtySummary([{ qty: '10', unit: 'L' }])).toBe('10 L');
  });
  it('multi item → "first (+N more)" and "N items"', () => {
    const items = [{ description: 'A', qty: '1' }, { description: 'B', qty: '2' }];
    expect(itemSummary(items)).toBe('A (+1 more)');
    expect(qtySummary(items)).toBe('2 items');
  });
  it('empty → ""', () => {
    expect(itemSummary([])).toBe('');
    expect(qtySummary([])).toBe('');
  });
});

describe('decoratePrs', () => {
  it('joins items by prId sorted by itemNo and maps compat fields', () => {
    const prs = [{ id: 'PR-1', totalAmount: '150' }, { id: 'PR-2', totalAmount: '' }];
    const items = [
      { prId: 'PR-1', itemNo: '2', description: 'B', qty: '1', unit: '', lineTotal: '50' },
      { prId: 'PR-1', itemNo: '1', description: 'A', qty: '2', unit: 'pcs', lineTotal: '100' }
    ];
    const out = decoratePrs(prs, items);
    expect(out[0].items.map(i => i.description)).toEqual(['A', 'B']);
    expect(out[0].amount).toBe('150');
    expect(out[0].item).toBe('A (+1 more)');
    expect(out[0].qty).toBe('2 items');
    expect(out[1].items).toEqual([]);
    expect(out[1].item).toBe('');
  });
});
