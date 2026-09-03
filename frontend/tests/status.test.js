import { describe, it, expect } from 'vitest';
import { canTransition, nextStates, hasEdge, STATUSES } from '../src/lib/status.js';

describe('canTransition', () => {
  it('same-department approver approves/rejects submitted PRs', () => {
    expect(canTransition('Submitted', 'Approved', 'approver', false, true)).toBe(true);
    expect(canTransition('Submitted', 'Rejected', 'approver', false, true)).toBe(true);
  });
  it('a different-department approver cannot approve/reject', () => {
    expect(canTransition('Submitted', 'Approved', 'approver', false, false)).toBe(false);
    expect(canTransition('Submitted', 'Rejected', 'approver', false, false)).toBe(false);
  });
  it('admin approves/rejects regardless of department', () => {
    expect(canTransition('Submitted', 'Approved', 'admin', false, false)).toBe(true);
    expect(canTransition('Submitted', 'Rejected', 'admin', false, false)).toBe(true);
  });
  it('requester cannot approve, even own PR, even same department', () => {
    expect(canTransition('Submitted', 'Approved', 'requester', true, true)).toBe(false);
  });
  it('requester can cancel own submitted PR only', () => {
    expect(canTransition('Submitted', 'Cancelled', 'requester', true)).toBe(true);
    expect(canTransition('Submitted', 'Cancelled', 'requester', false)).toBe(false);
  });
  it('requester can resubmit own rejected PR', () => {
    expect(canTransition('Rejected', 'Submitted', 'requester', true)).toBe(true);
  });
  it('admin manages the full post-approval lifecycle', () => {
    expect(canTransition('Approved', 'Ordered', 'admin', false)).toBe(true);
    expect(canTransition('Ordered', 'In Transit', 'admin', false)).toBe(true);
  });
  it('unknown or removed roles can transition nothing', () => {
    for (const role of ['viewer', 'developer', '']) {
      for (const from of STATUSES) for (const to of STATUSES) {
        expect(canTransition(from, to, role, true, true)).toBe(false);
      }
    }
  });
  it('terminal states have no exits except Rejected→Submitted', () => {
    expect(nextStates('Received', 'admin', false)).toEqual([]);
    expect(nextStates('Cancelled', 'admin', false)).toEqual([]);
  });
  it('no skipping: Submitted cannot jump to Received', () => {
    expect(canTransition('Submitted', 'Received', 'admin', false)).toBe(false);
  });
  it('an approver cannot revise a decision once it is made — that is admin-only', () => {
    expect(canTransition('Approved', 'Rejected', 'approver', false, false)).toBe(false);
    expect(canTransition('Approved', 'Submitted', 'approver', false, false)).toBe(false);
    expect(canTransition('Rejected', 'Approved', 'approver', false, false)).toBe(false);
    // even a same-department approver, since the loop closed at their decision
    expect(canTransition('Approved', 'Rejected', 'approver', false, true)).toBe(false);
  });
  it('admin can revise a decision regardless of department', () => {
    expect(canTransition('Approved', 'Rejected', 'admin', false, false)).toBe(true);
    expect(canTransition('Approved', 'Submitted', 'admin', false, false)).toBe(true);
    expect(canTransition('Rejected', 'Approved', 'admin', false, false)).toBe(true);
    expect(canTransition('Rejected', 'Rejected', 'admin', false, false)).toBe(false);
  });
  it('an approver cannot cancel or hold a Submitted PR either — decide it or leave it', () => {
    expect(canTransition('Submitted', 'Cancelled', 'approver', false, true)).toBe(false);
    expect(canTransition('Submitted', 'On Hold', 'approver', false, true)).toBe(false);
  });
  it('requester cannot use the approval loop', () => {
    expect(canTransition('Approved', 'Rejected', 'requester', true)).toBe(false);
    expect(canTransition('Rejected', 'Approved', 'requester', true)).toBe(false);
  });
});

describe('nextStates', () => {
  it('same-department approver can only approve or reject — nothing else', () => {
    expect(nextStates('Submitted', 'approver', false, true).sort())
      .toEqual(['Approved', 'Rejected'].sort());
  });
  it('a different-department approver has no moves at all', () => {
    expect(nextStates('Submitted', 'approver', false, false)).toEqual([]);
  });
  it('On Hold resumes to active states', () => {
    expect(nextStates('On Hold', 'admin', false).sort())
      .toEqual(['Approved', 'Cancelled', 'Ordered', 'Submitted'].sort());
  });
});

describe('hasEdge', () => {
  it('true for any transition defined in the matrix, independent of role', () => {
    expect(hasEdge('Submitted', 'Approved')).toBe(true);
    expect(hasEdge('On Hold', 'Ordered')).toBe(true);
  });
  it('false for transitions the matrix never defines', () => {
    expect(hasEdge('Submitted', 'Received')).toBe(false);
    expect(hasEdge('Received', 'On Hold')).toBe(false);
    expect(hasEdge('Cancelled', 'Submitted')).toBe(false);
  });
});
