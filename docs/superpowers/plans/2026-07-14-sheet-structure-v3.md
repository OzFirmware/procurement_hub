# Sheet Structure v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the v3 sheet structure (spec: `docs/superpowers/specs/2026-07-14-sheet-structure-v3-design.md`) — a new spreadsheet with a 29-column `PRs` tab, an `Items` tab for multi-item PRs, `Lists` + `Vendors` master data, migration from the legacy department tabs, and form intake v2.

**Architecture:** Google Sheet is the database; all mutations go through a container-bound Apps Script web app (`apps-script/*.gs`, ES5-style `var`/`function` code). The frontend is a Vite vanilla-JS SPA (`frontend/src`). Money lives on `Items.lineTotal` (server-computed `qty × unitPrice`) and is denormalized to `PRs.totalAmount`. The client joins Items to PRs with `decoratePrs()`, which also maps v3 fields onto the legacy names (`amount`, `item`, `qty`) so existing dashboard/metrics/reports code keeps working unchanged.

**Tech Stack:** Google Apps Script (V8, but codebase uses ES5 style), Vite, vanilla JS ES modules, Vitest.

## Global Constraints

- Apps Script files use `var` + `function` declarations (match existing style in `prs.gs`).
- Frontend is framework-free vanilla JS; no new npm dependencies.
- Vitest tests only for pure logic under `frontend/src/lib/` (Apps Script has no test harness — its tasks end with manual editor verification, listed per task).
- All PR mutations happen inside `withLock_` (defined in `apps-script/prs.gs:81`), which flushes before releasing.
- `PRs.totalAmount` is never accepted from a client — always recomputed server-side.
- One vendor and one currency per PR; items in another currency = separate PR.
- Commit messages: plain conventional style, NO co-author trailers.
- New PR sheet columns (29, exact order): `id, createdAt, department, project, purpose, requesterEmail, requestedByName, vendor, totalAmount, currency, status, priority, approverEmail, approvedByName, approvedAt, paymentStatus, paymentTerm, poNo, poDate, invoiceNo, invoiceDate, quotationDoc, courier, trackingNo, trackingLink, expectedDate, receivedAt, notes, updatedAt`.
- `Items` columns (11, exact order): `prId, itemNo, description, partNo, materialType, qty, unit, unitPrice, lineTotal, purchaseLink, datasheetDoc`.

## File Structure

| File | Responsibility |
|------|----------------|
| `frontend/src/lib/items.js` (create) | Pure item math + PR⇄Items join/decoration |
| `frontend/tests/items.test.js` (create) | Tests for the above |
| `apps-script/items.gs` (create) | Items sheet helpers, normalize/recompute, replace-all writes |
| `apps-script/lists.gs` (create) | `Lists` tab read (cached) + seed values |
| `apps-script/vendors.gs` (create) | `Vendors` tab read + auto-registration |
| `apps-script/prs.gs` (modify) | 29-col headers, create/update/list/delete with items |
| `apps-script/setup.gs` (create) | One-time v3 tab creation, Lists seeding, data validation |
| `apps-script/migrate.gs` (rewrite) | v2 migration: legacy file → PRs + Items + Vendors |
| `apps-script/formSubmit.gs` (modify) | Form row → PR + single Item |
| `frontend/src/state.js` (modify) | Store items/lists/vendors; decorate PRs |
| `frontend/src/views/prForm.js` (rewrite) | Multi-item form, new PR fields, Lists-driven dropdowns |
| `frontend/src/views/prDetail.js` (modify) | Items table + role-gated procurement section |
| `frontend/src/lib/reports.js` (modify) | `spendByMaterialType` |
| `frontend/src/views/reports.js` (modify) | Project/material-type spend sections, CSV columns |
| `SETUP.md`, `README.md` (modify) | v3 setup + migration runbook, E2E checklist |

---

### Task 1: Item math + client join (`lib/items.js`)

**Files:**
- Create: `frontend/src/lib/items.js`
- Test: `frontend/tests/items.test.js`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  - `computeLineTotal(qty, unitPrice) -> number | ''`
  - `computeTotalAmount(items: {lineTotal}[]) -> number | ''`
  - `itemSummary(items: {description}[]) -> string`
  - `qtySummary(items: {qty, unit}[]) -> string`
  - `decoratePrs(prs, items) -> pr[]` where each pr gains `items` (sorted by `itemNo`), and legacy-compat fields `amount` (= `totalAmount`), `item` (= summary), `qty` (= qty summary). Tasks 8–11 rely on these exact names.

- [ ] **Step 1: Write the failing tests**

```js
// frontend/tests/items.test.js
import { describe, it, expect } from 'vitest';
import { computeLineTotal, computeTotalAmount, itemSummary, qtySummary, decoratePrs } from '../src/lib/items.js';

describe('computeLineTotal', () => {
  it('multiplies qty × unitPrice to 2 decimals', () => {
    expect(computeLineTotal('3', '10.505')).toBe(31.52);
  });
  it('returns "" when qty or unitPrice missing/non-numeric', () => {
    expect(computeLineTotal('', '10')).toBe('');
    expect(computeLineTotal('2', '')).toBe('');
    expect(computeLineTotal('abc', '10')).toBe('');
  });
});

describe('computeTotalAmount', () => {
  it('sums numeric lineTotals', () => {
    expect(computeTotalAmount([{ lineTotal: 10 }, { lineTotal: '2.5' }])).toBe(12.5);
  });
  it('ignores blank lineTotals, returns "" when none numeric', () => {
    expect(computeTotalAmount([{ lineTotal: '' }, { lineTotal: 5 }])).toBe(5);
    expect(computeTotalAmount([{ lineTotal: '' }])).toBe('');
    expect(computeTotalAmount([])).toBe('');
  });
});

describe('itemSummary / qtySummary', () => {
  it('single item → description and "qty unit"', () => {
    expect(itemSummary([{ description: 'IPA' }])).toBe('IPA');
    expect(qtySummary([{ qty: '10', unit: 'L' }])).toBe('10 L');
  });
  it('multi item → "first (+N more)" and "N items"', () => {
    const items = [{ description: 'A', qty: '1' }, { description: 'B', qty: '2' }];
    expect(itemSummary(items)).toBe('A (+1 more)');
    expect(qtySummary(items)).toBe('2 items');
  });
  it('empty → ""', () => {
    expect(itemSummary([])).toBe('');
    expect(qtySummary([])).toBe('');
  });
});

describe('decoratePrs', () => {
  it('joins items by prId sorted by itemNo and maps compat fields', () => {
    const prs = [{ id: 'PR-1', totalAmount: '150' }, { id: 'PR-2', totalAmount: '' }];
    const items = [
      { prId: 'PR-1', itemNo: '2', description: 'B', qty: '1', unit: '', lineTotal: '50' },
      { prId: 'PR-1', itemNo: '1', description: 'A', qty: '2', unit: 'pcs', lineTotal: '100' }
    ];
    const out = decoratePrs(prs, items);
    expect(out[0].items.map(i => i.description)).toEqual(['A', 'B']);
    expect(out[0].amount).toBe('150');
    expect(out[0].item).toBe('A (+1 more)');
    expect(out[0].qty).toBe('2 items');
    expect(out[1].items).toEqual([]);
    expect(out[1].item).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run tests/items.test.js`
Expected: FAIL — cannot resolve `../src/lib/items.js`.

- [ ] **Step 3: Implement `frontend/src/lib/items.js`**

