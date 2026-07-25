import { api } from '../api.js';
import { toast, esc, displayName, initials } from '../ui.js';
import { vendorsSection, wireVendors, resetVendorPanel } from './adminVendors.js';

const ROLES = ['admin', 'approver', 'requester'];
const ROLE_INFO = {
  admin: 'Full access to settings, users, PRs, and analytics.',
  approver: 'Can authorize purchase requests and manage procurement fields.',
  requester: 'Can create purchase requests and edit own submitted PRs.'
};
// mockup avatar palette: tertiary-fixed, secondary-fixed, primary-fixed, surface-variant
const AVATAR_BGS = ['#d1e5f7', '#8cfb85', '#d1e5f9', '#e4e2e1'];
let TAB = 'users';
let USERS = null;
let PROJECTS = null;
let MTYPES = null;
let showAdd = false;

// Department→value mappings share one UI (Projects, Item Types)
const MAPPINGS = {
  projects: {
    key: 'project', label: 'Project', respKey: 'projects',
    addRoute: 'projectAdd', removeRoute: 'projectRemove',
    get: () => PROJECTS, set: v => { PROJECTS = v; }, seed: s => s.projects
  },
  types: {
    key: 'materialType', label: 'Item type', respKey: 'materialTypes',
    addRoute: 'materialTypeAdd', removeRoute: 'materialTypeRemove',
    get: () => MTYPES, set: v => { MTYPES = v; }, seed: s => s.materialTypes
  }
};

function avatarBg(email) {
  let h = 0;
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) % AVATAR_BGS.length;
  return AVATAR_BGS[h];
}
const cap = r => r[0].toUpperCase() + r.slice(1);

const HEADS = {
  users: {
    title: 'User & Role Management',
    desc: 'Manage organizational access by assigning roles to team members. Changes are audited and logged for security compliance.',
    btn: '<span class="material-symbols-outlined" style="font-size:20px">person_add</span> Add User'
  },
  projects: {
    title: 'Department Projects',
    desc: 'Maintain each department’s running projects. The PR form only offers projects listed here.',
    btn: '<span class="material-symbols-outlined" style="font-size:20px">add</span> Add Project'
  },
  types: {
    title: 'Department Item Types',
    desc: 'Maintain each department’s item types. PR items must use a type listed for the requester’s department.',
    btn: '<span class="material-symbols-outlined" style="font-size:20px">category</span> Add Item Type'
  },
  vendors: {
    title: 'Vendors',
    desc: 'Register vendors, map them to departments, and keep contact, tax and banking details in one place. The PR form only offers a department’s vendors.',
    btn: '<span class="material-symbols-outlined" style="font-size:20px">storefront</span> Add Vendor'
  }
};

export function adminView(el, s) {
  if (USERS === null) {
    el.innerHTML = '<div class="card">Loading users…</div>';
    api('usersList').then(d => { USERS = d.users; adminView(el, s); })
      .catch(e => { el.innerHTML = `<div class="card">${esc(e.message)}</div>`; });
    return;
  }
  if (PROJECTS === null) PROJECTS = s.projects || [];
  if (MTYPES === null) MTYPES = s.materialTypes || [];
  const head = HEADS[TAB];

  el.innerHTML = `
    <div class="adm">
      <div class="adm-head">
        <div>
          <h1>${head.title}</h1>
          <p>${head.desc}</p>
        </div>
        <button class="adm-addbtn" id="addToggle">${head.btn}</button>
      </div>
      <div class="adm-tabs">
        <button class="adm-tab ${TAB === 'users' ? 'active' : ''}" data-tab="users">Users &amp; Roles</button>
        <button class="adm-tab ${TAB === 'projects' ? 'active' : ''}" data-tab="projects">Projects</button>
        <button class="adm-tab ${TAB === 'types' ? 'active' : ''}" data-tab="types">Item Types</button>
        <button class="adm-tab ${TAB === 'vendors' ? 'active' : ''}" data-tab="vendors">Vendors</button>
      </div>
      ${TAB === 'users' ? usersSection(s)
        : TAB === 'vendors' ? vendorsSection(s, showAdd)
        : mappingSection(s, MAPPINGS[TAB])}
    </div>`;

  el.querySelectorAll('.adm-tab').forEach(b => b.onclick = () => {
    TAB = b.dataset.tab;
    showAdd = false;
    resetVendorPanel();
    adminView(el, s);
  });
  el.querySelector('#addToggle').onclick = () => {
    showAdd = !showAdd;
    adminView(el, s);
    if (showAdd) {
      const first = el.querySelector('.adm-addrow input, .adm-addrow select');
      if (first) first.focus();
    }
  };
  if (TAB === 'users') wireUsers(el, s);
  else if (TAB === 'vendors') wireVendors(el, s, () => { showAdd = false; adminView(el, s); });
  else wireMapping(el, s, MAPPINGS[TAB]);
}

