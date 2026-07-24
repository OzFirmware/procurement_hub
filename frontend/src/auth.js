import { CFG } from './config.js';

const KEY = 'oizom-id-token';
let onSignedInCb = null;

function decodeExp(token) {
  try { return JSON.parse(atob(token.split('.')[1])).exp * 1000; } catch { return 0; }
}

export function getToken() {
  const t = localStorage.getItem(KEY);
  if (!t) return null;
  if (decodeExp(t) < Date.now() + 30000) { localStorage.removeItem(KEY); return null; }
  return t;
}

export function tokenEmail() {
  const t = getToken();
  if (!t) return null;
  try { return JSON.parse(atob(t.split('.')[1])).email; } catch { return null; }
}

// name/picture/email claims from the Google ID token (base64url payload)
export function tokenProfile() {
  const t = getToken();
  if (!t) return null;
  try {
    const b64 = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const p = JSON.parse(decodeURIComponent(escape(atob(b64))));
    return { email: p.email || '', name: p.name || '', picture: p.picture || '' };
  } catch { return null; }
}

export function signOut() {
  localStorage.removeItem(KEY);
  // Without this, One Tap auto-signs the user straight back in on reload.
  if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
  location.reload();
}

export function initAuth(onSignedIn) {
  onSignedInCb = onSignedIn;
  if (getToken()) { onSignedIn(); return; }
  whenGisReady(() => {
    google.accounts.id.initialize({
      client_id: CFG.CLIENT_ID,
      hd: 'oizom.com',
      auto_select: true,
      callback: res => {
        localStorage.setItem(KEY, res.credential);
        onSignedInCb();
      }
    });
    // One Tap: mint a fresh ID token silently off the accounts.google.com
    // cookie session, so an expired token doesn't force a manual sign-in.
    google.accounts.id.prompt();
  });
}

function whenGisReady(fn, tries = 0) {
  if (window.google && google.accounts) return fn();
  if (tries > 100) { console.error('Google Identity Services failed to load'); return; }
  setTimeout(() => whenGisReady(fn, tries + 1), 100);
}

export function renderSignIn(el) {
  whenGisReady(() => {
    google.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', width: 280 });
  });
}