```js
// Item math + the PR ⇄ Items client-side join.
// v3 PRs carry money on `totalAmount` (server-computed) and descriptions on
// the Items tab. decoratePrs() maps that shape onto the legacy field names
// (amount, item, qty) so metrics/reports/dashboard consumers stay unchanged.

export function computeLineTotal(qty, unitPrice) {
  const q = Number(qty), u = Number(unitPrice);
  if (qty === '' || qty == null || unitPrice === '' || unitPrice == null) return '';
  if (!isFinite(q) || !isFinite(u)) return '';
  return Math.round(q * u * 100) / 100;
}

export function computeTotalAmount(items) {
  let sum = 0, any = false;
  for (const it of items) {
    const n = Number(it.lineTotal);
    if (it.lineTotal !== '' && it.lineTotal != null && isFinite(n)) { sum += n; any = true; }
  }
  return any ? Math.round(sum * 100) / 100 : '';
}

export function itemSummary(items) {
  if (!items.length) return '';
  const first = items[0].description || '';
  return items.length > 1 ? `${first} (+${items.length - 1} more)` : first;
}

export function qtySummary(items) {
  if (!items.length) return '';
  if (items.length === 1) return [items[0].qty, items[0].unit].filter(Boolean).join(' ');
  return items.length + ' items';
}

export function decoratePrs(prs, items) {
  const byPr = {};
  for (const it of items) (byPr[it.prId] = byPr[it.prId] || []).push(it);
  for (const k in byPr) byPr[k].sort((a, b) => Number(a.itemNo) - Number(b.itemNo));
  return prs.map(p => {
    const its = byPr[p.id] || [];
    return { ...p, items: its, amount: p.totalAmount, item: itemSummary(its), qty: qtySummary(its) };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run tests/items.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Run the whole suite (no regressions)**

Run: `cd frontend && npx vitest run`
Expected: all existing tests (currency, metrics, reports, status) still PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/items.js frontend/tests/items.test.js
git commit -m "feat: item math and PR/items client join with legacy-compat decoration"
```

---

### Task 2: Backend items module (`items.gs`)

**Files:**
- Create: `apps-script/items.gs`

**Interfaces:**
- Consumes: `sheet_`, `cellStr_` from `Code.gs`.
- Produces (used by Tasks 4, 6, 7):
  - `ITEM_HEADERS` (11 names, exact order from Global Constraints)
  - `ITEM_FIELDS` — client-settable subset
  - `listAllItems_() -> item[]`
  - `normalizeItems_(raw) -> { items, totalAmount }` — assigns `itemNo`, computes `lineTotal`, drops rows without a description
  - `writeItemsForPr_(prId, items)` — replace-all write; caller must hold `withLock_`
  - `itemSummary_(items) -> string` — for log lines

- [ ] **Step 1: Write `apps-script/items.gs`**

```js
// ===== Items tab: one row per PR line item =====

var ITEM_HEADERS = ['prId', 'itemNo', 'description', 'partNo', 'materialType', 'qty', 'unit',
  'unitPrice', 'lineTotal', 'purchaseLink', 'datasheetDoc'];

// fields accepted from clients; prId/itemNo/lineTotal are server-assigned
var ITEM_FIELDS = ['description', 'partNo', 'materialType', 'qty', 'unit', 'unitPrice',
  'purchaseLink', 'datasheetDoc'];

function itemSheet_() { return sheet_('Items', ITEM_HEADERS); }

function rowToItem_(row) {
  var it = {};
  ITEM_HEADERS.forEach(function (h, i) { it[h] = cellStr_(row[i]); });
  return it;
}

function listAllItems_() {
  var data = itemSheet_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var it = rowToItem_(data[i]);
    if (it.prId) out.push(it);
  }
  return out;
}

function numOrBlank_(v) {
  if (v === '' || v == null) return '';
  var n = parseFloat(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : '';
}

// Normalize client-supplied items: skip empty rows, assign itemNo,
// compute lineTotal = qty × unitPrice (blank unless both numeric).
function normalizeItems_(raw) {
  var items = [];
  (raw || []).forEach(function (r) {
    if (!r || !String(r.description || '').trim()) return;
    var it = {};
    ITEM_FIELDS.forEach(function (f) { it[f] = r[f] != null ? String(r[f]) : ''; });
    var q = numOrBlank_(it.qty), u = numOrBlank_(it.unitPrice);
    it.lineTotal = (q !== '' && u !== '') ? Math.round(q * u * 100) / 100 : '';
    items.push(it);
  });
  var sum = 0, any = false;
  items.forEach(function (it, i) {
    it.itemNo = i + 1;
    if (it.lineTotal !== '') { sum += it.lineTotal; any = true; }
  });
  return { items: items, totalAmount: any ? Math.round(sum * 100) / 100 : '' };
}

// Replace-all write of a PR's items. Caller must hold withLock_.
function writeItemsForPr_(prId, items) {
  var sh = itemSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (cellStr_(data[i][0]) === prId) sh.deleteRow(i + 1);
  }
  if (items.length) {
    var rows = items.map(function (it) {
      return ITEM_HEADERS.map(function (h) { return h === 'prId' ? prId : (it[h] != null ? it[h] : ''); });
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, ITEM_HEADERS.length).setValues(rows);
  }
}

function itemSummary_(items) {
  if (!items.length) return '';
  var first = items[0].description || '';
  return items.length > 1 ? first + ' (+' + (items.length - 1) + ' more)' : first;
}
```

- [ ] **Step 2: Verify logic parity with Task 1**

`normalizeItems_`'s lineTotal/total math must match `computeLineTotal`/`computeTotalAmount` in `frontend/src/lib/items.js` (2-decimal rounding, blank-on-missing). Re-read both and confirm.

- [ ] **Step 3: Commit**

```bash
git add apps-script/items.gs
git commit -m "feat: Items tab helpers with server-side line total computation"
```

---

### Task 3: Master data modules (`lists.gs`, `vendors.gs`)

**Files:**
- Create: `apps-script/lists.gs`
- Create: `apps-script/vendors.gs`

**Interfaces:**
- Consumes: `sheet_`, `cellStr_`, `nowIso_` from `Code.gs`; `log_` from `prs.gs`.
- Produces (used by Tasks 4, 5, 6):
  - `LISTS_HEADERS`, `LISTS_SEED`
  - `getLists_() -> { departments: [], materialTypes: [], ... }` (CacheService, 300 s)
  - `VENDOR_HEADERS`, `listVendors_() -> vendor[]`, `ensureVendor_(name, user)` — case-insensitive auto-register; caller holds `withLock_`

- [ ] **Step 1: Write `apps-script/lists.gs`**

```js
// ===== Lists tab: one column per dropdown list =====
// Admins edit this tab directly in the sheet; no UI, no route.

var LISTS_HEADERS = ['departments', 'materialTypes', 'priorities', 'couriers',
  'paymentTerms', 'units', 'currencies'];

var LISTS_SEED = {
  departments: ['Admin', 'Device Management', 'Environment', 'Marketing', 'Production',
    'Projects', 'QC', 'R&D', 'Sales', 'Support'],
  materialTypes: ['Asset', 'Inventory', 'Local Purchase', 'Subscription', 'Certification'],
  priorities: ['High', 'Medium', 'Low'],
  couriers: ['BlueDart', 'DHL', 'FedEx', 'DTDC', 'India Post', 'Amazon', 'Porter', 'Delhivery', 'Other'],
  paymentTerms: ['Advance 100%', 'Advance 50%', 'Net 15', 'Net 30', 'On Delivery', 'Milestone'],
  units: ['pcs', 'L', 'kg', 'm', 'set', 'box', 'license'],
  currencies: ['INR', 'USD', 'EUR']
};

function getLists_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('lists-v3');
  if (hit) return JSON.parse(hit);
  var data = sheet_('Lists', LISTS_HEADERS).getDataRange().getValues();
  var out = {};
  LISTS_HEADERS.forEach(function (h, c) {
    out[h] = [];
    for (var r = 1; r < data.length; r++) {
      var v = cellStr_(data[r][c]);
      if (v) out[h].push(v);
    }
  });
  cache.put('lists-v3', JSON.stringify(out), 300);
  return out;
}
```

- [ ] **Step 2: Write `apps-script/vendors.gs`**

```js
// ===== Vendors tab: canonical vendor registry =====

var VENDOR_HEADERS = ['name', 'website', 'contactEmail', 'phone', 'notes', 'addedBy', 'addedAt'];

function vendorSheet_() { return sheet_('Vendors', VENDOR_HEADERS); }

function listVendors_() {
  var data = vendorSheet_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var v = {};
    VENDOR_HEADERS.forEach(function (h, c) { v[h] = cellStr_(data[i][c]); });
    if (v.name) out.push(v);
  }
  return out;
}

// Auto-register an unseen vendor name (case-insensitive match).
// Called from create/update while withLock_ is held; every add is logged.
function ensureVendor_(name, user) {
  var clean = String(name).trim();
  if (!clean) return;
  var lower = clean.toLowerCase();
  var exists = listVendors_().some(function (v) { return v.name.toLowerCase() === lower; });
  if (exists) return;
  vendorSheet_().appendRow([clean, '', '', '', '', user.email, nowIso_()]);
  log_(user, '', 'vendorAdd', clean);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps-script/lists.gs apps-script/vendors.gs
git commit -m "feat: Lists and Vendors master-data modules"
```

