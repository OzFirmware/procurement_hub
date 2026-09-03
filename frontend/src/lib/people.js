import { displayName } from '../ui.js';

// Resolves the name to show for one role slot (requester or approver) on
// ONE PR. The name stored on that exact slot wins; if it's blank and the
// same person fills the OTHER slot on this same PR (self-approval) with a
// name, borrow that one — never a name from a different PR. An earlier
// version indexed names across the whole PR list, which meant a stale or
// admin-overridden name on one PR could leak onto a completely unrelated
// PR's approver — showing the wrong person as having approved something.
// Scoping the borrow to the same row keeps the original fix (one person,
// one consistent name, even when they approved their own request) without
// that risk.
export function personName(name, email, otherEmail, otherName) {
  const stored = String(name || '').trim();
  if (stored) return stored;
  const e = String(email || '').trim().toLowerCase();
  const oe = String(otherEmail || '').trim().toLowerCase();
  const on = String(otherName || '').trim();
  if (e && oe && e === oe && on) return on;
  return displayName(email);
}
