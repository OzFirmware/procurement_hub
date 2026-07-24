# Oizom Purchase Tool — Sheet Structure v3 Design Spec

**Date:** 2026-07-14
**Status:** Approved by user

## Problem

The v2 `PRs` tab (20 columns) was reverse-engineered from the legacy form sheet and
dropped fields the purchase team actually uses: requester/approver names (emails are
shared department accounts), PO/invoice numbers and dates, payment terms, project,
material type, purchase/document links, and Zoho part numbers. The v1 sheet rotted
precisely because missing fields were hand-added per department tab, causing schema
drift. The current schema also forces one item per PR, while real purchases (Amazon
carts, component orders) contain multiple line items.

This spec defines a new spreadsheet structure that covers the actual workflow,
supports multi-item PRs, and keeps the Google Form as a parallel intake channel.

## Decisions (from brainstorming)

1. **Intake:** Google Form stays alongside the dashboard. Schema stays flat-row
   compatible; form submissions create single-item PRs.
2. **Line items:** one PR = one vendor = one currency; items live in a separate
   `Items` tab linked by `prId`.
3. **Fields:** all four legacy groups return — people names, procurement lifecycle,
   project + material taxonomy, docs + links.
4. **Master data:** `Lists` tab (dropdown sources) + `Vendors` tab.
5. **Location:** new spreadsheet file. One-time migration reads the OLD file's 10
   department tabs (richest source). Old file becomes a read-only archive.
6. **Amounts:** pragmatic denormalization — `Items` carry `qty/unitPrice/lineTotal`;
   `PRs` carry `totalAmount + currency`, recomputed server-side on every item write.

## Tabs

| Tab | Purpose | Managed by |
|-----|---------|------------|
| `PRs` | One row per PR (header record) | Backend |
| `Items` | One row per line item, keyed `prId + itemNo` | Backend |
| `Users` | email → role (unchanged from v2) | Backend |
| `Log` | Audit trail (unchanged from v2) | Backend |
| `Lists` | One column per dropdown list | Admin edits sheet directly |
| `Vendors` | Canonical vendor registry | Backend (+ admin) |
| `Form Responses 1` | Raw form intake | Google Forms |

## `PRs` columns (29)

| Group | Columns |
|-------|---------|
| Identity | `id` (PR-YYYY-NNNN), `createdAt`, `updatedAt` |
| Who | `department`▾, `requesterEmail`, `requestedByName`, `approverEmail`, `approvedByName`, `approvedAt` |
| What for | `project`, `purpose` |
| Vendor/money | `vendor`▾, `totalAmount` (computed), `currency`▾ |
| Workflow | `status`▾, `priority`▾ |
| Payment | `paymentStatus`▾, `paymentTerm`▾, `poNo`, `poDate`, `invoiceNo`, `invoiceDate`, `quotationDoc` |
| Shipping | `courier`▾, `trackingNo`, `trackingLink`, `expectedDate`, `receivedAt` |
| Free text | `notes` |

▾ = dropdown, data-validated against `Lists` / `Vendors`.

## `Items` columns (11)

`prId, itemNo, description, partNo, materialType`▾`, qty, unit`▾`, unitPrice,
lineTotal, purchaseLink, datasheetDoc`

- `itemNo` is 1-based within a PR; composite key `prId + itemNo`.
- `partNo` holds the Zoho part number.
- `lineTotal = qty × unitPrice`, written by the backend.
- `PRs.totalAmount = Σ lineTotals`, recomputed on every item mutation.
- One currency per PR (on the header). Mixed-currency purchases = separate PRs.

## `Lists` columns (seed values)

| Column | Seed |
|--------|------|
| `departments` | Admin, Device Management, Environment, Marketing, Production, Projects, QC, R&D, Sales, Support |
| `materialTypes` | Asset, Inventory, Local Purchase, Subscription, Certification |
| `priorities` | High, Medium, Low |
| `couriers` | BlueDart, DHL, FedEx, DTDC, India Post, Amazon, Porter, Other |
| `paymentTerms` | Advance 100%, Advance 50%, Net 15, Net 30, On Delivery, Milestone |
| `units` | pcs, L, kg, m, set, box, license |
| `currencies` | INR, USD, EUR |

