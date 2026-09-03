import './styles.css';
import { api } from './api.js';
import { initAuth, renderSignIn, signOut, tokenProfile, getToken } from './auth.js';
import { store } from './state.js';
import { esc, displayName, initials, toast } from './ui.js';
import { dashboardView } from './views/dashboard.js';
import { vendorsView } from './views/vendors.js';
import { vendorAddView } from './views/vendorAdd.js';
import { prFormView } from './views/prForm.js';
import { prDetailView } from './views/prDetail.js';
import { adminView } from './views/admin.js';
import { RANK, canAccess } from './lib/access.js';

const app = document.getElementById('app');

const VIEWS = {
  '': { fn: dashboardView, nav: 'Dashboard' },
  'vendors': { fn: vendorsView, nav: 'Vendors', minRole: 'admin' },
  'vendor-new': { fn: vendorAddView, minRole: 'requester' },
  'new': { fn: prFormView, minRole: 'requester' },
  'pr': { fn: prDetailView },
  'admin': { fn: adminView, nav: 'Admin', minRole: 'admin' }
};

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return { name: parts[0] || '', param: parts[1] || null };
}

function showAuthGate() {
  app.innerHTML = `
    <div class="auth-gate">
      <img src="oizom-logo.png" alt="OIZOM" style="height:44px;margin-bottom:18px">
      <div class="auth-box">
        <h1>OIZOM <b>Procurement</b></h1>
        <p>Sign in with your @oizom.com Google account</p>
        <div id="gsignin" style="display:flex;justify-content:center"></div>
      </div>
    </div>`;
  renderSignIn(document.getElementById('gsignin'));
}

function render() {
  const s = store.get();
  const { name, param } = route();
  const view = VIEWS[name] || VIEWS[''];
  const role = s.me ? s.me.role : '';
  // minRole used to hide the nav link and nothing else, so typing #/vendors or
  // #/admin rendered the view for anyone who knew the URL.
  if (!canAccess(view, s.me)) {
    location.hash = '#/';
    return;
  }
  const nav = Object.entries(VIEWS)
    .filter(([, v]) => v.nav && (!v.minRole || RANK[role] >= RANK[v.minRole]))
    .map(([k, v]) => `<a href="#/${k}" class="${name === k ? 'active' : ''}">${v.nav}</a>`).join('');
  const notifs = s.notifications || [];
  const unread = notifs.filter(n => !n.readAt).length;
  const prof = tokenProfile() || {};
  const email = prof.email || (s.me ? s.me.email : '');
  const pname = prof.name || displayName(email);
  const avatar = prof.picture
    ? `<img class="avatar" src="${esc(prof.picture)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="avatar avatar-txt">${esc(initials(email))}</span>`;
  app.innerHTML = `
    <div class="topbar">
      <span class="logo"><img src="oizom-logo.png" alt="OIZOM" style="height:26px;vertical-align:middle;margin-right:2px"><b>Procurement</b></span>
      <nav>${nav}</nav>
      <button class="iconbtn" id="btnRefresh" title="Refresh now">
        <span class="material-symbols-outlined ${s.loading ? 'spin' : ''}" style="font-size:20px">refresh</span>
      </button>
      <div class="nbell">
        <button class="iconbtn" id="nBtn" title="Notifications">
          <span class="material-symbols-outlined" style="font-size:20px">notifications</span>
          ${unread ? `<span class="nbadge">${unread > 9 ? '9+' : unread}</span>` : ''}
        </button>
        <div class="npanel" id="nPanel" hidden>
          ${notifs.length ? notifs.map(n => `
          <div class="nitem ${n.readAt ? '' : 'unread'}" ${n.prId ? `data-pr="${esc(n.prId)}"` : ''}>
            <div class="nmsg">${esc(n.message)}</div>
            <div class="ntime">${esc(String(n.ts).slice(0, 16).replace('T', ' '))}</div>
          </div>`).join('') : '<div class="nempty">Nothing yet.</div>'}
        </div>
      </div>
      <div class="profile" id="profileBtn">
        <span class="pname">${esc(pname)}</span>
        ${avatar}
        <div class="pmenu" id="pMenu" hidden>
          <div class="pmail">${esc(email)}</div>
          <button class="btn" id="btnOut" style="width:100%">Sign out</button>
        </div>
      </div>
    </div>
    <div class="main" id="view"></div>`;
  document.getElementById('btnRefresh').onclick = async () => {
    await store.refresh();
    if (!store.get().err) toast('Data refreshed');
  };
  const nPanel = document.getElementById('nPanel');
  document.getElementById('nBtn').onclick = () => {
    nPanel.hidden = !nPanel.hidden;
    if (!nPanel.hidden && unread) {
      // optimistic: clear locally now, persist in the background
      notifs.forEach(n => { if (!n.readAt) n.readAt = 'now'; });
      document.querySelector('.nbadge')?.remove();
      api('notifRead').catch(() => {});
    }
  };
  nPanel.querySelectorAll('.nitem[data-pr]').forEach(it =>
    it.onclick = () => { location.hash = '#/pr/' + it.dataset.pr; });
  const menu = document.getElementById('pMenu');
  document.getElementById('profileBtn').onclick = e => {
    if (e.target.id !== 'btnOut') menu.hidden = !menu.hidden;
  };
  document.getElementById('btnOut').onclick = signOut;
  view.fn(document.getElementById('view'), s, param);
}

window.addEventListener('hashchange', render);
// A refresh (header button, post-save) must not rebuild the page while the
// user is typing in the PR form — innerHTML re-render would wipe their input.
// Allow the first successful sync through so a form opened before data loads
// still gets real lists/vendors.
// Surface sync failures (initial load, manual refresh, post-save refresh) —
// state.err isn't rendered anywhere, so a toast is the only user feedback.
// Dedup: only toast when the error changes, not on every emit while it persists.
let lastErr = '';
store.subscribe(s => {
  if (s.err && s.err !== lastErr) toast(s.err, true);
  lastErr = s.err;
});

let hadFirstSync = false;
store.subscribe(() => {
  const first = !hadFirstSync && store.get().lastSync;
  if (first) hadFirstSync = true;
  if (route().name === 'new' && !first) return;
  render();
});

initAuth(() => {
  store.refresh();
  render();
});
if (!getToken()) showAuthGate();