---

### Task 4: PR routes v3 (`prs.gs`)

**Files:**
- Modify: `apps-script/prs.gs` (headers at lines 1–9, routes at lines 97–166)

**Interfaces:**
- Consumes: Task 2 (`normalizeItems_`, `writeItemsForPr_`, `listAllItems_`, `itemSummary_`), Task 3 (`getLists_`, `listVendors_`, `ensureVendor_`).
- Produces: API contract for Tasks 8–10:
  - `list` → `{ prs, items, lists, vendors, me }`
  - `create` body `{ pr, items: [...] }`; `update` body `{ id, updates, items?: [...] }` (items = replace-all when present)
  - `delete` cascades item rows.

- [ ] **Step 1: Replace `PR_HEADERS` and `EDITABLE_FIELDS` (prs.gs lines 1–9)**

```js
var PR_HEADERS = ['id', 'createdAt', 'department', 'project', 'purpose', 'requesterEmail',
  'requestedByName', 'vendor', 'totalAmount', 'currency', 'status', 'priority',
  'approverEmail', 'approvedByName', 'approvedAt', 'paymentStatus', 'paymentTerm',
  'poNo', 'poDate', 'invoiceNo', 'invoiceDate', 'quotationDoc', 'courier', 'trackingNo',
  'trackingLink', 'expectedDate', 'receivedAt', 'notes', 'updatedAt'];

var LOG_HEADERS = ['timestamp', 'user', 'prId', 'action', 'detail'];

// fields a requester/approver may edit directly (status changes go through
// 'transition'; totalAmount is always server-computed from items)
var EDITABLE_FIELDS = ['department', 'project', 'purpose', 'requestedByName', 'vendor',
  'currency', 'priority', 'approvedByName', 'paymentStatus', 'paymentTerm', 'poNo', 'poDate',
  'invoiceNo', 'invoiceDate', 'quotationDoc', 'courier', 'trackingNo', 'trackingLink',
  'expectedDate', 'notes'];
```

`DEV_FIELDS` (line 12) stays as-is (`PR_HEADERS.filter(h => h !== 'id')`) — it picks up the new columns automatically.

- [ ] **Step 2: Replace the `list` route (currently lines 97–99)**

```js
registerRoute_('list', { minRole: 'viewer' }, function (user) {
  return {
    prs: listPrs_(),
    items: listAllItems_(),
    lists: getLists_(),
    vendors: listVendors_(),
    me: { email: user.email, role: user.role }
  };
});
```

- [ ] **Step 3: Replace the `create` route (currently lines 101–112)**

```js
registerRoute_('create', { minRole: 'requester' }, function (user, body) {
  var d = body.pr || {};
  var norm = normalizeItems_(body.items);
  if (!norm.items.length) throw new Error('At least one item with a description is required');
  if (!d.department) throw new Error('Department is required');
  return withLock_(function () {
    var pr = { id: nextId_(), createdAt: nowIso_(), requesterEmail: user.email, status: 'Submitted', updatedAt: nowIso_() };
    EDITABLE_FIELDS.forEach(function (f) { pr[f] = d[f] != null ? String(d[f]) : ''; });
    pr.totalAmount = norm.totalAmount;
    if (pr.vendor) ensureVendor_(pr.vendor, user);
    prSheet_().appendRow(PR_HEADERS.map(function (h) { return pr[h] || ''; }));
    writeItemsForPr_(pr.id, norm.items);
    log_(user, pr.id, 'create', itemSummary_(norm.items));
    return { pr: pr };
  });
});
```

- [ ] **Step 4: Replace the `update` route (currently lines 114–137)**

```js
registerRoute_('update', { minRole: 'requester' }, function (user, body) {
  return withLock_(function () {
    var pr = findPr_(body.id);
    var isOwn = pr.requesterEmail.toLowerCase() === user.email;
    var isStaff = user.role === 'approver' || user.role === 'admin' || user.role === 'developer';
    if (!isStaff && !(isOwn && pr.status === 'Submitted')) {
      throw new Error('You can only edit your own PRs while they are Submitted');
    }
    var changes = [];
    var fields = user.role === 'developer' ? DEV_FIELDS : EDITABLE_FIELDS;
    fields.forEach(function (f) {
      if (body.updates && body.updates[f] != null && String(body.updates[f]) !== pr[f]) {
        changes.push(f + ': "' + pr[f] + '" → "' + body.updates[f] + '"');
        pr[f] = String(body.updates[f]);
      }
    });
    if (body.items != null) {
      var norm = normalizeItems_(body.items);
      if (!norm.items.length) throw new Error('At least one item with a description is required');
      if (String(norm.totalAmount) !== pr.totalAmount) {
        changes.push('totalAmount: "' + pr.totalAmount + '" → "' + norm.totalAmount + '"');
      }
      pr.totalAmount = String(norm.totalAmount);
      writeItemsForPr_(pr.id, norm.items);
      changes.push('items: ' + norm.items.length + ' row(s) rewritten');
    }
    if (changes.length) {
      if (pr.vendor) ensureVendor_(pr.vendor, user);
      pr.updatedAt = nowIso_();
      writePr_(pr);
      log_(user, pr.id, 'update', changes.join('; '));
    }
    return { pr: pr };
  });
});
```

- [ ] **Step 5: Cascade in the `delete` route (currently lines 159–166)**

```js
registerRoute_('delete', { minRole: 'developer' }, function (user, body) {
  return withLock_(function () {
    var pr = findPr_(body.id);
    writeItemsForPr_(pr.id, []); // remove item rows first
    prSheet_().deleteRow(pr._row);
    log_(user, pr.id, 'delete', JSON.stringify(pr).slice(0, 500));
    return { deleted: pr.id };
  });
});
```

Note: `findPr_(body.id)` must be re-resolved AFTER `writeItemsForPr_` only if items lived on the same sheet — they don't (separate tab), so `pr._row` stays valid.

- [ ] **Step 6: Manual verification (Apps Script editor, after deploy in Task 12)**

Deferred to the E2E checklist — no editor run possible before the new sheet exists (Task 5).

- [ ] **Step 7: Commit**

```bash
git add apps-script/prs.gs
git commit -m "feat: v3 PR schema and routes with multi-item support"
```

---

### Task 5: Setup script (`setup.gs`)

**Files:**
- Create: `apps-script/setup.gs`

**Interfaces:**
- Consumes: `PR_HEADERS`, `LOG_HEADERS`, `TRANSITIONS_` (prs.gs), `ITEM_HEADERS` (items.gs), `LISTS_HEADERS`, `LISTS_SEED` (lists.gs), `VENDOR_HEADERS` (vendors.gs), `sheet_` (Code.gs).
- Produces: `setupV3()` — run once from the Apps Script editor on the NEW spreadsheet.

- [ ] **Step 1: Write `apps-script/setup.gs`**

