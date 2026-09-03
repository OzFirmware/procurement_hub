// Hands an in-progress PR form off across a navigation to the Add Vendor page
// and back. sessionStorage (not module state) survives the full view swap —
// prFormView/vendorAddView are rebuilt from scratch on every hash change.
const KEY = 'oizom.prDraft';

export function saveDraft(d) {
  sessionStorage.setItem(KEY, JSON.stringify(d));
}

export function peekDraft() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); }
  catch { return null; }
}

export function clearDraft() {
  sessionStorage.removeItem(KEY);
}
