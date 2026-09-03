import { describe, it, expect } from 'vitest';
import { vendorStats, vendorBadge, vendorPrs } from '../src/lib/vendorStats.js';

const PRS = [
  { id: 'a', vendor: 'Amazon.in', status: 'Received', paymentStatus: 'Paid', amount: '1000', currency: 'INR', createdAt: '2026-06-10' },
  { id: 'b', vendor: 'amazon.IN', status: 'Ordered', paymentStatus: 'Unpaid', amount: '250', currency: 'INR', createdAt: '2026-07-01' },
  { id: 'c', vendor: 'Amazon.in', status: 'Cancelled', paymentStatus: 'Unpaid', amount: '999', currency: 'INR', createdAt: '2026-07-10' },
  { id: 'd', vendor: 'digikey.in', status: 'Ordered', paymentStatus: 'Unpaid', amount: '50', currency: 'USD', createdAt: '2026-05-20' },
  { id: 'e', vendor: 'digikey.in', status: 'Received', paymentStatus: 'Paid', amount: '300', currency: 'INR', createdAt: '2026-04-01' },
  { id: 'f', vendor: 'NoAmt', status: 'Approved', paymentStatus: '', amount: '', currency: '', createdAt: 'garbage' }
];

describe('vendorPrs', () => {
  it('matches vendor name case-insensitively', () => {
    expect(vendorPrs(PRS, 'AMAZON.IN')).toHaveLength(3);
  });
  it('returns empty for unknown vendor', () => {
    expect(vendorPrs(PRS, 'ghost')).toEqual([]);
  });
});

describe('vendorStats', () => {
  it('counts all PRs but excludes Cancelled/Rejected from spend', () => {
    const k = vendorStats(PRS, 'Amazon.in');
    expect(k.count).toBe(3);
    expect(k.spendTotals).toEqual([['INR', 1250]]);
  });
  it('counts unpaid on active PRs only (cancelled unpaid excluded)', () => {
    expect(vendorStats(PRS, 'Amazon.in').unpaid).toBe(1);
  });
  it('sorts multi-currency spend by total desc', () => {
    expect(vendorStats(PRS, 'digikey.in').spendTotals).toEqual([['INR', 300], ['USD', 50]]);
  });
  it('takes last order from valid dates only', () => {
    expect(vendorStats(PRS, 'Amazon.in').lastOrder).toBe('2026-07-10');
    expect(vendorStats(PRS, 'NoAmt').lastOrder).toBe('');
  });
  it('handles vendor with no PRs', () => {
    expect(vendorStats(PRS, 'ghost')).toEqual({ count: 0, spendTotals: [], unpaid: 0, lastOrder: '' });
  });
});

describe('vendorBadge', () => {
  it('uses type field when set', () => {
    expect(vendorBadge({ name: 'x', type: 'Domestic' }, PRS)).toBe('Domestic');
    expect(vendorBadge({ name: 'x', type: 'International' }, PRS)).toBe('Foreign');
  });
  it('derives Domestic from all-INR PRs when type empty', () => {
    expect(vendorBadge({ name: 'Amazon.in', type: '' }, PRS)).toBe('Domestic');
  });
  it('derives Mixed from INR + foreign PRs', () => {
    expect(vendorBadge({ name: 'digikey.in', type: '' }, PRS)).toBe('Mixed');
  });
  it('derives Foreign when no INR PRs', () => {
    const prs = [{ vendor: 'sem', status: 'Ordered', amount: '10', currency: 'USD' }];
    expect(vendorBadge({ name: 'sem', type: '' }, prs)).toBe('Foreign');
  });
  it('returns empty when no type and no priced PRs', () => {
    expect(vendorBadge({ name: 'ghost', type: '' }, PRS)).toBe('');
    expect(vendorBadge({ name: 'NoAmt', type: '' }, PRS)).toBe('');
  });
});