```js
// ===== One-time v3 spreadsheet bootstrap =====
// Run setupV3() from the Apps Script editor of the NEW spreadsheet.
// Idempotent: sheet_() only creates missing tabs; Lists is only seeded when empty;
// re-applying validations is harmless.

function setupV3() {
  sheet_('PRs', PR_HEADERS);
  sheet_('Items', ITEM_HEADERS);
  sheet_('Users', ['email', 'role', 'addedBy', 'addedAt']);
  sheet_('Log', LOG_HEADERS);
  var lists = sheet_('Lists', LISTS_HEADERS);
  sheet_('Vendors', VENDOR_HEADERS);

  if (lists.getLastRow() < 2) {
    var maxLen = 0;
    LISTS_HEADERS.forEach(function (h) { maxLen = Math.max(maxLen, LISTS_SEED[h].length); });
    var rows = [];
    for (var r = 0; r < maxLen; r++) {
      rows.push(LISTS_HEADERS.map(function (h) { return LISTS_SEED[h][r] || ''; }));
    }
    lists.getRange(2, 1, rows.length, LISTS_HEADERS.length).setValues(rows);
  }
  applyValidations_();
  Logger.log('v3 tabs ready.');
}

function applyValidations_() {
  var lists = ss_().getSheetByName('Lists');
  var prs = ss_().getSheetByName('PRs');
  var items = ss_().getSheetByName('Items');
  var N = 1000; // validated data rows

  function fromLists(listName) {
    var col = LISTS_HEADERS.indexOf(listName) + 1;
    return SpreadsheetApp.newDataValidation()
      .requireValueInRange(lists.getRange(2, col, 500, 1), true)
      .setAllowInvalid(true).build();
  }
  function fromValues(values) {
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true).setAllowInvalid(true).build();
  }
  function apply(sh, headers, field, rule) {
    sh.getRange(2, headers.indexOf(field) + 1, N, 1).setDataValidation(rule);
  }

  apply(prs, PR_HEADERS, 'department', fromLists('departments'));
  apply(prs, PR_HEADERS, 'currency', fromLists('currencies'));
  apply(prs, PR_HEADERS, 'priority', fromLists('priorities'));
  apply(prs, PR_HEADERS, 'paymentTerm', fromLists('paymentTerms'));
  apply(prs, PR_HEADERS, 'courier', fromLists('couriers'));
  apply(prs, PR_HEADERS, 'status', fromValues(Object.keys(TRANSITIONS_)));
  apply(prs, PR_HEADERS, 'paymentStatus', fromValues(['Unpaid', 'Paid', 'Partially Paid', 'FOC / Free']));
  apply(items, ITEM_HEADERS, 'materialType', fromLists('materialTypes'));
  apply(items, ITEM_HEADERS, 'unit', fromLists('units'));
}
```

- [ ] **Step 2: Commit**

```bash
git add apps-script/setup.gs
git commit -m "feat: one-time v3 spreadsheet bootstrap with seeded lists and validation"
```

---

### Task 6: Migration v2 (`migrate.gs` rewrite)

**Files:**
- Modify: `apps-script/migrate.gs` (full rewrite; v1 logic is superseded)

**Interfaces:**
- Consumes: Task 2 (`itemSheet_`, `ITEM_HEADERS`), Task 3 (`vendorSheet_`), `prSheet_`/`PR_HEADERS` (Task 4), `norm_` kept from v1.
- Produces:
  - `HEADER_MAP` — also consumed by `formSubmit.gs` (Task 7). Field keys now match v3 names: `requestedByName`, `project`, `purpose`, `poNo`, etc.
  - `dumpLegacyHeaders()` — logs old file's headers for map verification
  - `migrateLegacyV3()` — one-time, idempotent

- [ ] **Step 1: Rewrite `apps-script/migrate.gs`**

