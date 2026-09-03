import { describe, it, expect } from 'vitest';
import { personName } from '../src/lib/people.js';

describe('personName', () => {
  it('prefers the name stored on the record', () => {
    expect(personName('Jaydeep Rathod', 'inquiry@oizom.com', '', '')).toBe('Jaydeep Rathod');
  });

  // The bug this was written for: the same person rendered two different ways
  // on one PR — "Jaydeep Rathod" as requester, "Inquiry" as approver, because
  // requestedByName was stored on create but the approve path never wrote
  // approvedByName. Self-approval means both slots share one email, so the
  // other slot's name can be borrowed safely.
  it('renders one identical name for one person who approved their own PR', () => {
    const requester = personName('Jaydeep Rathod', 'inquiry@oizom.com', 'inquiry@oizom.com', '');
    const approver = personName('', 'inquiry@oizom.com', 'inquiry@oizom.com', 'Jaydeep Rathod');
    expect(approver).toBe(requester);
    expect(approver).toBe('Jaydeep Rathod');
  });

  it('never borrows a name from a different email, even if one is supplied', () => {
    // otherEmail differs from email — the "other slot" belongs to someone
    // else on this PR, so its name must not be borrowed.
    expect(personName('', 'dudhat@oizom.com', 'yash@oizom.com', 'Yash Chovatiya')).toBe('Dudhat');
  });

  it('falls back to the email local-part when the person is genuinely unknown', () => {
    expect(personName('', 'priya.v@oizom.com', '', '')).toBe('Priya V');
  });

  it('returns empty string when there is neither a name nor an email', () => {
    expect(personName('', '', '', '')).toBe('');
  });
});
