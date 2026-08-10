# Vendors: admin-only access and semantic search

**Date:** 2026-08-10 · **Branch:** `feat/vendors-admin-search` · **Status:** approved

## Problem

Two requests, one area of the app.

1. The Vendors tab is visible to every role. It should be admin-only, and absent
   from the top nav for everyone else.
2. The public Vendors page has no search at all — just an alphabetically sorted
   card grid. It needs search that understands intent, not just substrings.

## 1. Access control

### What exists

`main.js` declares views in a `VIEWS` map. `minRole` is read in exactly one
place — building the nav list:

```js
.filter(([, v]) => v.nav && (!v.minRole || RANK[role] >= RANK[v.minRole]))
```

The view lookup itself ignores it:

```js
const view = VIEWS[name] || VIEWS[''];
```

So `minRole` hides a link but does not guard a route. A requester typing
`#/vendors` renders the full vendors page today. The same hole exists on
`#/admin` (declared `minRole: 'admin'`) and `#/new`.

### Change

- `VIEWS.vendors` gains `minRole: 'admin'`, removing the nav link for
  non-admins.
- `render()` gains a generic route guard: if the resolved view declares a
  `minRole` the current user does not meet, redirect to the dashboard instead of
  rendering. Being generic, it closes the same hole on `#/admin` and `#/new`
  rather than patching only the vendors case.

The guard runs on the role in `store` state. Before the first sync the role is
unknown; the guard must not bounce an admin off a deep link merely because the
session has not loaded yet. It therefore only redirects once `me` is known.

### Scope boundary — this is a UI boundary, not a security one

The `list` route returns `vendors` to every caller and must continue to: the PR
form's vendor picker reads `s.vendors`, and vendor validation on create depends
on the same registry. A non-admin can still read vendor records from the network
response. Real enforcement would require splitting the payload server-side and
is explicitly out of scope here.

Sensitive columns are already withheld from the non-admin surface —
`accountNumber`, `ifsc`, `swift` and `gstTaxId` are never rendered by
`vendors.js` (see the comment above `detailView`). Hiding the tab does not
change that either way.

## 2. Semantic search

### Approach

Smart multi-field matching with synonym expansion and typo tolerance. Not
embeddings: with a registry of this size, an embedding pipeline would add an API
key in Script Properties, per-vendor cost, and vectors that go stale on every
edit — for worse results than a well-tuned lexical matcher on short, structured
records.

### New module — `frontend/src/lib/vendorSearch.js`

Pure functions, no DOM, no store access, unit-testable in isolation.

```js
export function searchVendors(vendors, query)  // → filtered, ranked array
export function scoreVendor(vendor, terms)     // → number, 0 = no match
```

**Fields searched, by weight:**

| Weight | Fields |
|---|---|
| 3 | `name`, `displayName` |
| 2 | `category`, `type`, `departments` |
| 1 | `contactPerson`, `address`, `paymentTerms`, `notes` |

Banking columns are never indexed, regardless of role.

**Term matching**, best match per term wins, scored in this order:

| Quality | Rule | Multiplier |
|---|---|---|
| Exact | term equals a whole word in the field | 1.0 |
| Prefix | a field word starts with the term | 0.7 |
| Substring | term appears anywhere in the field | 0.5 |
| Synonym | term expands to a concept word that then matches | 0.4 |
| Fuzzy | Levenshtein within threshold of a field word | 0.3 |

Fuzzy thresholds: distance ≤1 for terms of 4–6 characters, ≤2 for 7 or more.
Terms shorter than 4 characters are never fuzzy-matched — at that length edit
distance produces noise rather than tolerance.

**Multi-term semantics:** every term must match something (AND). A vendor
scoring zero on any term is excluded. Total score is the sum of per-term scores,
and results sort by score descending, then by name for stability.

**Synonyms** map a query concept to words that plausibly appear *in the data*,
never to specific vendor names — mapping `sensor` → `Sensirion` would silently
break when a second sensor supplier is added.

```
sensor      → pm, gas, module, electrochemical, particulate
fab         → fabrication, enclosure, sheet metal, machining
calibration → nabl, certification, testing
electronics → components, distributor, semiconductor
local       → india, domestic
```

**Empty query** returns all vendors in their existing alphabetical order, so the
default page is unchanged.

### UI

A search box at the top of the Vendors page, built from the existing
`searchBar()` in `views/adminSearch.js` so it looks and behaves like the Admin
tabs.

`wireSearch()` itself is **not** reused. It filters by toggling `tr.hidden` on
rows carrying a `data-search` haystack, which suits a table whose parent
re-renders on save. The vendors page renders a card grid and needs ranked
*reordering*, not just hiding — a scored result set changes the order of the
grid, which DOM-toggling cannot express. Vendors gets its own small wiring that
re-renders the grid from `searchVendors()` output, keeping the query in a
module-level variable so it survives the store's re-render, mirroring how
`VENDOR_Q` works in `adminVendors.js`.

Empty results render a "no vendors match" card rather than a blank grid.

### Admin → Vendors list

The same `searchVendors()` powers the vendor list inside the Admin tab, so one
entity does not have two different search behaviours. The admin list keeps its
existing table + `wireSearch` DOM-filtering mechanics; only the *matching
function* is shared.

## Testing

`frontend/tests/vendorSearch.test.js`, vitest, against realistic vendor records:

- exact name match ranks above a notes-only match
- `sensiron` finds `Sensirion AG` (fuzzy, distance 1)
- `snsr` finds nothing (below the 4-character fuzzy floor)
- `sensor` finds vendors whose category says `PM modules` (synonym)
- `ahmedabad fab` requires both terms (AND semantics)
- empty query returns every vendor, order unchanged
- banking fields never match, even on an exact account number

## Out of scope

- Backend changes of any kind
- Splitting the `list` payload by role
- Embeddings or any external API
- Redesign of the vendor card or detail layout