Backend serves lists to the dashboard (cached). Sheet data-validation ranges point
at these columns. Adding a value = editing the sheet; no deploy.

## `Vendors` columns

`name, website, contactEmail, phone, notes, addedBy, addedAt`

Dashboard vendor field is a searchable dropdown with "add new" (writes a row,
logged). Migration seeds the tab from legacy vendor names, normalized (trim,
case-fold); the merge list is reviewed by the user once during migration.

## Form intake

- The form's response destination is re-linked to the new spreadsheet;
  `Form Responses 1` appears there (Google manages it). Old responses stay in the
  old file.
- `formSubmit.gs` v2 maps a flat form row → 1 `PRs` row + 1 `Items` row (form PRs
  are always single-item), status `Submitted`. Unmapped columns are appended to
  `notes`, as in v2.

## Migration v2 (one-time)

- Reads the OLD file's 10 department tabs directly — richer than the current `PRs`
  tab (recovers `poNo`, `project`, doc links from original columns).
- Extended `HEADER_MAP` covers per-department header variants
  ("Mat Rcv Date" / "Mat. Rcv. Date", etc.).
- Each legacy row → 1 PR + 1 Item.
- Unparseable amounts ("Rs. 1080 per month …") go to `notes` verbatim with
  `totalAmount` left blank — never guess numbers.
- Idempotent: deterministic `PR-MIG-NNNNN` ids keyed on (tab, row).
- Old file is never written to.

## Backend changes (Apps Script)

- `prs.gs` — `PR_HEADERS` extended to the 29 columns above; `create`/`update`
  accept `{pr, items[]}`; item writes + `totalAmount` recompute + PR write happen
  inside one `withLock_` call (atomic). Status matrix unchanged from v2.
- New `items.gs` — items sheet helpers, recompute logic, item diffing on update.
- New `vendors.gs` — list/add routes (add = requester+, logged).
- New `lists.gs` — serves `Lists` tab, cached via CacheService.
- `formSubmit.gs` v2 and `migrate.gs` v2 as described above.
- Developer `delete` cascades: removes the PR row and its `Items` rows, both logged.

## Frontend changes

- PR form: line-item rows (add/remove), `unit` + `materialType` dropdowns per row,
  live total.
- Detail view: items table; procurement section (PO/invoice/payment term) visible
  to approver/admin roles.
- `list` route returns both tabs; the client joins on `prId` (≈700 PRs + ≈800
  items — trivial in memory).
- Reports gain: spend by project, spend by material type; vendor report groups on
  canonical vendor names.

## Integrity rules (backend-enforced)

1. No orphan items — item rows are written only through PR routes.
2. `totalAmount` is never trusted from input — recomputed server-side on every
   mutation.
3. One currency and one vendor per PR.

## Error handling

Same as v2: writes show a spinner, wait for backend confirmation, then refetch;
failures show a toast with retry. No optimistic writes. Two-tab writes are atomic
under `withLock_` with `SpreadsheetApp.flush()` before lock release.

## Testing

- Vitest: `totalAmount`/`lineTotal` recompute, legacy amount parser (real strings
  from the old sheet), `HEADER_MAP` resolution, existing status-matrix tests
  unchanged.
- E2E checklist additions: multi-item create/edit; form submission → PR + item row;
  migration dry-run row counts (old tabs vs new PRs/Items); developer cascade
  delete removes items.

## Non-goals (unchanged from v2 spec)

Vendor API polling, notifications, multi-level approval, mobile app. Additionally
out of scope for v3: Lists management UI (admin edits the sheet directly),
per-item currency, file uploads (doc fields are pasted URLs).
