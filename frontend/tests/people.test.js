import { describe, it, expect } from 'vitest';
import { nameIndex, personName } from '../src/lib/people.js';

// One human, two roles on the same PR: Jaydeep Rathod (inquiry@oizom.com)
// raised PR-2026-0001 and approved it. requestedByName was stored on create;
// approvedByName was not (the approve path never wrote it), so the approver
// slot has an email and no name.
const selfApproved = [{
  id: 'PR-2026-0001',
  requesterEmail: 'inquiry@oizom.com',
  requestedByName: 'Jaydeep Rathod',
  approverEmail: 'inquiry@oizom.com',
  approvedByName: ''
}];

describe('nameIndex', () => {
  it('maps an email to the name stored alongside it', () => {
    expect(nameIndex(selfApproved).get('inquiry@oizom.com')).toBe('Jaydeep Rathod');
  });

  it('indexes approver names too, so an approver who never raised a PR is still known', () => {
    const prs = [{
      requesterEmail: 'mech@oizom.com', requestedByName: 'Yash Chauhan',
      approverEmail: 'firmware@oizom.com', approvedByName: 'Kevin Andani'
    }];
    const idx = nameIndex(prs);
    expect(idx.get('firmware@oizom.com')).toBe('Kevin Andani');
  });

  it('matches regardless of the case the email was stored in', () => {
    const prs = [{ requesterEmail: 'Inquiry@Oizom.com', requestedByName: 'Jaydeep Rathod' }];
    expect(nameIndex(prs).get('inquiry@oizom.com')).toBe('Jaydeep Rathod');
  });

  it('ignores rows with an email but no name', () => {
    const prs = [{ requesterEmail: 'ghost@oizom.com', requestedByName: '' }];
    expect(nameIndex(prs).has('ghost@oizom.com')).toBe(false);
  });
});

describe('personName', () => {
  const idx = nameIndex(selfApproved);

  it('prefers the name stored on the record', () => {
    expect(personName('Jaydeep Rathod', 'inquiry@oizom.com', idx)).toBe('Jaydeep Rathod');
  });

  it('resolves a missing name from the index instead of guessing from the email', () => {
    expect(personName('', 'inquiry@oizom.com', idx)).toBe('Jaydeep Rathod');
  });

  // The bug this was written for: the same person rendered two different ways
  // on one screen — "Jaydeep Rathod" as requester, "Inquiry" as approver.
  it('renders one identical name for one person in both roles', () => {
    const pr = selfApproved[0];
    const requester = personName(pr.requestedByName, pr.requesterEmail, idx);
    const approver = personName(pr.approvedByName, pr.approverEmail, idx);
    expect(approver).toBe(requester);
    expect(approver).toBe('Jaydeep Rathod');
  });

  it('falls back to the email local-part when the person is genuinely unknown', () => {
    expect(personName('', 'priya.v@oizom.com', idx)).toBe('Priya V');
  });

  it('returns empty string when there is neither a name nor an email', () => {
    expect(personName('', '', idx)).toBe('');
  });
});
