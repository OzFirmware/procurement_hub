import { describe, it, expect } from 'vitest';
import { kpis, currenciesOf, monthlyTrend, pipelineGroups, KPI_FILTERS, ownPrs, approvedPrs, approvalStats, prsForDept, pendingPayments } from '../src/lib/metrics.js';

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
  it('unpaid = Ordered/In Transit/Received and not fully Paid — a PO must exist', () => {
    expect(k.unpaidCount).toBe(2); // c, f — not a (Submitted, no PO yet), not b (Paid), not d (cancelled)
    expect(k.unpaidTotals).toEqual([['USD', 250]]);
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
  it('unpaid requires a PO stage (Ordered/In Transit/Received) and not fully Paid', () => expect(ids('unpaid')).toEqual(['c', 'f']));
  it('transit = In Transit', () => expect(ids('transit')).toEqual(['b']));
  it('received = Received', () => expect(ids('received')).toEqual(['c']));
  it('spend = active PRs', () => expect(ids('spend')).toEqual(['a', 'b', 'c', 'e', 'f']));
  // regression: this is the exact "admin Unpaid KPI vs Finance's Awaiting
  // payment queue" mismatch a user reported — they must always agree because
  // they're now the same predicate (see owesPayment in metrics.js)
  it('agrees with pendingPayments on every PR — no admin/Finance mismatch', () => {
    expect(PRS.filter(KPI_FILTERS.unpaid).map(p => p.id)).toEqual(pendingPayments(PRS).map(p => p.id));
  });
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

describe('prsForDept', () => {
  const PRS3 = [
    { id: 'p1', department: 'R&D', status: 'Submitted' },
    { id: 'p2', department: 'R&D', status: 'Approved' },
    { id: 'p3', department: 'projects', status: 'Submitted' },
    { id: 'p4', department: 'R&D', status: 'Submitted' }
  ];
  it('matches department case-insensitively, any status', () => {
    expect(prsForDept(PRS3, 'r&d').map(p => p.id)).toEqual(['p1', 'p2', 'p4']);
  });
  it('includes a PR someone else (e.g. an admin) already decided', () => {
    expect(prsForDept(PRS3, 'R&D').map(p => p.id)).toContain('p2');
  });
  it('empty department yields nothing', () => {
    expect(prsForDept(PRS3, '')).toEqual([]);
  });
});

describe('pendingPayments', () => {
  const PRS4 = [
    { id: 'q1', status: 'Ordered', paymentStatus: 'Unpaid' },
    { id: 'q2', status: 'Ordered', paymentStatus: 'Paid' },
    { id: 'q3', status: 'In Transit', paymentStatus: 'Partially Paid' },
    { id: 'q4', status: 'Received', paymentStatus: '' },
    { id: 'q5', status: 'Approved', paymentStatus: 'Unpaid' }, // no PO yet — not Finance's queue
    { id: 'q6', status: 'Submitted', paymentStatus: 'Unpaid' }
  ];
  it('includes Ordered/In Transit/Received PRs that are not fully Paid', () => {
    expect(pendingPayments(PRS4).map(p => p.id)).toEqual(['q1', 'q3', 'q4']);
  });
  it('excludes PRs with no PO yet, regardless of payment status', () => {
    expect(pendingPayments(PRS4).map(p => p.id)).not.toContain('q5');
    expect(pendingPayments(PRS4).map(p => p.id)).not.toContain('q6');
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
