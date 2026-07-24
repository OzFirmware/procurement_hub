# Vendors Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vendors tab (after Dashboard, visible to all roles) with vendor cards + read-only detail view; admin curates `displayName` and `logoUrl` per vendor.

**Architecture:** Pure aggregation module `lib/vendorStats.js` (extracted from `adminVendors.js`, unit-tested) feeds a new standalone view `views/vendors.js` (card grid + detail via `#/vendors/<name>`). Backend change is only two new columns in `VENDOR_HEADERS` — the sheet auto-migrates and `vendorSet` picks the fields up because `VENDOR_EDITABLE` is derived.

**Tech Stack:** Vanilla JS (ES modules), Vite, Vitest, Google Apps Script (`.gs`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-vendors-tab-design.md`.
- Vendor↔PR join stays on raw `name` string; `displayName` is presentation-only.
- Money is never summed across currencies (project-wide rule, see `lib/metrics.js` header comment).
- Detail view never renders: account number, IFSC, SWIFT, GST (any role). Bank NAME is allowed.
- Commit messages: plain conventional commits, NO Claude co-author trailer.
- Test command: `npm test` (vitest) run from `frontend/`.
- All HTML built via template strings; every dynamic value goes through `esc()` from `src/ui.js`.

---

## File Structure

- Create: `frontend/src/lib/vendorStats.js` — pure per-vendor PR aggregation + badge derivation
- Create: `frontend/tests/vendorStats.test.js` — vitest unit tests
- Create: `frontend/src/views/vendors.js` — card grid + read-only detail view
- Modify: `frontend/src/views/adminVendors.js` — use `vendorStats`, add Display name / Logo URL inputs
- Modify: `frontend/src/main.js` — register `vendors` route in `VIEWS`
- Modify: `frontend/src/styles.css` — vendor card/detail styles (append at end)
- Modify: `apps-script/vendors.gs` — extend `VENDOR_HEADERS`

---

### Task 1: `lib/vendorStats.js` — pure stats module (TDD)

**Files:**
- Create: `frontend/src/lib/vendorStats.js`
- Test: `frontend/tests/vendorStats.test.js`

**Interfaces:**
- Consumes: `KPI_FILTERS` from `frontend/src/lib/metrics.js` (already exists: `KPI_FILTERS.spend` = not Cancelled/Rejected, `KPI_FILTERS.unpaid` = active AND paymentStatus 'Unpaid').
- Produces (used by Tasks 2 and 4):
  - `vendorPrs(prs, name)` → `pr[]` — case-insensitive match on `p.vendor`
  - `vendorStats(prs, name)` → `{ count: number, spendTotals: [currency, total][] (desc by total), unpaid: number, lastOrder: string ('' or ISO date) }`
  - `vendorBadge(vendor, prs)` → `'Domestic' | 'Foreign' | 'Mixed' | ''`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/vendorStats.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { vendorStats, vendorBadge, vendorPrs } from '../src/lib/vendorStats.js';

const PRS = [
  { id: 'a', vendor: 'Amazon.in', status: 'Received', paymentStatus: 'Paid', amount: '1000', currency: 'INR', createdAt: '2026-06-10' },
  { id: 'b', vendor: 'amazon.IN', status: 'Submitted', paymentStatus: 'Unpaid', amount: '250', currency: 'INR', createdAt: '2026-07-01' },
  { id: 'c', vendor: 'Amazon.in', status: 'Cancelled', paymentStatus: 'Unpaid', amount: '999', currency: 'INR', createdAt: '2026-07-10' },
  { id: 'd', vendor: 'digikey.in', status: 'Ordered', paymentStatus: 'Unpaid', amount: '50', currency: 'USD', createdAt: '2026-05-20' },
  { id: 'e', vendor: 'digikey.in', status: 'Received', paymentStatus: 'Paid', amount: '300', currency: 'INR', createdAt: '2026-04-01' },
  { id: 'f', vendor: 'NoAmt', status: 'Approved', paymentStatus: '', amount: '', currency: '', createdAt: 'garbage' }
];

describe('vendorPrs', () => {
  it('matches vendor name case-insensitively', () => {
    expect(vendorPrs(PRS, 'AMAZON.IN')).toHaveLength(3);
  });
  it('returns empty for unknown vendor', () => {
    expect(vendorPrs(PRS, 'ghost')).toEqual([]);
  });
});

describe('vendorStats', () => {
  it('counts all PRs but excludes Cancelled/Rejected from spend', () => {
    const k = vendorStats(PRS, 'Amazon.in');
    expect(k.count).toBe(3);
    expect(k.spendTotals).toEqual([['INR', 1250]]);
  });
  it('counts unpaid on active PRs only (cancelled unpaid excluded)', () => {
    expect(vendorStats(PRS, 'Amazon.in').unpaid).toBe(1);
  });
  it('sorts multi-currency spend by total desc', () => {
    expect(vendorStats(PRS, 'digikey.in').spendTotals).toEqual([['INR', 300], ['USD', 50]]);
  });
  it('takes last order from valid dates only', () => {
    expect(vendorStats(PRS, 'Amazon.in').lastOrder).toBe('2026-07-10');
    expect(vendorStats(PRS, 'NoAmt').lastOrder).toBe('');
  });
  it('handles vendor with no PRs', () => {
    expect(vendorStats(PRS, 'ghost')).toEqual({ count: 0, spendTotals: [], unpaid: 0, lastOrder: '' });
  });
});

describe('vendorBadge', () => {
  it('uses type field when set', () => {
    expect(vendorBadge({ name: 'x', type: 'Domestic' }, PRS)).toBe('Domestic');
    expect(vendorBadge({ name: 'x', type: 'International' }, PRS)).toBe('Foreign');
  });
  it('derives Domestic from all-INR PRs when type empty', () => {
    expect(vendorBadge({ name: 'Amazon.in', type: '' }, PRS)).toBe('Domestic');
  });
  it('derives Mixed from INR + foreign PRs', () => {
    expect(vendorBadge({ name: 'digikey.in', type: '' }, PRS)).toBe('Mixed');
  });
  it('derives Foreign when no INR PRs', () => {
    const prs = [{ vendor: 'sem', status: 'Ordered', amount: '10', currency: 'USD' }];
    expect(vendorBadge({ name: 'sem', type: '' }, prs)).toBe('Foreign');
  });
  it('returns empty when no type and no priced PRs', () => {
    expect(vendorBadge({ name: 'ghost', type: '' }, PRS)).toBe('');
    expect(vendorBadge({ name: 'NoAmt', type: '' }, PRS)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- vendorStats`
Expected: FAIL — "Failed to resolve import ../src/lib/vendorStats.js"

- [ ] **Step 3: Write implementation**

Create `frontend/src/lib/vendorStats.js`:

```js
import { KPI_FILTERS } from './metrics.js';

// Per-vendor PR aggregation for vendor cards. Money is never summed across
// currencies. PR↔vendor join is the raw name string, case-insensitive.

export function vendorPrs(prs, name) {
  const n = String(name || '').toLowerCase();
  return prs.filter(p => String(p.vendor || '').toLowerCase() === n);
}

export function vendorStats(prs, name) {
  const mine = vendorPrs(prs, name);
  const active = mine.filter(KPI_FILTERS.spend);
  const t = {};
  for (const p of active) {
    const amt = Number(p.amount);
    if (!p.amount || !isFinite(amt)) continue;
    const cur = p.currency || 'INR';
    t[cur] = (t[cur] || 0) + amt;
  }
  return {
    count: mine.length,
    spendTotals: Object.entries(t).sort((a, b) => b[1] - a[1]),
    unpaid: mine.filter(KPI_FILTERS.unpaid).length,
    lastOrder: mine.reduce((m, p) => {
      const d = String(p.createdAt || '');
      return /^\d{4}-\d{2}-\d{2}/.test(d) && d > m ? d : m;
    }, '')
  };
}

export function vendorBadge(vendor, prs) {
  if (vendor.type === 'Domestic') return 'Domestic';
  if (vendor.type === 'International') return 'Foreign';
  const curs = new Set(vendorPrs(prs, vendor.name)
    .filter(p => p.amount && isFinite(Number(p.amount)))
    .map(p => p.currency || 'INR'));
  if (!curs.size) return '';
  const hasInr = curs.has('INR');
  const hasFx = [...curs].some(c => c !== 'INR');
  return hasInr && hasFx ? 'Mixed' : hasFx ? 'Foreign' : 'Domestic';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: all suites PASS (existing 5 test files + new vendorStats.test.js)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/vendorStats.js frontend/tests/vendorStats.test.js
git commit -m "feat(lib): vendor stats aggregation with badge derivation"
```

---

### Task 2: Switch `adminVendors.js` to `vendorStats` + add curation fields

**Files:**
- Modify: `frontend/src/views/adminVendors.js`

**Interfaces:**
- Consumes: `vendorStats(prs, name)` from Task 1.
- Produces: admin form now submits `displayName` and `logoUrl` in `updates` (picked up by `vendorSet` after Task 3; harmless extra keys before it — backend ignores unknown headers).

- [ ] **Step 1: Replace local stats() with vendorStats**

In `frontend/src/views/adminVendors.js`:

Replace the imports block line:
```js
import { KPI_FILTERS } from '../lib/metrics.js';
```
with:
```js
import { vendorStats } from '../lib/vendorStats.js';
```

Delete the whole local `stats(s, name)` function (lines 22–32: `function stats(s, name) { … }`).

In `detailHtml`, replace:
```js
  const k = stats(s, v.name);
```
with:
```js
  const k = vendorStats(s.prs, v.name);
  const inr = (k.spendTotals.find(([c]) => c === 'INR') || ['INR', 0])[1];
```
and in the Activity stats block replace:
```js
        <div class="adm-stat"><b>${esc(fmtMoney('INR', k.inr))}</b><span>INR spend</span></div>
```
with:
```js
        <div class="adm-stat"><b>${esc(fmtMoney('INR', inr))}</b><span>INR spend</span></div>
```

- [ ] **Step 2: Add Display name + Logo URL inputs**

In `detailHtml`, directly after the closing `</label>` of the "Vendor name" field (before `<div class="adm-grid2">`), insert:

```js
        <div class="adm-grid2">
          ${field('Display name', 'displayName', v.displayName, 'Shown on vendor cards')}
          ${field('Logo URL', 'logoUrl', v.logoUrl, 'https://…/logo.png')}
        </div>
```

No wiring change needed — `wireVendors` form submit already serializes every input via `FormData`.

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test`
Expected: all PASS (admin view has no unit tests; this catches import/regression breakage in lib tests)

- [ ] **Step 4: Manual smoke check**

Run: `cd frontend && npm run dev`, open Admin → Vendors → click a vendor.
Expected: Activity stats render (count / INR spend / unpaid), two new fields visible, Save works (new fields persist once Task 3 deployed; before that they are silently dropped by the backend — acceptable mid-sequence).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/adminVendors.js
git commit -m "refactor(admin): use shared vendorStats, add displayName/logoUrl fields"
```

---

### Task 3: Backend — extend `VENDOR_HEADERS`

**Files:**
- Modify: `apps-script/vendors.gs:4-6`

**Interfaces:**
- Produces: `listVendors_()` now returns `displayName` and `logoUrl` on every vendor object (empty string when unset); `vendorSet` accepts them in `updates` (because `VENDOR_EDITABLE` derives from `VENDOR_HEADERS`).

- [ ] **Step 1: Extend the header array**

In `apps-script/vendors.gs` replace:

```js
var VENDOR_HEADERS = ['name', 'departments', 'category', 'type', 'contactPerson', 'phone',
  'email', 'address', 'website', 'gstTaxId', 'rating', 'bankName', 'accountNumber',
  'ifsc', 'swift', 'paymentTerms', 'notes', 'addedBy', 'addedAt'];
```

with:

```js
var VENDOR_HEADERS = ['name', 'displayName', 'logoUrl', 'departments', 'category', 'type',
  'contactPerson', 'phone', 'email', 'address', 'website', 'gstTaxId', 'rating', 'bankName',
  'accountNumber', 'ifsc', 'swift', 'paymentTerms', 'notes', 'addedBy', 'addedAt'];
```

(Position in the array is cosmetic for NEW sheets only — existing sheets get the two columns appended at the end by `vendorSheet_()`, and all reads/writes are located by header name.)

- [ ] **Step 2: Verify no other backend change needed**

Check: `VENDOR_EDITABLE` (vendors.gs) filters only `addedBy`/`addedAt` — new fields editable automatically. `listVendors_()` maps all `VENDOR_HEADERS` — new fields returned automatically. Nothing else references vendor columns positionally.

- [ ] **Step 3: Commit**

```bash
git add apps-script/vendors.gs
git commit -m "feat(vendors): displayName and logoUrl columns in vendor registry"
```

- [ ] **Step 4: Deploy note**

Apps Script is deployed manually (copy/clasp per project workflow). Flag to user after merge: redeploy Apps Script so `vendorSet` persists the new fields. First `list` call after deploy auto-appends the two sheet columns.

---

### Task 4: Vendors view — card grid, detail, route, styles

**Files:**
- Create: `frontend/src/views/vendors.js`
- Modify: `frontend/src/main.js` (imports + `VIEWS`)
- Modify: `frontend/src/styles.css` (append at end)

**Interfaces:**
- Consumes: `vendorStats`, `vendorBadge`, `vendorPrs` (Task 1); `esc`, `chip`, `fmtDate` from `../ui.js`; `fmtCompact` from `../lib/currency.js`; `s.vendors` objects with `displayName`/`logoUrl` (Task 3; fields may be `undefined` before backend deploy — code must treat falsy as unset).
- Produces: `vendorsView(el, s, param)` — registered in `VIEWS` as `'vendors'`; detail route `#/vendors/<encodeURIComponent(name)>`.

- [ ] **Step 1: Create the view**

Create `frontend/src/views/vendors.js`:

```js
import { esc, chip, fmtDate } from '../ui.js';
import { fmtCompact } from '../lib/currency.js';
import { vendorStats, vendorBadge, vendorPrs } from '../lib/vendorStats.js';

const BADGE_CLS = { Domestic: 'dom', Foreign: 'for', Mixed: 'mix' };

// "Cubic Sensor & Instrument" → "CS"
const vinitials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2)
  .map(w => w[0]).join('').toUpperCase() || '?';

// Initials render underneath; the <img> overlays them and removes itself on
// load failure, so a dead logoUrl/favicon degrades to the initials avatar.
function logoHtml(v) {
  let src = v.logoUrl || '';
  if (!src && v.website) {
    const domain = String(v.website).replace(/^https?:\/\//, '').split('/')[0];
    if (domain) src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  }
  return `<span class="vc-logo">${esc(vinitials(v.displayName || v.name))}${
    src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
}

function chipRow(v) {
  const chips = [
    ...(v.bankName ? [{ t: v.bankName, cls: 'bank' }] : []),
    ...(v.departments || []).map(d => ({ t: d, cls: '' }))
  ];
  const shown = chips.slice(0, 3);
  const extra = chips.length - shown.length;
  return shown.map(c => `<span class="vc-chip ${c.cls}">${esc(c.t)}</span>`).join('') +
    (extra > 0 ? `<span class="vc-chip more">+${extra} more</span>` : '');
}

function cardHtml(s, v) {
  const k = vendorStats(s.prs, v.name);
  const badge = vendorBadge(v, s.prs);
  const spend = k.spendTotals.length
    ? fmtCompact(...k.spendTotals[0]) + (k.spendTotals.length > 1 ? ' +' : '')
    : '—';
  return `
    <div class="vcard" data-name="${esc(v.name)}">
      <div class="vc-top">
        ${logoHtml(v)}
        <div class="vc-title">
          <b>${esc(v.displayName || v.name)}</b>
          ${v.category ? `<span class="vc-sub">${esc(v.category)}</span>` : ''}
        </div>
        ${badge ? `<span class="vc-badge ${BADGE_CLS[badge]}">${esc(badge.toUpperCase())}</span>` : ''}
      </div>
      <div class="vc-stats">
        <div><span class="vc-l">Purchase reqs</span><b>${k.count}</b></div>
        <div><span class="vc-l">Total spend</span><b>${esc(spend)}</b></div>
        <div><span class="vc-l">Unpaid</span><b class="${k.unpaid ? 'vc-bad' : ''}">${k.unpaid}</b></div>
        <div><span class="vc-l">Last order</span><b>${fmtDate(k.lastOrder)}</b></div>
      </div>
      <div class="vc-chips">${chipRow(v)}</div>
    </div>`;
}

export function vendorsView(el, s, param) {
  if (param) return detailView(el, s, decodeURIComponent(param));
  const list = [...(s.vendors || [])]
    .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
  el.innerHTML = `
    <div class="dash">
      <div class="adm-head">
        <div>
          <h1>Vendors</h1>
          <p>Registered vendors and their purchase activity.</p>
        </div>
      </div>
      <div class="vgrid">
        ${list.map(v => cardHtml(s, v)).join('')
          || '<div class="card" style="color:var(--mut)">No vendors yet — an admin can add them in Admin → Vendors.</div>'}
      </div>
    </div>`;
  el.querySelectorAll('.vcard').forEach(c =>
    c.onclick = () => location.hash = '#/vendors/' + encodeURIComponent(c.dataset.name));
}

// Read-only for every role. Banking numbers, IFSC, SWIFT and GST are
// deliberately never rendered here — admin editor only (see design spec).
function detailView(el, s, name) {
  const v = (s.vendors || []).find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!v) {
    el.innerHTML = `<div class="dash"><div class="card">Vendor not found: <b>${esc(name)}</b> — <a href="#/vendors">back to vendors</a></div></div>`;
    return;
  }
  const k = vendorStats(s.prs, v.name);
  const badge = vendorBadge(v, s.prs);
  const isAdmin = s.me && s.me.role === 'admin';
  const rows = vendorPrs(s.prs, v.name)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const info = [
    ['Contact person', v.contactPerson], ['Phone', v.phone], ['Email', v.email],
    ['Website', v.website], ['Address', v.address],
    ['Payment terms', v.paymentTerms], ['Bank', v.bankName]
  ].filter(([, val]) => val);
  el.innerHTML = `
    <div class="dash">
      <div class="adm-head">
        <div style="display:flex;gap:14px;align-items:center">
          ${logoHtml(v)}
          <div>
            <h1 style="display:flex;gap:10px;align-items:center">${esc(v.displayName || v.name)}
              ${badge ? `<span class="vc-badge ${BADGE_CLS[badge]}">${esc(badge.toUpperCase())}</span>` : ''}
            </h1>
            <p>${esc(v.category || 'Vendor')}</p>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          ${isAdmin ? '<a class="btn" href="#/admin">Edit in Admin</a>' : ''}
          <a class="btn" href="#/vendors">← All vendors</a>
        </div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="v">${k.count}</div><div class="l">Purchase requests</div></div>
        <div class="kpi ${k.unpaid ? 'bad' : ''}"><div class="v">${k.unpaid}</div><div class="l">Unpaid</div></div>
        <div class="kpi"><div class="v">${k.spendTotals.length ? esc(fmtCompact(...k.spendTotals[0])) : '—'}</div><div class="l">Total spend</div>
          <div class="s">${k.spendTotals.length > 1 ? esc(k.spendTotals.slice(1).map(([c, n]) => fmtCompact(c, n)).join(' + ')) : ''}</div></div>
        <div class="kpi"><div class="v">${fmtDate(k.lastOrder)}</div><div class="l">Last order</div></div>
      </div>
      ${info.length || (v.departments || []).length ? `<div class="card"><h2>Details</h2>
        <div class="vd-info">${info.map(([l, val]) => `<div><span class="vc-l">${esc(l)}</span><b>${esc(val)}</b></div>`).join('')}</div>
        ${(v.departments || []).length ? `<div class="vc-chips" style="margin-top:12px">${v.departments.map(d => `<span class="vc-chip">${esc(d)}</span>`).join('')}</div>` : ''}
      </div>` : ''}
      <div class="card">
        <h2>Purchase requests · ${rows.length}</h2>
        <table class="tbl"><thead><tr>
          <th>ID</th><th>Date</th><th>Dept</th><th>Item</th><th>Amount</th><th>Status</th>
        </tr></thead><tbody>
          ${rows.map(p => `<tr class="rowlink" data-id="${esc(p.id)}">
            <td style="font-family:var(--mono);font-size:12px">${esc(p.id)}</td>
            <td>${fmtDate(p.createdAt)}</td><td>${esc(p.department)}</td>
            <td>${esc(p.item)}</td>
            <td>${p.amount ? esc(fmtCompact(p.currency || 'INR', Number(p.amount))) : '—'}</td>
            <td>${chip(p.status)}</td>
          </tr>`).join('') || '<tr><td colspan="6" style="color:var(--mut)">No PRs with this vendor yet.</td></tr>'}
        </tbody></table>
      </div>
    </div>`;
  el.querySelectorAll('tr.rowlink').forEach(tr =>
    tr.onclick = () => location.hash = '#/pr/' + tr.dataset.id);
}
```

- [ ] **Step 2: Register the route**

In `frontend/src/main.js`, after the `dashboardView` import add:

```js
import { vendorsView } from './views/vendors.js';
```

In `VIEWS`, insert directly after the `''` entry (order = nav order):

```js
  'vendors': { fn: vendorsView, nav: 'Vendors' },