```js
// ===== One-time migration v2: legacy spreadsheet dept tabs → v3 PRs + Items =====
// 1. Paste the OLD spreadsheet's Drive file id into LEGACY_FILE_ID.
// 2. Run dumpLegacyHeaders() and eyeball unmapped headers; extend HEADER_MAP if needed.
// 3. Run migrateLegacyV3(). Idempotent (skips when PRs has data). Old file is never written.

var LEGACY_FILE_ID = ''; // <-- old spreadsheet id (from its URL)

var LEGACY_SKIP_TABS = ['PRs', 'Users', 'Log', 'Form Responses 1'];

// normalized legacy header → v3 field. Item-level and PR-level fields mixed;
// splitLegacyRow_ decides which goes where.
var HEADER_MAP = {
  // item-level
  item: ['item', 'itemname', 'itemdescription', 'description', 'material', 'materialname', 'product', 'particulars', 'productdescription'],
  qty: ['qty', 'quantity', 'nos', 'noofunits'],
  partNo: ['zohopartnumber', 'partno', 'partnumber'],
  materialType: ['typesofmaterial', 'materialtype', 'category'],
  purchaseLink: ['purchaselink', 'producturl', 'link'],
  datasheetDoc: ['datasheet', 'specdocument'],
  // PR-level
  vendor: ['vendor', 'vendorname', 'supplier', 'suppliername', 'party', 'platform', 'source'],
  amount: ['amount', 'price', 'cost', 'value', 'total', 'totalamount', 'totalcost', 'approxcost'],
  currency: ['currency', 'cur'],
  priority: ['priority', 'urgency'],
  status: ['status', 'materialstatus', 'orderstatus', 'currentstatus', 'prstatus'],
  paymentStatus: ['payment', 'paymentstatus', 'paymentstate'],
  paymentTerm: ['paymentterm', 'paymentterms'],
  courier: ['courier', 'couriername', 'shippingvia', 'ffcourier'],
  trackingNo: ['tracking', 'trackingno', 'trackingnumber', 'awb', 'awbno', 'consignmentno'],
  trackingLink: ['trackinglink'],
  expectedDate: ['expecteddate', 'expecteddelivery', 'eta', 'deliverydate', 'duedate'],
  receivedAt: ['receiveddate', 'receivedon', 'matrcvdate'],
  createdAt: ['prdate', 'requestdate', 'requesteddate', 'createdat', 'timestamp'],
  requesterEmail: ['email', 'emailaddress'],
  requestedByName: ['requestedby', 'requester', 'raisedby'],
  approvedByName: ['approvedby'],
  project: ['projectdetails', 'project'],
  purpose: ['purposeofpurchase', 'purpose'],
  poNo: ['pono', 'ponumber'],
  poDate: ['podate'],
  invoiceNo: ['invoiceorderno', 'invoiceno', 'orderno'],
  invoiceDate: ['invoiceorderdate', 'invoicedate'],
  quotationDoc: ['pipoquotation', 'quotation'],
  notes: ['remarks', 'notes', 'comment', 'comments'],
  department: ['department', 'departmentname', 'dept']
};

// long/mangled legacy headers matched by prefix when no exact hit
var HEADER_PREFIX_MAP = {
  datasheetDoc: ['materialrequirementspecificdocument'],
  invoiceNo: ['quotenopino']
};

var ITEM_LEVEL_FIELDS = ['item', 'qty', 'partNo', 'materialType', 'purchaseLink', 'datasheetDoc'];

var OLD_STATUS_MAP = {
  'in process': 'Ordered', 'in transit': 'In Transit', 'received': 'Received',
  'cancelled': 'Cancelled', 'on hold': 'On Hold'
};

function norm_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function legacySs_() {
  if (!LEGACY_FILE_ID) throw new Error('Set LEGACY_FILE_ID at the top of migrate.gs first');
  return SpreadsheetApp.openById(LEGACY_FILE_ID);
}

function dumpLegacyHeaders() {
  var out = {};
  legacySs_().getSheets().forEach(function (sh) {
    if (LEGACY_SKIP_TABS.indexOf(sh.getName()) !== -1 || sh.getLastRow() < 1) return;
    out[sh.getName()] = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  });
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

// header row → { field: colIndex } using exact then prefix matching
function resolveIdx_(headers) {
  var idx = {};
  Object.keys(HEADER_MAP).forEach(function (field) {
    for (var c = 0; c < headers.length; c++) {
      if (HEADER_MAP[field].indexOf(headers[c]) !== -1) { idx[field] = c; return; }
    }
    var prefixes = HEADER_PREFIX_MAP[field] || [];
    for (var c2 = 0; c2 < headers.length; c2++) {
      for (var p = 0; p < prefixes.length; p++) {
        if (headers[c2].indexOf(prefixes[p]) === 0) { idx[field] = c2; return; }
      }
    }
  });
  return idx;
}

// "10 L" → { qty: '10', unit: 'L' }; non-numeric qty → unit only
function parseQtyUnit_(s) {
  var t = String(s || '').trim();
  if (!t) return { qty: '', unit: '' };
  var m = t.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return { qty: '', unit: t.slice(0, 20) };
  return { qty: m[1], unit: (m[2] || '').slice(0, 20) };
}

// GAS port of frontend parseAmtStr (frontend/src/lib/currency.js:27).
// Returns { amt } | { amt, note } | { note } | {} — never guesses.
function parseAmount_(s) {
  if (s == null) return {};
  var t = String(s).trim();
  if (['', 'na', 'n/a', '-', 'nan', 'tbd', '--'].indexOf(t.toLowerCase()) !== -1) return {};
  var m = t.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (!m) return { note: t.slice(0, 80) };
  var amt = Math.round(parseFloat(m[1].replace(/,/g, '')) * 100) / 100;
  var clean = t.replace(/[\d,.\s₹$€£¥]+/g, '').toLowerCase();
  var trivial = ['inr', 'usd', 'rs', 'eur', 'euro', 'gbp'];
  return (clean && trivial.indexOf(clean) === -1) ? { amt: amt, note: t.slice(0, 80) } : { amt: amt };
}

var CUR_TOKENS_ = [
  ['USD', ['usd', 'us$', 'dollar', '$']], ['EUR', ['euro', 'eur', '€']], ['GBP', ['gbp', 'pound', '£']],
  ['INR', ['inr', 'rupee', 'rs.', 'rs ', '₹']], ['AED', ['aed', 'dirham']], ['SGD', ['sgd']]
];

function detectCurrency_(curCol, amtStr) {
  var probe = [curCol, amtStr];
  for (var i = 0; i < probe.length; i++) {
    var t = String(probe[i] || '').toLowerCase();
    if (!t) continue;
    for (var c = 0; c < CUR_TOKENS_.length; c++) {
      var toks = CUR_TOKENS_[c][1];
      for (var k = 0; k < toks.length; k++) if (t.indexOf(toks[k]) !== -1) return CUR_TOKENS_[c][0];
    }
    if (/^[a-z]{3}$/.test(t.trim())) return t.trim().toUpperCase();
  }
  return '';
}

function migrateLegacyV3() {
  var target = prSheet_();
  if (target.getLastRow() > 1) {
    Logger.log('PRs tab already has data — migration skipped (idempotent).');
    return 0;
  }
  var prRows = [], itemRows = [], vendorRows = [], vendorSeen = {};
  var counter = 0;

  legacySs_().getSheets().forEach(function (sh) {
    var tab = sh.getName();
    if (LEGACY_SKIP_TABS.indexOf(tab) !== -1 || sh.getLastRow() < 2) return;
    var data = sh.getDataRange().getValues();
    var headers = data[0].map(norm_);
    var idx = resolveIdx_(headers);
    var mapped = Object.keys(idx).map(function (f) { return idx[f]; });

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (row.every(function (c) { return c === '' || c == null; })) continue;
      counter++;
      var raw = {};
      Object.keys(idx).forEach(function (f) { raw[f] = cellStr_(row[idx[f]]); });

      var pr = { id: 'PR-MIG-' + ('00000' + counter).slice(-5), department: tab, updatedAt: nowIso_() };
      Object.keys(raw).forEach(function (f) {
        if (ITEM_LEVEL_FIELDS.indexOf(f) === -1 && f !== 'amount') pr[f] = raw[f];
      });
      pr.department = tab; // tab name wins over any mapped Department column
      pr.status = OLD_STATUS_MAP[String(pr.status || '').toLowerCase().trim()] || 'Received';
      pr.requesterEmail = String(pr.requesterEmail || '').toLowerCase();
      if (!pr.createdAt) pr.createdAt = nowIso_();

      // money: parsed number → lineTotal + totalAmount; unparseable → notes verbatim
      var money = parseAmount_(raw.amount);
      pr.totalAmount = money.amt != null ? money.amt : '';
      pr.currency = detectCurrency_(raw.currency, raw.amount);
      if (money.note) pr.notes = ((pr.notes || '') + ' | amount: ' + money.note).replace(/^ \| /, '');

      // preserve unmapped columns in notes (same as v1)
      var extras = [];
      for (var c = 0; c < row.length; c++) {
        if (mapped.indexOf(c) === -1 && cellStr_(row[c])) {
          extras.push(String(data[0][c]) + ': ' + cellStr_(row[c]));
        }
      }
      if (extras.length) pr.notes = ((pr.notes || '') + ' | ' + extras.join(' | ')).replace(/^ \| /, '');

      // single item per legacy row; lineTotal carries the row's parsed total
      var qu = parseQtyUnit_(raw.qty);
      itemRows.push(ITEM_HEADERS.map(function (h) {
        return { prId: pr.id, itemNo: 1, description: raw.item || '', partNo: raw.partNo || '',
                 materialType: raw.materialType || '', qty: qu.qty, unit: qu.unit, unitPrice: '',
                 lineTotal: pr.totalAmount, purchaseLink: raw.purchaseLink || '',
                 datasheetDoc: raw.datasheetDoc || '' }[h];
      }));

      var vkey = String(pr.vendor || '').trim().toLowerCase();
      if (vkey && !vendorSeen[vkey]) {
        vendorSeen[vkey] = true;
        vendorRows.push([String(pr.vendor).trim(), '', '', '', '', 'migration', nowIso_()]);
      }

      prRows.push(PR_HEADERS.map(function (h) { return pr[h] != null ? pr[h] : ''; }));
    }
  });

  if (prRows.length) target.getRange(2, 1, prRows.length, PR_HEADERS.length).setValues(prRows);
  if (itemRows.length) itemSheet_().getRange(2, 1, itemRows.length, ITEM_HEADERS.length).setValues(itemRows);
  if (vendorRows.length) vendorSheet_().getRange(2, 1, vendorRows.length, VENDOR_HEADERS.length).setValues(vendorRows);
  Logger.log('Migrated ' + prRows.length + ' PRs, ' + itemRows.length + ' items, ' + vendorRows.length + ' vendors.');
  return prRows.length;
}
```

- [ ] **Step 2: Verify no dangling references**

`formSubmit.gs` still references `HEADER_MAP` and `norm_` — both survive in the rewrite (checked). v1's `dumpHeaders`/`migrateDeptTabs`/`SYSTEM_TABS` are gone; grep to confirm nothing else used them:

Run: `grep -rn "migrateDeptTabs\|SYSTEM_TABS\|dumpHeaders" apps-script/ frontend/src/`
Expected: no matches outside `migrate.gs`.

- [ ] **Step 3: Commit**

```bash
git add apps-script/migrate.gs
git commit -m "feat: migration v2 from legacy spreadsheet to v3 PRs/Items/Vendors"
```

---

### Task 7: Form intake v2 (`formSubmit.gs`)

**Files:**
- Modify: `apps-script/formSubmit.gs` (full body of `onFormSubmit`)

**Interfaces:**
- Consumes: `HEADER_MAP`, `resolveIdx_`, `parseQtyUnit_`, `parseAmount_`, `detectCurrency_`, `norm_` (Task 6); `normalizeItems_` shape not used — item is built directly; `writeItemsForPr_` (Task 2); `ensureVendor_` (Task 3).
- Produces: form submissions land as 1 `PRs` row + 1 `Items` row.

- [ ] **Step 1: Rewrite `onFormSubmit`**