/* ---------- Users & Roles ---------- */
function usersSection(s) {
  // legacy roles (viewer/developer) may still be in the sheet — show them
  // in the dropdown so the row reads true and can be fixed from here
  // empty role = self-signup awaiting approval; the blank option is disabled
  // because saving role '' would remove the user (see userSet backend)
  const roleOpts = u => (ROLES.includes(u.role) ? ROLES : [u.role, ...ROLES])
    .map(r => `<option value="${esc(r)}" ${r === u.role ? 'selected' : ''} ${r ? '' : 'disabled'}>${r ? esc(cap(r)) : '— assign role —'}</option>`).join('');
  const deptOpts = cur => ['', ...(cur && !depts(s).includes(cur) ? [cur, ...depts(s)] : depts(s))]
    .map(d => `<option value="${esc(d)}" ${d === (cur || '') ? 'selected' : ''}>${d ? esc(d) : '— no department —'}</option>`).join('');

  return `
    <div class="adm-banner">
      <div class="adm-banner-left">
        <span class="material-symbols-outlined">shield_person</span>
        <span>Last admin protection active. System ensures at least one active Administrator remains.</span>
      </div>
    </div>
    <div class="adm-card">
      ${showAdd ? `
      <div class="adm-addrow">
        <input id="newEmail" placeholder="person@oizom.com" class="adm-input">
        <select id="newRole" class="adm-select" style="width:auto">${ROLES.map(r => `<option value="${r}">${cap(r)}</option>`).join('')}</select>
        <select id="newDept" class="adm-select" style="width:auto">${deptOpts('')}</select>
        <button class="adm-addbtn" id="addBtn">Add User</button>
      </div>` : ''}
      <div style="overflow-x:auto">
        <table class="adm-tbl">
          <thead><tr>
            <th>User Details</th><th>Role Assignment</th><th>Department</th><th>Status</th><th style="text-align:right">Actions</th>
          </tr></thead>
          <tbody>
          ${[...USERS].sort((a, b) => (a.role ? 1 : 0) - (b.role ? 1 : 0)).map(u => `<tr>
            <td>
              <div class="adm-user">
                ${u.picture
                  ? `<img class="adm-avatar" src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer">`
                  : `<div class="adm-avatar" style="background:${avatarBg(u.email)}">${esc(initials(u.email))}</div>`}
                <div>
                  <div class="adm-name">${esc(u.name || displayName(u.email))}</div>
                  <div class="adm-email">${esc(u.email)}</div>
                </div>
              </div>
            </td>
            <td><div style="max-width:200px"><select data-email="${esc(u.email)}" class="roleSel adm-select">${roleOpts(u)}</select></div></td>
            <td><div style="max-width:200px"><select data-email="${esc(u.email)}" class="deptSel adm-select">${deptOpts(u.department)}</select></div></td>
            <td>${u.role
              ? '<span class="adm-pill">Active</span>'
              : '<span class="adm-pill pend" title="Signed in themselves — assign a role and department to approve">Pending</span>'}</td>
            <td style="text-align:right">
              <button class="adm-del rmBtn" data-email="${esc(u.email)}" title="Remove user">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="adm-foot">
        <span>Showing ${USERS.length} of ${USERS.length} active members</span>
        <div class="adm-pager">
          <button disabled><span class="material-symbols-outlined" style="font-size:18px">chevron_left</span></button>
          <span>Page 1 of 1</span>
          <button disabled><span class="material-symbols-outlined" style="font-size:18px">chevron_right</span></button>
        </div>
      </div>
    </div>
    <div class="adm-roles">
      ${ROLES.map(r => `<div class="adm-rolecard">
        <h4>${cap(r)}</h4>
        <p>${ROLE_INFO[r]}</p>
      </div>`).join('')}
    </div>`;
}

function wireUsers(el, s) {
  const setUser = async (email, fields, msg) => {
    try {
      const d = await api('userSet', { email, ...fields });
      USERS = d.users;
      showAdd = false;
      toast(msg);
      adminView(el, s);
    } catch (e) { toast(e.message, true); }
  };
  el.querySelectorAll('.roleSel').forEach(sel => sel.onchange = () =>
    setUser(sel.dataset.email, { role: sel.value }, `${sel.dataset.email} → ${sel.value}`));
  el.querySelectorAll('.deptSel').forEach(sel => sel.onchange = () =>
    setUser(sel.dataset.email, { department: sel.value }, `${sel.dataset.email} → ${sel.value || 'no department'}`));
  el.querySelectorAll('.rmBtn').forEach(b => b.onclick = () => {
    if (confirm(`Are you sure you want to remove ${b.dataset.email}? This action is permanent.`)) {
      setUser(b.dataset.email, { role: '' }, `${b.dataset.email} removed`);
    }
  });
  const addBtn = el.querySelector('#addBtn');
  if (addBtn) addBtn.onclick = () => {
    const email = el.querySelector('#newEmail').value.trim();
    const role = el.querySelector('#newRole').value;
    const department = el.querySelector('#newDept').value;
    setUser(email, { role, department }, `${email} → ${role}`);
  };
}

/* ---------- Department mappings (Projects, Item Types) ---------- */
function depts(s) {
  const fromLists = (s.lists && s.lists.departments) || [];
  const fromProjects = (PROJECTS || []).map(p => p.department);
  return [...new Set([...fromLists, ...fromProjects])];
}

function mappingSection(s, cfg) {
  const rows = [...cfg.get()].sort((a, b) =>
    a.department.localeCompare(b.department) || a[cfg.key].localeCompare(b[cfg.key]));
  return `
    <div class="adm-card">
      ${showAdd ? `
      <div class="adm-addrow">
        <select id="mpDept" class="adm-select" style="width:auto">
          ${depts(s).map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('') || '<option value="">— no departments —</option>'}
        </select>
        <input id="mpName" placeholder="${esc(cfg.label)} name" class="adm-input">
        <button class="adm-addbtn" id="mpAdd">Add ${esc(cfg.label)}</button>
      </div>` : ''}
      <div style="overflow-x:auto">
        <table class="adm-tbl">
          <thead><tr>
            <th>Department</th><th>${esc(cfg.label)}</th><th style="text-align:right">Actions</th>
          </tr></thead>
          <tbody>
          ${rows.map(p => `<tr>
            <td class="adm-name">${esc(p.department)}</td>
            <td>${esc(p[cfg.key])}</td>
            <td style="text-align:right">
              <button class="adm-del mpRm" data-dept="${esc(p.department)}" data-val="${esc(p[cfg.key])}" title="Remove">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </td>
          </tr>`).join('') || `<tr><td colspan="3" style="color:var(--adm-on-var)">Nothing listed yet — add the first one.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="adm-foot">
        <span>Showing ${rows.length} ${esc(cfg.label.toLowerCase())}${rows.length === 1 ? '' : 's'}</span>
      </div>
    </div>`;
}

function wireMapping(el, s, cfg) {
  const call = async (action, body, msg) => {
    try {
      const d = await api(action, body);
      cfg.set(d[cfg.respKey]);
      showAdd = false;
      toast(msg);
      adminView(el, s);
    } catch (e) { toast(e.message, true); }
  };
  const addBtn = el.querySelector('#mpAdd');
  if (addBtn) addBtn.onclick = () => {
    const department = el.querySelector('#mpDept').value;
    const value = el.querySelector('#mpName').value.trim();
    call(cfg.addRoute, { department, [cfg.key]: value }, `${department} / ${value} added`);
  };
  el.querySelectorAll('.mpRm').forEach(b => b.onclick = () => {
    const { dept, val } = b.dataset;
    if (confirm(`Remove "${val}" from ${dept}?`)) {
      call(cfg.removeRoute, { department: dept, [cfg.key]: val }, `${val} removed`);
    }
  });
}
