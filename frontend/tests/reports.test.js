import { describe, it, expect } from 'vitest';
import { spendBy, spendByMonth, spendByMaterialType, statusCounts, aging, vendorPerformance, toCSV } from '../src/lib/reports.js';

const PRS = [
  { id: 'PR-2026-0001', department: 'R&D', vendor: 'Mouser', amount: 100, currency: 'USD', status: 'Received', createdAt: '2026-05-02', approvedAt: '2026-05-03', receivedAt: '2026-05-10', expectedDate: '2026-05-08', updatedAt: '2026-05-10T10:00:00Z' },
  { id: 'PR-2026-0002', department: 'R&D', vendor: 'Robu', amount: 5000, currency: 'INR', status: 'Ordered', createdAt: '2026-06-01', approvedAt: '2026-06-02', receivedAt: '', expectedDate: '', updatedAt: '2026-06-02T10:00:00Z' },
  { id: 'PR-2026-0003', department: 'Production', vendor: 'Mouser', amount: 200, currency: 'USD', status: 'Received', createdAt: '2026-06-05', approvedAt: '2026-06-06', receivedAt: '2026-06-09', expectedDate: '2026-06-12', updatedAt: '2026-06-09T10:00:00Z' },
  { id: 'PR-2026-0004', department: 'Production', vendor: '', amount: '', currency: '', status: 'Submitted', createdAt: '2026-06-20', approvedAt: '', receivedAt: '', expectedDate: '', updatedAt: '2026-06-20T10:00:00Z' }
];

describe('spendBy', () => {
  it('groups amounts per key per currency, skips blank amounts', () => {
    const r = spendBy(PRS, p => p.department);
    expect(r['R&D']).toEqual({ USD: 100, INR: 5000 });
    expect(r['Production']).toEqual({ USD: 200 });
  });
});

describe('spendByMonth', () => {
  it('keys by YYYY-MM of createdAt', () => {
    const r = spendByMonth(PRS);
    expect(Object.keys(r).sort()).toEqual(['2026-05', '2026-06']);
    expect(r['2026-06']).toEqual({ INR: 5000, USD: 200 });
  });
});

describe('statusCounts', () => {
  it('counts each status', () => {
    expect(statusCounts(PRS)).toEqual({ Received: 2, Ordered: 1, Submitted: 1 });
  });
});

describe('aging', () => {
  it('returns active PRs with days in current status, oldest first', () => {
    const now = Date.parse('2026-07-07T10:00:00Z');
    const rows = aging(PRS, now);
    expect(rows.map(r => r.id)).toEqual(['PR-2026-0002', 'PR-2026-0004']);
    expect(rows[0].daysInStatus).toBe(35);
  });
});

describe('vendorPerformance', () => {
  it('computes avg delivery days and delayed count from received PRs', () => {
    const r = vendorPerformance(PRS);
    const mouser = r.find(v => v.vendor === 'Mouser');
    expect(mouser.received).toBe(2);
    expect(mouser.avgDays).toBe(5); // (7 + 3) / 2
    expect(mouser.delayed).toBe(1); // PR-0001 received after expectedDate
  });
});

describe('toCSV', () => {
  it('escapes quotes and commas', () => {
    const csv = toCSV([{ a: 'x,y', b: 'he said "hi"' }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
    expect(csv).toBe('A,B\r\n"x,y","he said ""hi"""');
  });

  it('neutralizes leading formula characters to prevent CSV injection', () => {
    const csv = toCSV([{ a: '=SUM(A1)' }], [{ key: 'a', label: 'A' }]);
    expect(csv).toBe("A\r\n'=SUM(A1)");
  });
});

describe('spendByMaterialType', () => {
  it('sums item lineTotals by materialType in PR currency', () => {
    const prs = [
      { currency: 'INR', items: [
        { materialType: 'Asset', lineTotal: '100' },
        { materialType: 'Inventory', lineTotal: '50' }
      ]},
      { currency: 'USD', items: [{ materialType: 'Asset', lineTotal: '10' }] },
      { currency: 'INR', items: [{ materialType: '', lineTotal: '' }] }
    ];
    expect(spendByMaterialType(prs)).toEqual({
      Asset: { INR: 100, USD: 10 },
      Inventory: { INR: 50 }
    });
  });
});