```js
// ===== Google Form intake → v3 PRs + Items =====
// Requires the installable trigger on the NEW spreadsheet: On form submit.
// Form rows land in 'Form Responses 1' (Google manages that tab); this handler
// creates a PR (header) + a single Items row so the dashboard sees it.

function onFormSubmit(e) {
  if (!e || !e.values) return;
  var responseSheet = ss_().getSheetByName('Form Responses 1');
  if (!responseSheet) return;
  var rawHeaders = responseSheet.getRange(1, 1, 1, responseSheet.getLastColumn()).getValues()[0];
  var headers = rawHeaders.map(norm_);
  var idx = resolveIdx_(headers);

  var raw = {};
  Object.keys(idx).forEach(function (f) { raw[f] = cellStr_(e.values[idx[f]]); });
  if (!raw.department) return; // same guard as before

  var pr = { status: 'Submitted', updatedAt: nowIso_() };
  Object.keys(raw).forEach(function (f) {
    if (ITEM_LEVEL_FIELDS.indexOf(f) === -1 && f !== 'amount' && f !== 'status') pr[f] = raw[f];
  });
  pr.status = 'Submitted'; // form entries always start the workflow
  pr.requesterEmail = String(pr.requesterEmail || '').toLowerCase();
  if (!pr.createdAt) pr.createdAt = nowIso_();

  var money = parseAmount_(raw.amount);
  pr.totalAmount = money.amt != null ? money.amt : '';
  pr.currency = detectCurrency_(raw.currency, raw.amount);
  if (money.note) pr.notes = ((pr.notes || '') + ' | amount: ' + money.note).replace(/^ \| /, '');

  // preserve unmapped form columns in notes
  var mapped = Object.keys(idx).map(function (f) { return idx[f]; });
  var extras = [];
  for (var c = 0; c < e.values.length && c < rawHeaders.length; c++) {
    if (mapped.indexOf(c) === -1 && cellStr_(e.values[c])) {
      extras.push(String(rawHeaders[c]) + ': ' + cellStr_(e.values[c]));
    }
  }
  if (extras.length) pr.notes = ((pr.notes || '') + ' | ' + extras.join(' | ')).replace(/^ \| /, '');

  var qu = parseQtyUnit_(raw.qty);
  var item = { itemNo: 1, description: raw.item || '(form submission)', partNo: raw.partNo || '',
               materialType: raw.materialType || '', qty: qu.qty, unit: qu.unit, unitPrice: '',
               lineTotal: pr.totalAmount, purchaseLink: raw.purchaseLink || '',
               datasheetDoc: raw.datasheetDoc || '' };

  withLock_(function () {
    pr.id = nextId_();
    var user = { email: pr.requesterEmail || 'google-form' };
    if (pr.vendor) ensureVendor_(pr.vendor, user);
    prSheet_().appendRow(PR_HEADERS.map(function (h) { return pr[h] != null ? pr[h] : ''; }));
    writeItemsForPr_(pr.id, [item]);
    log_(user, pr.id, 'create', 'via Google Form: ' + item.description);
    return null;
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps-script/formSubmit.gs
git commit -m "feat: form intake v2 creates PR header plus item row"
```

---

### Task 8: Frontend state join (`state.js`)

**Files:**
- Modify: `frontend/src/state.js:1-31`

**Interfaces:**
- Consumes: Task 1 (`decoratePrs`), Task 4 (`list` response `{ prs, items, lists, vendors, me }`).
- Produces: store state shape `{ prs (decorated), lists, vendors, me, lastSync, err, loading }` — Tasks 9–11 read `s.lists`, `s.vendors`, `s.prs[n].items`.

- [ ] **Step 1: Update imports and initial state (lines 1–4)**

```js
import { api } from './api.js';
import { decoratePrs } from './lib/items.js';

const POLL_MS = 60000;
let state = { prs: [], lists: {}, vendors: [], me: null, lastSync: null, err: '', loading: false };
```

- [ ] **Step 2: Update `refresh()` success branch (line 23)**

```js
      const d = await api('list');
      hadSession = true;
      state = {
        prs: decoratePrs(d.prs, d.items || []),
        lists: d.lists || {},
        vendors: d.vendors || [],
        me: d.me, lastSync: new Date(), err: '', loading: false
      };
```

- [ ] **Step 3: Run the suite**

Run: `cd frontend && npx vitest run`
Expected: PASS (state.js has no unit tests; this catches import errors via any suite that transitively imports).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/state.js
git commit -m "feat: store items/lists/vendors and decorate PRs on refresh"
```

---

### Task 9: Multi-item PR form (`prForm.js` rewrite)

**Files:**
- Modify: `frontend/src/views/prForm.js` (full rewrite)

**Interfaces:**
- Consumes: `s.lists` (departments, materialTypes, priorities, couriers, paymentTerms, units, currencies), `s.vendors`, `s.prs[n].items` (Task 8); API contract from Task 4; `computeLineTotal`, `computeTotalAmount` (Task 1); `fmtMoney` (`lib/currency.js`).
- Produces: `prFormView(el, s, editId)` — same signature as today (router in `main.js` unchanged). Exports `COURIERS` no longer needed — verify no other importer first (Step 5).

- [ ] **Step 1: Rewrite `frontend/src/views/prForm.js`**

```js
import { api } from '../api.js';
import { store } from '../state.js';
import { toast, esc } from '../ui.js';
import { STATUSES } from '../lib/status.js';
import { computeLineTotal, computeTotalAmount } from '../lib/items.js';
import { fmtMoney } from '../lib/currency.js';

const PAYMENTS = ['Unpaid', 'Paid', 'Partially Paid', 'FOC / Free'];
const FALLBACK = {
  priorities: ['High', 'Medium', 'Low'],
  currencies: ['INR', 'USD', 'EUR'],
  couriers: ['BlueDart', 'DHL', 'FedEx', 'DTDC', 'India Post', 'Other'],
  departments: [], materialTypes: [], paymentTerms: [], units: []
};

const list = (s, name) => (s.lists && s.lists[name] && s.lists[name].length ? s.lists[name] : FALLBACK[name]) || [];

