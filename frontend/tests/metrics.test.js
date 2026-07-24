import { describe, it, expect } from 'vitest';
import { kpis, currenciesOf, monthlyTrend, pipelineGroups, KPI_FILTERS, ownPrs, approvedPrs, approvalStats } from '../src/lib/metrics.js';

const PRS = [
  { id: 'a', status: 'Submitted', paymentStatus: 'Unpaid', amount: '100', currency: 'USD', createdAt: '2026-05-02', updatedAt: '2026-05-02T10:00:00Z' },
  { id: 'b', status: 'In Transit', paymentStatus: 'Paid', amount: '5000', currency: 'INR', createdAt: '2026-06-01', updatedAt: '2026-06-03T10:00:00Z' },
  { id: 'c', status: 'Received', paymentStatus: 'Unpaid', amount: '200', currency: 'USD', createdAt: '2026-06-05', updatedAt: '2026-06-09T10:00:00Z' },
  { id: 'd', status: 'Cancelled', paymentStatus: 'Unpaid', amount: '999', currency: 'USD', createdAt: '2026-06-06', updatedAt: '2026-06-07T10:00:00Z' },
  { id: 'e', status: 'Approved', paymentStatus: '', amount: '', currency: '', createdAt: '2026-06-20', updatedAt: '2026-06-21T10:00:00Z' },
  { id: 'f', status: 'Ordered', paymentStatus: 'Unpaid', amount: '50', currency: 'USD', createdAt: 'garbage', updatedAt: '2026-06-02T10:00:00Z' }
];

describe('kpis', () => {
  const k = kpis(PRS);
  it('counts totals and pending', () => {
    expect(k.total).toBe(6);
    expect(k.pending).toBe(1);
    expect(k.inTransit).toBe(1);
  });
  it('excludes Cancelled/Rejected from money totals', () => {
    expect(k.spendTotals).toEqual([['INR', 5000], ['USD', 350]]);
  });
  it('unpaid = paymentStatus Unpaid, excluding Cancelled/Rejected', () => {
    expect(k.unpaidCount).toBe(3); // a, c, f — not d (cancelled)
    expect(k.unpaidTotals).toEqual([['USD', 350]]);
  });
  it('received percentage', () => {
    expect(k.received).toBe(1);
    expect(k.receivedPct).toBe(17); // 1/6 rounded
  });
  it('handles empty input', () => {
    expect(kpis([]).receivedPct).toBe(0);
  });
});

describe('currenciesOf', () => {
  it('unique sorted currencies with numeric amounts only', () => {
    expect(currenciesOf(PRS)).toEqual(['INR', 'USD']);
  });
});

describe('monthlyTrend', () => {
  it('count includes everything with a parseable month', () => {
    expect(monthlyTrend(PRS, 'count')).toEqual([
      { month: '2026-05', value: 1 }, { month: '2026-06', value: 4 } // 'garbage' date dropped
    ]);
  });
  it('spend filters by currency and excludes Cancelled', () => {
    expect(monthlyTrend(PRS, 'spend', 'USD')).toEqual([
      { month: '2026-05', value: 100 }, { month: '2026-06', value: 200 }
    ]);
  });
  it('unpaid metric further requires paymentStatus Unpaid', () => {
    expect(monthlyTrend(PRS, 'unpaid', 'USD')).toEqual([
      { month: '2026-05', value: 100 }, { month: '2026-06', value: 200 }
    ]);
    expect(monthlyTrend(PRS, 'unpaid', 'INR')).toEqual([]);
  });
});

describe('KPI_FILTERS', () => {
  const ids = key => PRS.filter(KPI_FILTERS[key]).map(p => p.id);
  it('total keeps everything', () => expect(ids('total')).toEqual(['a', 'b', 'c', 'd', 'e', 'f']));
  it('pending = Submitted', () => expect(ids('pending')).toEqual(['a']));
  it('unpaid excludes Cancelled/Rejected', () => expect(ids('unpaid')).toEqual(['a', 'c', 'f']));
  it('transit = In Transit', () => expect(ids('transit')).toEqual(['b']));
  it('received = Received', () => expect(ids('received')).toEqual(['c']));
  it('spend = active PRs', () => expect(ids('spend')).toEqual(['a', 'b', 'c', 'e', 'f']));
});

describe('role scoping', () => {
  const PRS2 = [
    { id: 'x', requesterEmail: 'Alice@oizom.com', approverEmail: '', status: 'Submitted' },
    { id: 'y', requesterEmail: 'bob@oizom.com', approverEmail: 'priya.v@oizom.com', status: 'Approved' },
    { id: 'z', requesterEmail: 'alice@oizom.com', approverEmail: 'priya.v@oizom.com', status: 'Rejected' },
    { id: 'w', requesterEmail: 'bob@oizom.com', approverEmail: 'ankit@oizom.com', status: 'Received' }
  ];
  it('ownPrs matches requesterEmail case-insensitively', () => {
    expect(ownPrs(PRS2, 'alice@oizom.com').map(p => p.id)).toEqual(['x', 'z']);
  });
  it('approvedPrs = approverEmail match, Rejected excluded', () => {
    expect(approvedPrs(PRS2, 'priya.v@oizom.com').map(p => p.id)).toEqual(['y']);
  });
  it('approvalStats groups by approver, most first, no rejects', () => {
    expect(approvalStats(PRS2.concat([{ id: 'v', requesterEmail: 'a@b.c', approverEmail: 'ankit@oizom.com', status: 'Ordered' }])))
      .toEqual([{ email: 'ankit@oizom.com', count: 2 }, { email: 'priya.v@oizom.com', count: 1 }]);
  });
});

describe('pipelineGroups', () => {
  const g = pipelineGroups(PRS);
  it('groups by workflow stage', () => {
    expect(g.awaiting.map(p => p.id)).toEqual(['a']);
    expect(g.ready.map(p => p.id)).toEqual(['e']);
    expect(g.onHold).toEqual([]);
  });
  it('moving merges Ordered + In Transit, oldest updated first', () => {
    expect(g.moving.map(p => p.id)).toEqual(['f', 'b']);
  });
});
