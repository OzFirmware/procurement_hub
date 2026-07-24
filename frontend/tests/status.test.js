import { describe, it, expect } from 'vitest';
import { canTransition, nextStates, STATUSES } from '../src/lib/status.js';

describe('canTransition', () => {
  it('approver approves/rejects submitted PRs', () => {
    expect(canTransition('Submitted', 'Approved', 'approver', false)).toBe(true);
    expect(canTransition('Submitted', 'Rejected', 'approver', false)).toBe(true);
  });
  it('requester cannot approve, even own PR', () => {
    expect(canTransition('Submitted', 'Approved', 'requester', true)).toBe(false);
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
        expect(canTransition(from, to, role, true)).toBe(false);
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
  it('staff can revise a decision within the approval loop', () => {
    expect(canTransition('Approved', 'Rejected', 'approver', false)).toBe(true);
    expect(canTransition('Approved', 'Submitted', 'approver', false)).toBe(true);
    expect(canTransition('Rejected', 'Approved', 'approver', false)).toBe(true);
    expect(canTransition('Rejected', 'Rejected', 'approver', false)).toBe(false);
  });
  it('requester cannot use the approval loop', () => {
    expect(canTransition('Approved', 'Rejected', 'requester', true)).toBe(false);
    expect(canTransition('Rejected', 'Approved', 'requester', true)).toBe(false);
  });
});

describe('nextStates', () => {
  it('lists approver options from Submitted', () => {
    expect(nextStates('Submitted', 'approver', false).sort())
      .toEqual(['Approved', 'Cancelled', 'On Hold', 'Rejected'].sort());
  });
  it('On Hold resumes to active states', () => {
    expect(nextStates('On Hold', 'admin', false).sort())
      .toEqual(['Approved', 'Cancelled', 'Ordered', 'Submitted'].sort());
  });
});
