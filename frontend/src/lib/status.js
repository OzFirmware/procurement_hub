export const STATUSES = ['Submitted', 'Approved', 'Rejected', 'Ordered', 'In Transit', 'Received', 'Cancelled', 'On Hold'];

// paymentStatus is a plain editable field, not part of the status matrix
// below — it moves independently of PR status (e.g. Ordered can be Unpaid
// or Paid) and is what Finance acts on.
export const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Partially Paid', 'FOC / Free'];

// role tokens: 'approver' and 'admin' are staff; 'requester:own' means
// role==='requester' AND the PR belongs to the caller; 'approver:dept' means
// role==='approver' AND their department matches the PR's — the initial
// approve/reject decision is scoped to the requester's department, but admin
// always bypasses it and every later staff move (reverting, ordering,
// shipping, ...) stays open to any approver as before.
const STAFF = ['approver', 'admin'];
const T = {
  'Submitted':  { 'Approved': ['admin', 'approver:dept'], 'Rejected': ['admin', 'approver:dept'], 'Cancelled': [...STAFF, 'requester:own'], 'On Hold': STAFF },
  'Approved':   { 'Ordered': STAFF, 'Cancelled': STAFF, 'On Hold': STAFF, 'Rejected': STAFF, 'Submitted': STAFF },
  'Ordered':    { 'In Transit': STAFF, 'Received': STAFF, 'Cancelled': STAFF, 'On Hold': STAFF },
  'In Transit': { 'Received': STAFF, 'On Hold': STAFF },
  'On Hold':    { 'Submitted': STAFF, 'Approved': STAFF, 'Ordered': STAFF, 'Cancelled': STAFF },
  'Rejected':   { 'Submitted': [...STAFF, 'requester:own'], 'Approved': STAFF },
  'Received':   {},
  'Cancelled':  {}
};

export function canTransition(from, to, role, isOwn, sameDept) {
  const allowed = (T[from] || {})[to];
  if (!allowed) return false;
  return allowed.some(tok => tok === 'requester:own' ? (role === 'requester' && isOwn)
    : tok === 'approver:dept' ? (role === 'approver' && sameDept)
    : tok === role);
}

export function nextStates(from, role, isOwn, sameDept) {
  return Object.keys(T[from] || {}).filter(to => canTransition(from, to, role, isOwn, sameDept));
}

// whether (from,to) is a defined matrix edge for ANY role — used to tell
// "this move needs authorization I don't have" (backend should say so) apart
// from "this move isn't in the matrix at all" (admin's direct-field-write
// escape hatch for corrections the matrix was never meant to cover).
export function hasEdge(from, to) {
  return !!(T[from] && T[from][to]);
}
