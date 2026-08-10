import { displayName } from '../ui.js';

// One person must render as one name everywhere. Names are stored per-row
// (requestedByName, approvedByName), so the same human can appear with a real
// name in one slot and, where the name cell is empty, an email-derived guess in
// another — "Jaydeep Rathod" as requester, "Inquiry" as approver. Every PR that
// carries a name also carries the matching email, so the dataset already knows
// enough to answer consistently. Index those pairs and resolve against them
// before falling back to guessing from the address.
export function nameIndex(prs) {
  const idx = new Map();
  (prs || []).forEach(p => {
    add(idx, p.requesterEmail, p.requestedByName);
    add(idx, p.approverEmail, p.approvedByName);
  });
  return idx;
}

function add(idx, email, name) {
  const key = String(email || '').trim().toLowerCase();
  const val = String(name || '').trim();
  if (key && val && !idx.has(key)) idx.set(key, val);
}

// The name stored on the record wins; the index covers rows whose name cell is
// empty; the email local-part is the last resort for someone we've never seen.
export function personName(name, email, idx) {
  const stored = String(name || '').trim();
  if (stored) return stored;
  const known = idx && idx.get(String(email || '').trim().toLowerCase());
  return known || displayName(email);
}
