export const STATUSES = ['Submitted', 'Approved', 'Rejected', 'Ordered', 'In Transit', 'Received', 'Cancelled', 'On Hold'];

// paymentStatus is a plain editable field, not part of the status matrix
// below — it moves independently of PR status (e.g. Ordered can be Unpaid
// or Paid) and is what Finance acts on.
export const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Partially Paid', 'FOC / Free'];

// role tokens: 'requester:own' means role==='requester' AND the PR belongs
// to the caller; 'approver:dept' means role==='approver' AND their
// department matches the PR's. An approver's whole job is that one decision
// — approve or reject a Submitted PR from their own department. Every move
// after that (ordering, shipping, cancelling, holding, reverting) is
// admin-only; a requester keeps just their own two self-service moves
// (cancel their own Submitted PR, resubmit their own Rejected one).
const T = {
  'Submitted':  { 'Approved': ['admin', 'approver:dept'], 'Rejected': ['admin', 'approver:dept'], 'Cancelled': ['admin', 'requester:own'], 'On Hold': ['admin'] },
  'Approved':   { 'Ordered': ['admin'], 'Cancelled': ['admin'], 'On Hold': ['admin'], 'Rejected': ['admin'], 'Submitted': ['admin'] },
  'Ordered':    { 'In Transit': ['admin'], 'Received': ['admin'], 'Cancelled': ['admin'], 'On Hold': ['admin'] },
  'In Transit': { 'Received': ['admin'], 'On Hold': ['admin'] },
  'On Hold':    { 'Submitted': ['admin'], 'Approved': ['admin'], 'Ordered': ['admin'], 'Cancelled': ['admin'] },
  'Rejected':   { 'Submitted': ['admin', 'requester:own'], 'Approved': ['admin'] },
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