// Keep a stored value selectable even if it's not in the list (e.g. legacy data),
// otherwise saving silently rewrites it to the first <option>.
function opts(values, sel, blank) {
  const all = sel && !values.includes(sel) ? [...values, sel] : values;
  return (blank ? ['', ...all] : all)
    .map(v => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

function itemRowHtml(s, it = {}, i = 0) {
  return `<div class="itemrow" data-i="${i}">
    <input name="i_description" placeholder="Item / description*" required value="${esc(it.description)}">
    <input name="i_partNo" placeholder="Part no" value="${esc(it.partNo)}">
    <select name="i_materialType">${opts(list(s, 'materialTypes'), it.materialType || '', true)}</select>
    <input name="i_qty" type="number" step="any" min="0" placeholder="Qty" value="${esc(it.qty)}">
    <select name="i_unit">${opts(list(s, 'units'), it.unit || '', true)}</select>
    <input name="i_unitPrice" type="number" step="0.01" min="0" placeholder="Unit price" value="${esc(it.unitPrice)}">
    <input name="i_purchaseLink" placeholder="Purchase link" value="${esc(it.purchaseLink)}">
    <input name="i_datasheetDoc" placeholder="Datasheet / doc URL" value="${esc(it.datasheetDoc)}">
    <button type="button" class="btn danger rmItem" title="Remove item">×</button>
  </div>`;
}

function collectItems(form) {
  return [...form.querySelectorAll('.itemrow')].map(row => {
    const get = n => row.querySelector(`[name="${n}"]`).value.trim();
    return {
      description: get('i_description'), partNo: get('i_partNo'),
      materialType: get('i_materialType'), qty: get('i_qty'), unit: get('i_unit'),
      unitPrice: get('i_unitPrice'), purchaseLink: get('i_purchaseLink'),
      datasheetDoc: get('i_datasheetDoc')
    };
  }).filter(it => it.description);
}

export function prFormView(el, s, editId) {
  const editing = editId ? s.prs.find(p => p.id === editId) : null;
  const p = editing || {};
  const items = editing ? (p.items || []) : [{}];
  const me = s.me || { role: 'viewer' };
  const staff = ['approver', 'admin', 'developer'].includes(me.role);
  const vendorNames = (s.vendors || []).map(v => v.name);

  el.innerHTML = `
    <div class="card"><h2>${editing ? 'Edit ' + esc(p.id) : 'New Purchase Request'}</h2>
    <form class="pr" id="prForm">
      <label>Department* <select name="department" required>${opts(list(s, 'departments'), p.department || '', true)}</select></label>
      <label>Requested by (name) <input name="requestedByName" value="${esc(p.requestedByName)}"></label>
      <label>Project <input name="project" value="${esc(p.project)}"></label>
      <label>Purpose <input name="purpose" value="${esc(p.purpose)}"></label>
      <label>Vendor <input name="vendor" list="vendors" value="${esc(p.vendor)}">
        <datalist id="vendors">${vendorNames.map(v => `<option>${esc(v)}</option>`).join('')}</datalist></label>
      <label>Currency <select name="currency">${opts(list(s, 'currencies'), p.currency || 'INR')}</select></label>
      <label>Priority <select name="priority">${opts(list(s, 'priorities'), p.priority || 'Medium')}</select></label>
      <label>Expected delivery <input name="expectedDate" type="date" value="${esc((p.expectedDate || '').slice(0, 10))}"></label>

      <div class="full"><h3 style="margin:8px 0 4px">Items</h3>
        <div id="itemRows">${items.map((it, i) => itemRowHtml(s, it, i)).join('')}</div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:6px">
          <button type="button" class="btn" id="addItem">+ Add item</button>
          <span id="liveTotal" style="color:var(--mut)"></span>
        </div>
      </div>

      ${staff ? `
      <label>Payment status <select name="paymentStatus">${opts(PAYMENTS, p.paymentStatus || 'Unpaid')}</select></label>
      <label>Payment term <select name="paymentTerm">${opts(list(s, 'paymentTerms'), p.paymentTerm || '', true)}</select></label>
      <label>PO no <input name="poNo" value="${esc(p.poNo)}"></label>
      <label>PO date <input name="poDate" type="date" value="${esc((p.poDate || '').slice(0, 10))}"></label>
      <label>Invoice / order no <input name="invoiceNo" value="${esc(p.invoiceNo)}"></label>
      <label>Invoice date <input name="invoiceDate" type="date" value="${esc((p.invoiceDate || '').slice(0, 10))}"></label>
      <label>Quotation / PI doc URL <input name="quotationDoc" value="${esc(p.quotationDoc)}"></label>
      <label>Approved by (name) <input name="approvedByName" value="${esc(p.approvedByName)}"></label>
      <label>Courier <select name="courier">${opts(list(s, 'couriers'), p.courier || '', true)}</select></label>
      <label>Tracking number <input name="trackingNo" value="${esc(p.trackingNo)}"></label>
      <label>Tracking link <input name="trackingLink" value="${esc(p.trackingLink)}"></label>` : ''}

      ${editing && me.role === 'developer' ? `
      <label>Status (dev override) <select name="status">${opts(STATUSES, p.status)}</select></label>
      <label>Requester email (dev override) <input name="requesterEmail" value="${esc(p.requesterEmail)}"></label>` : ''}

      <label class="full">Notes <textarea name="notes" rows="3">${esc(p.notes)}</textarea></label>
      <div class="full" style="display:flex;gap:10px">
        <button class="btn primary" type="submit">${editing ? 'Save changes' : 'Submit PR'}</button>
        <a class="btn" href="${editing ? '#/pr/' + esc(p.id) : '#/'}">Cancel</a>
      </div>
    </form></div>`;

  const form = el.querySelector('#prForm');
  const rowsEl = el.querySelector('#itemRows');

  const renderTotal = () => {
    const its = collectItems(form).map(it => ({ lineTotal: computeLineTotal(it.qty, it.unitPrice) }));
    const total = computeTotalAmount(its);
    const cur = form.querySelector('[name="currency"]').value || 'INR';
    el.querySelector('#liveTotal').textContent = total === '' ? '' : 'Total: ' + fmtMoney(cur, total);
  };

  const wireRow = row => {
    row.querySelector('.rmItem').onclick = () => {
      if (rowsEl.children.length > 1) { row.remove(); renderTotal(); }
    };
    row.querySelectorAll('input, select').forEach(inp => inp.oninput = renderTotal);
  };
  [...rowsEl.children].forEach(wireRow);
  renderTotal();

  el.querySelector('#addItem').onclick = () => {
    rowsEl.insertAdjacentHTML('beforeend', itemRowHtml(s, {}, rowsEl.children.length));
    wireRow(rowsEl.lastElementChild);
  };

  form.onsubmit = async ev => {
    ev.preventDefault();
    const btn = ev.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Saving…';
    const fields = {};
    for (const [k, v] of new FormData(ev.target)) if (!k.startsWith('i_')) fields[k] = v;
    const items = collectItems(form);
    try {
      if (!items.length) throw new Error('Add at least one item with a description');
      if (editing) {
        await api('update', { id: p.id, updates: fields, items });
        toast('PR updated');
        location.hash = '#/pr/' + p.id;
      } else {
        const d = await api('create', { pr: fields, items });
        toast('Created ' + d.pr.id);
        location.hash = '#/pr/' + d.pr.id;
      }
      store.refresh();
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false; btn.textContent = editing ? 'Save changes' : 'Submit PR';
    }
  };
}
```

- [ ] **Step 2: Add item-row grid CSS**

Append to `frontend/src/styles.css`:

```css
.itemrow { display: grid; grid-template-columns: 2fr 1fr 1fr 70px 80px 1fr 1.2fr 1.2fr 34px; gap: 6px; margin-bottom: 6px; align-items: center; }
.itemrow input, .itemrow select { min-width: 0; }
@media (max-width: 900px) { .itemrow { grid-template-columns: 1fr 1fr; } }
```

- [ ] **Step 3: Check the old `COURIERS` export isn't imported elsewhere**

Run: `grep -rn "COURIERS" frontend/src/`
Expected: only `prForm.js` (the rewrite removed the export) — if another file imports it, move the constant there instead of breaking it.

- [ ] **Step 4: Run the suite + dev-server smoke check**

Run: `cd frontend && npx vitest run` → PASS.
Run: `cd frontend && npm run dev` → open http://localhost:5173, confirm the New PR form renders item rows, add/remove works, live total updates (no backend needed for render).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/prForm.js frontend/src/styles.css
git commit -m "feat: multi-item PR form with lists-driven dropdowns and live total"
```

---

### Task 10: PR detail with items + procurement (`prDetail.js`)

**Files:**
- Modify: `frontend/src/views/prDetail.js:26-52` (the `el.innerHTML` template)

**Interfaces:**
- Consumes: decorated `p.items` (Task 8); existing `row()`, `chip`, `fmtMoney`, `trackUrl` helpers in the file.
- Produces: no interface changes — same view signature.

- [ ] **Step 1: Replace the Item/Quantity/Amount rows and add items table + procurement section**

In the template (current lines 33–45), replace:

```js
        ${row('Item', esc(p.item))}${row('Department', esc(p.department))}${row('Quantity', esc(p.qty))}
        ${row('Vendor', esc(p.vendor))}
        ${row('Amount', p.amount ? esc(fmtMoney(p.currency || 'INR', Number(p.amount))) : '')}
```

with:

```js
        ${row('Department', esc(p.department))}
        ${row('Project', esc(p.project))}${row('Purpose', esc(p.purpose))}
        ${row('Vendor', esc(p.vendor))}
        ${row('Total', p.totalAmount ? esc(fmtMoney(p.currency || 'INR', Number(p.totalAmount))) : '')}
```

and change the "Requested by" row (current line 38) to include the name:

```js
        ${row('Requested by', esc([p.requestedByName, p.requesterEmail].filter(Boolean).join(' · ')) + ' on ' + fmtDate(p.createdAt))}
        ${row('Approved by', p.approverEmail ? esc([p.approvedByName, p.approverEmail].filter(Boolean).join(' · ')) + ' on ' + fmtDate(p.approvedAt) : '')}
```

Immediately after the closing `</table>` (current line 45), insert the items table and the role-gated procurement block:

```js
      <h3 style="margin:14px 0 6px">Items</h3>
      <table class="tbl"><thead><tr>
        <th>#</th><th>Description</th><th>Part no</th><th>Type</th><th>Qty</th><th>Unit price</th><th>Line total</th><th>Links</th>
      </tr></thead><tbody>
        ${(p.items || []).map(it => `<tr>
          <td>${esc(it.itemNo)}</td>
          <td>${esc(it.description)}</td><td>${esc(it.partNo)}</td><td>${esc(it.materialType)}</td>
          <td>${esc([it.qty, it.unit].filter(Boolean).join(' '))}</td>
          <td>${it.unitPrice ? esc(fmtMoney(p.currency || 'INR', Number(it.unitPrice))) : '—'}</td>
          <td>${it.lineTotal ? esc(fmtMoney(p.currency || 'INR', Number(it.lineTotal))) : '—'}</td>
          <td>${it.purchaseLink ? `<a href="${esc(it.purchaseLink)}" target="_blank" rel="noopener">buy ↗</a>` : ''}
              ${it.datasheetDoc ? ` <a href="${esc(it.datasheetDoc)}" target="_blank" rel="noopener">doc ↗</a>` : ''}</td>
        </tr>`).join('') || '<tr><td colspan="8" style="color:var(--mut)">No items.</td></tr>'}
      </tbody></table>
      ${['approver', 'admin', 'developer'].includes(me.role) ? `
      <h3 style="margin:14px 0 6px">Procurement</h3>
      <table class="tbl">
        ${row('PO', [p.poNo, fmtDate(p.poDate)].filter(Boolean).join(' · '))}
        ${row('Invoice / order', [p.invoiceNo, fmtDate(p.invoiceDate)].filter(Boolean).join(' · '))}
        ${row('Payment term', esc(p.paymentTerm))}
        ${row('Quotation / PI', p.quotationDoc ? `<a href="${esc(p.quotationDoc)}" target="_blank" rel="noopener">open ↗</a>` : '')}
      </table>` : ''}
```

Also update the Tracking row (current line 41–43): prefer the explicit `trackingLink` when present:

```js
        ${row('Tracking', p.trackingNo
          ? `${esc(p.courier || '')} <a href="${p.trackingLink ? esc(p.trackingLink) : trackUrl(p.courier, p.trackingNo)}" target="_blank" rel="noopener">${esc(p.trackingNo)} ↗</a>`
          : '')}
```

- [ ] **Step 2: Run suite + dev-server smoke check**

Run: `cd frontend && npx vitest run` → PASS. Dev server: PR detail renders (with mock/empty state it should not throw on `p.items` undefined — the `|| []` guards cover it).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/prDetail.js
git commit -m "feat: PR detail shows items table and role-gated procurement section"
```

---

### Task 11: Reports — project + material type spend

**Files:**
- Modify: `frontend/src/lib/reports.js` (append function)
- Modify: `frontend/src/views/reports.js:40-42` (spend sections), `:55-58` (CSV columns)
- Test: `frontend/tests/reports.test.js` (append)

**Interfaces:**
- Consumes: decorated PRs with `items` (Task 8).
- Produces: `spendByMaterialType(prs) -> { [type]: { [cur]: total } }` — same shape as `spendBy`, feeds the existing `spendTable`.

- [ ] **Step 1: Write the failing test (append to `frontend/tests/reports.test.js`)**

```js
import { spendByMaterialType } from '../src/lib/reports.js';

describe('spendByMaterialType', () => {
  it('sums item lineTotals by materialType in PR currency', () => {
    const prs = [
      { currency: 'INR', items: [
        { materialType: 'Asset', lineTotal: '100' },
        { materialType: 'Inventory', lineTotal: '50' }
      ]},
      { currency: 'USD', items: [{ materialType: 'Asset', lineTotal: '10' }] },
      { currency: 'INR', items: [{ materialType: '', lineTotal: '' }] }
    ];
    expect(spendByMaterialType(prs)).toEqual({
      Asset: { INR: 100, USD: 10 },
      Inventory: { INR: 50 }
    });
  });
});
```

(Match the existing import style at the top of the file — merge into the existing import from `../src/lib/reports.js` if one exists.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run tests/reports.test.js`
Expected: FAIL — `spendByMaterialType` not exported.

- [ ] **Step 3: Implement in `frontend/src/lib/reports.js` (append)**

```js
export function spendByMaterialType(prs) {
  const out = {};
  for (const p of prs) {
    const cur = p.currency || 'Unknown';
    for (const it of p.items || []) {
      const n = Number(it.lineTotal);
      if (it.lineTotal === '' || it.lineTotal == null || !isFinite(n)) continue;
      const k = it.materialType || '—';
      (out[k] = out[k] || {})[cur] = (out[k][cur] || 0) + n;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run tests/reports.test.js` → PASS.

- [ ] **Step 5: Wire into `frontend/src/views/reports.js`**

Import (line 3): add `spendByMaterialType` to the existing import from `../lib/reports.js`.

After the "Spend by month" line (current line 42), add:

```js
    ${spendTable('Spend by project', spendBy(s.prs.filter(p => p.project), p => p.project))}
    ${spendTable('Spend by material type', spendByMaterialType(s.prs))}
```

Update the CSV column list (current lines 56–57) to the v3 fields:

```js
    ['id', 'createdAt', 'department', 'project', 'requesterEmail', 'requestedByName', 'item', 'qty',
     'vendor', 'totalAmount', 'currency', 'priority', 'status', 'paymentStatus', 'paymentTerm',
     'poNo', 'invoiceNo', 'courier', 'trackingNo', 'expectedDate', 'receivedAt', 'notes']
```

- [ ] **Step 6: Full suite**

Run: `cd frontend && npx vitest run` → all PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/reports.js frontend/src/views/reports.js frontend/tests/reports.test.js
git commit -m "feat: spend-by-project and spend-by-material-type reports, v3 CSV columns"
```

---

### Task 12: Docs — setup runbook, README, E2E checklist

**Files:**
- Modify: `SETUP.md` (append v3 section)
- Modify: `README.md` (data model paragraph + E2E checklist)

**Interfaces:** none (documentation).

- [ ] **Step 1: Append a "v3 migration runbook" section to `SETUP.md`**

Content must cover, in order (write as numbered user-interactive steps, same voice as the existing file):
1. Create the new (blank) spreadsheet; note its file id.
2. Create/bind the Apps Script project on it; paste all `apps-script/*.gs` files; set `OAUTH_CLIENT_ID` in `auth.gs` as before.
3. Run `setupV3()` from the editor → verify 6 tabs + seeded Lists + dropdown validation.
4. Paste the OLD spreadsheet's file id into `LEGACY_FILE_ID` in `migrate.gs`; run `dumpLegacyHeaders()`, eyeball output, extend `HEADER_MAP` if a header is unmapped; run `migrateLegacyV3()`; verify Logger counts vs old-file row counts.
5. Review the `Vendors` tab once — merge duplicate names by editing PR rows' `vendor` and deleting dupes.
6. In the Google Form: Responses → link to the NEW spreadsheet. Recreate the installable "On form submit" trigger on the new project pointing at `onFormSubmit`.
7. Deploy web app; update `frontend/src/config.js` `APP_URL`.
8. Old file: File → Make read-only for editors (archive).

- [ ] **Step 2: Update `README.md`**

- Data model table: add `Items`, `Lists`, `Vendors` rows; update the `PRs` column list to the 29 v3 columns.
- E2E checklist: add
  - `[ ] Create multi-item PR → PRs row + N Items rows; totalAmount = Σ lineTotal`
  - `[ ] Edit PR items (add/remove) → Items rows rewritten, totalAmount updated, Log row`
  - `[ ] Form submission → PR + 1 Items row, status Submitted`
  - `[ ] Migration dry-run counts match legacy tab row counts`
  - `[ ] Developer delete removes PR row AND its Items rows`
  - `[ ] New vendor name on create → auto-added to Vendors + Log`
  - `[ ] Sheet dropdowns (department, status, materialType, unit) reject free text with warning`

- [ ] **Step 3: Commit**

```bash
git add SETUP.md README.md
git commit -m "docs: v3 setup runbook, data model, and E2E checklist"
```

---

## Self-Review Notes (already applied)

- Spec coverage: tabs (T5), 29-col PRs + Items (T2/T4), Lists/Vendors (T3), form intake (T7), migration (T6), backend routes + cascade (T4), frontend form/detail/reports (T9/T10/T11), integrity rules (T2/T4), testing (T1/T11 + E2E in T12), setup docs (T12). Vendor "add new" is satisfied by server-side auto-registration (`ensureVendor_`) rather than a dedicated UI — simpler, still logged.
- Type consistency: `decoratePrs` output (`items`, `amount`, `item`, `qty`) matches consumers in dashboard.js (untouched), prDetail.js, reports.js. `normalizeItems_` ↔ `computeLineTotal`/`computeTotalAmount` parity is an explicit check step (T2 S2).
- `HEADER_MAP` key rename (`requesterEmail` no longer claims `requestedby`) is deliberate: legacy "Requested By" columns hold person names → `requestedByName`; emails come from "Email Address".
