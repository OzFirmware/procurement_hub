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
  it('admin can do everything approver can', () => {
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
  it('staff can revise a decision within the approval loop regardless of department', () => {
    expect(canTransition('Approved', 'Rejected', 'approver', false, false)).toBe(true);
    expect(canTransition('Approved', 'Submitted', 'approver', false, false)).toBe(true);
    expect(canTransition('Rejected', 'Approved', 'approver', false, false)).toBe(true);
    expect(canTransition('Rejected', 'Rejected', 'approver', false, false)).toBe(false);
  });
  it('requester cannot use the approval loop', () => {
    expect(canTransition('Approved', 'Rejected', 'requester', true)).toBe(false);
    expect(canTransition('Rejected', 'Approved', 'requester', true)).toBe(false);
  });
});

describe('nextStates', () => {
  it('same-department approver sees the full Submitted loop', () => {
    expect(nextStates('Submitted', 'approver', false, true).sort())
      .toEqual(['Approved', 'Cancelled', 'On Hold', 'Rejected'].sort());
  });
  it('a different-department approver can still Cancel/On Hold, but not decide', () => {
    expect(nextStates('Submitted', 'approver', false, false).sort())
      .toEqual(['Cancelled', 'On Hold'].sort());
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