```

- [ ] **Step 3: Append styles**

Append to `frontend/src/styles.css`:

```css
/* ===== vendors tab ===== */
.vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.vcard{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;cursor:pointer;display:flex;flex-direction:column;gap:12px}
.vcard:hover{border-color:var(--disp)}
.vc-top{display:flex;gap:10px;align-items:flex-start}
.vc-logo{position:relative;width:36px;height:36px;border-radius:8px;border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--mut);flex:none;overflow:hidden}
.vc-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff}
.vc-title{display:flex;flex-direction:column;min-width:0}
.vc-title b{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vc-sub{font-size:12px;color:var(--mut)}
.vc-badge{margin-left:auto;font-size:10px;font-weight:700;letter-spacing:.4px;padding:3px 8px;border-radius:6px;flex:none}
.vc-badge.dom{background:#e7f6ec;color:#1e7d3f}
.vc-badge.for{background:#eef1ff;color:#3d4db7}
.vc-badge.mix{background:#f4f4f5;color:#555}
.vc-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
.vc-stats b{font-size:16px}
.vc-l{display:block;font-size:10px;letter-spacing:.4px;text-transform:uppercase;color:var(--mut)}
.vc-bad{color:#c62828}
.vc-chips{display:flex;flex-wrap:wrap;gap:6px}
.vc-chip{font-size:11px;padding:3px 8px;border-radius:6px;background:var(--panel);border:1px solid var(--line)}
.vc-chip.bank{background:#e7f6ec}
.vc-chip.more{color:var(--mut)}
.vd-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px 16px}
```

- [ ] **Step 4: Run tests + build**

Run: `cd frontend && npm test && npm run build`
Expected: tests PASS, vite build succeeds (catches import typos).

- [ ] **Step 5: Manual smoke check**

Run: `cd frontend && npm run dev`. Verify:
- Nav shows Dashboard · Vendors (· Admin for admin) for every role.
- `#/vendors`: cards render with stats, badges, chips; favicon logos load for vendors with website; initials otherwise.
- Click card → detail: stats row, details grid, PR table; PR row click → `#/pr/<id>`.
- No account number / IFSC / SWIFT / GST anywhere in the detail view.
- `#/vendors/NoSuchVendor` → "Vendor not found" with back link.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/vendors.js frontend/src/main.js frontend/src/styles.css
git commit -m "feat(vendors): public vendors tab with cards and read-only detail"
```
