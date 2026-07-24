export const STATUSES = ['Submitted', 'Approved', 'Rejected', 'Ordered', 'In Transit', 'Received', 'Cancelled', 'On Hold'];

// role tokens: 'approver' and 'admin' are staff; 'requester:own' means
// role==='requester' AND the PR belongs to the caller.
const STAFF = ['approver', 'admin'];
const T = {
  'Submitted':  { 'Approved': STAFF, 'Rejected': STAFF, 'Cancelled': [...STAFF, 'requester:own'], 'On Hold': STAFF },
  'Approved':   { 'Ordered': STAFF, 'Cancelled': STAFF, 'On Hold': STAFF, 'Rejected': STAFF, 'Submitted': STAFF },
  'Ordered':    { 'In Transit': STAFF, 'Received': STAFF, 'Cancelled': STAFF, 'On Hold': STAFF },
  'In Transit': { 'Received': STAFF, 'On Hold': STAFF },
  'On Hold':    { 'Submitted': STAFF, 'Approved': STAFF, 'Ordered': STAFF, 'Cancelled': STAFF },
  'Rejected':   { 'Submitted': [...STAFF, 'requester:own'], 'Approved': STAFF },
  'Received':   {},
  'Cancelled':  {}
};

export function canTransition(from, to, role, isOwn) {
  const allowed = (T[from] || {})[to];
  if (!allowed) return false;
  return allowed.some(tok => tok === 'requester:own' ? (role === 'requester' && isOwn) : tok === role);
}

export function nextStates(from, role, isOwn) {
  return Object.keys(T[from] || {}).filter(to => canTransition(from, to, role, isOwn));
}
