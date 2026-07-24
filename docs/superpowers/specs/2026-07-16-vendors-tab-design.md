# Vendors Tab — Design

Date: 2026-07-16
Status: Approved

## Goal

Add a Vendors tab after Dashboard, visible to every signed-in user (requester, approver, admin). It shows vendor cards with sheet-derived activity stats. Admin curates a proper display name and logo per vendor; everything else comes from existing data.

## Non-goals

- No change to how PRs reference vendors (join stays on the raw `name` string).
- No new tagline/label field — card subtitle reuses the existing `category` field.
- No API-level filtering of sensitive fields (deferred; see Security note).
- No vendor search/sort/filter controls in v1.

## Routing

- `main.js` `VIEWS` gains `'vendors': { fn: vendorsView, nav: 'Vendors' }`, inserted directly after `''` so the nav order is Dashboard · Vendors · Admin.
- No `minRole` — visible to all roles.
- Detail view routes as `#/vendors/<name>` using the existing `param` mechanism (same pattern as `#/pr/<id>`). `<name>` is the URI-encoded raw vendor name.

## Backend (apps-script)

- `VENDOR_HEADERS` in `vendors.gs` gains `displayName` and `logoUrl`.
- `vendorSheet_()` already auto-appends missing headers, so existing sheets migrate on first touch with no script run.
- `VENDOR_EDITABLE` is derived from `VENDOR_HEADERS`, so `vendorSet` accepts the new fields with no route change.
- No other backend changes. The `list` route already returns all PRs and all vendors to every role, so card stats are computed client-side.

## New view: `frontend/src/views/vendors.js`

### Card grid

One card per registry vendor (vendors that appear only in PRs but not the registry are not shown). Card contents:

- **Logo**: `logoUrl` if set; else favicon via `https://www.google.com/s2/favicons?domain=<website>&sz=64` when `website` is set; else an initials circle. An `onerror` handler on the `<img>` swaps to the initials fallback.
- **Name**: `displayName || name`. **Subtitle**: `category` (if set).
- **Badge**: from the `type` field when set — `Domestic` → DOMESTIC, `International` → FOREIGN. When `type` is empty, derived from that vendor's PR currencies: all INR → DOMESTIC, none INR → FOREIGN, both → MIXED, no PRs → no badge.
- **Stats**: purchase-request count; total spend per currency (top currency via `fmtCompact`, additional currencies as "+ …"); unpaid count (highlighted red when > 0); last order = max `createdAt` across that vendor's PRs.
- **Chips**: bank name (if set) plus departments, capped at 3 with a "+n more" overflow chip.

Clicking a card navigates to `#/vendors/<name>`.

### Detail view (read-only, all roles)

- Header: logo, display name, badge, category.
- Contact: contact person, phone, email, website, address.
- Payment terms and bank **name only**.
- Department chips.
- Stat row (same numbers as the card).
- Recent-PRs table for this vendor; rows link to `#/pr/<id>`.
- Admin additionally sees an "Edit in Admin" button linking to `#/admin`.
- Never rendered here (any role): account number, IFSC, SWIFT, GST — those remain visible only inside the Admin → Vendors editor.

## Shared stats: `frontend/src/lib/vendorStats.js`

Extract vendor aggregation out of `adminVendors.js` into a pure module:

- `vendorStats(prs, name)` → `{ count, spendTotals, unpaid, lastOrder }` (case-insensitive name match; spend uses the same `KPI_FILTERS.spend` / `KPI_FILTERS.unpaid` semantics as today).
- `vendorBadge(vendor, prs)` → `'Domestic' | 'Foreign' | 'Mixed' | ''` per the badge rules above.
- `adminVendors.js` `stats()` is replaced by calls into this module.

## Admin editor changes (`adminVendors.js`)

Two new inputs in the detail form: **Display name** and **Logo URL**. No other admin flow changes.

## Errors & empty states

- No registry vendors → single empty-state card ("No vendors yet…").
- Broken/blocked logo URL → initials fallback via `onerror`.
- Detail route with unknown vendor name → "Vendor not found" message with a back link.

## Security note

Bank account number, IFSC, SWIFT, and GST are hidden in the new UI but the `list` API still sends full vendor objects to every client. True protection requires role-based filtering in `listVendors_()`; explicitly deferred by decision during design.

## Testing

- Vitest unit tests for `lib/vendorStats.js`: multi-currency spend totals, case-insensitive matching, unpaid counting, last-order date, badge derivation (type set, derived, no PRs).
- View wiring verified manually (project has no view-level test harness).
