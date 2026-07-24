# Oizom Purchase Tool v2

A dashboard for creating and tracking purchase requests across Oizom departments, with role-based permissions and an audit trail. PRs live in a Google Sheet; the dashboard provides live tracking, reports (spend, status, vendor performance), and single-approver workflow. All mutations are server-side enforced via Apps Script and logged to an audit trail. The sheet remains the source of truth; the dashboard is a stateless, offline-safe view.

## Architecture

```
┌────────────────────┐  Google ID token   ┌──────────────────────┐
│ Static SPA          │ ──── fetch ─────▶ │ Apps Script Web App  │
│ (Vite, vanilla JS,  │ ◀─── JSON ─────── │ bound to the Sheet   │
│  GitHub Pages)      │                    │ verifies token+role  │
└────────────────────┘                    └──────────┬───────────┘
                                                      ▼
                                              Google Sheet (DB)
```

**Frontend:** Vite project, vanilla JS modules. Reuses the prototype's CSS design language (fonts, color variables, chip styles). Deployed as static files (GitHub Pages/Netlify).

**Backend:** one Google Apps Script project bound to the sheet, deployed as a web app ("execute as me"). All reads, writes, role checks, and audit logging go through it. The sheet never needs to be public.

**Auth:** an external static origin cannot use Apps Script's session identity (cookies don't cross origins). Instead: frontend signs in with Google Identity Services (GIS) → obtains an ID token → sends it with every request → Apps Script verifies the token against `https://oauth2.googleapis.com/tokeninfo` via UrlFetchApp, restricts to `@oizom.com`, and maps email → role from the `Users` tab. Verified tokens are cached (CacheService) until expiry.

## Data model

A PR is one `PRs` row plus one or more `Items` rows (`prId` foreign key). `totalAmount` is
always server-computed as Σ `lineTotal` and is never hand-entered. `Lists` holds the
dropdown values shown in the form and backed by sheet data validation (invalid values are flagged with a warning, not blocked; the dashboard's dropdowns are the strict path); `Vendors` is
a searchable registry that auto-grows (new vendor names on a PR create/update are
auto-registered and logged, no separate UI).

| Tab | Purpose | Columns |
|---|---|---|
| `PRs` | one row per purchase request (header fields) | `id`, `createdAt`, `department`, `project`, `purpose`, `requesterEmail`, `requestedByName`, `vendor`, `totalAmount`, `currency`, `status`, `priority`, `approverEmail`, `approvedByName`, `approvedAt`, `paymentStatus`, `paymentTerm`, `poNo`, `poDate`, `invoiceNo`, `invoiceDate`, `quotationDoc`, `courier`, `trackingNo`, `trackingLink`, `expectedDate`, `receivedAt`, `notes`, `updatedAt` |
| `Items` | one or more line items per PR | `prId`, `itemNo`, `description`, `partNo`, `materialType`, `qty`, `unit`, `unitPrice`, `lineTotal`, `purchaseLink`, `datasheetDoc` |
| `Lists` | one column per dropdown (values in rows below the header) | `departments`, `materialTypes`, `priorities`, `couriers`, `paymentTerms`, `units`, `currencies` |
| `Vendors` | canonical vendor registry | `name`, `website`, `contactEmail`, `phone`, `notes`, `addedBy`, `addedAt` |

## Setup

See [SETUP.md](./SETUP.md) for step-by-step deployment instructions (user-interactive).

## Local Development

```bash
cd frontend && npm install && npm run dev
```

Runs the Vite dev server at http://localhost:5173. Configure `frontend/src/config.js` with a local Apps Script URL and OAuth client ID to test end-to-end.

## Testing

```bash
cd frontend && npm test
```

Runs Vitest unit tests for pure logic (currency parsing, report aggregation, status transitions).

## E2E Verification Checklist

- [ ] Sign in with @oizom.com account → dashboard loads with migrated PRs
- [ ] Migration dry-run counts match legacy tab row counts
- [ ] Non-oizom Google account → rejected with clear error
- [ ] Create PR as requester → appears in sheet PRs tab + Log row written
- [ ] Create multi-item PR → PRs row + N Items rows; totalAmount = Σ lineTotal
- [ ] Edit PR items (add/remove) → Items rows rewritten, totalAmount updated, Log row
- [ ] Form submission → PR + 1 Items row, status Submitted
- [ ] New vendor name on create → auto-added to Vendors + Log
- [ ] Approve as approver → status chip updates, approverEmail/approvedAt set
- [ ] Requester cannot see Approve button on others' PRs (and API rejects if forced)
- [ ] Ordered → In Transit → Received flow works; receivedAt set
- [ ] Tracking number renders courier link that opens correct tracking page
- [ ] Sheet dropdowns (department, status, materialType, unit) flag free text with a validation warning (values are still saved — warn-only by design)
- [ ] Reports: spend totals match sheet sums; CSV downloads open in Sheets
- [ ] Admin tab: user not in Users tab → sign-in works but API returns "No access" until an admin adds them
- [ ] OAUTH_CLIENT_ID set in auth.gs and new deployment version created (audience check active)
- [ ] Repeat sign-in + one write from the DEPLOYED GitHub Pages URL (catches CORS)
- [ ] Poll: edit a cell directly in the sheet → dashboard reflects it within 60s
- [ ] Admin sees Dev tab; approver/requester do not
- [ ] Admin can delete a PR (row removed + Log entry); approver cannot see a Delete button
- [ ] Admin delete removes PR row AND its Items rows
- [ ] Refresh button (↻) updates the sync chip without a page reload
- [ ] Dashboard: KPI tile click filters the Table tab; metric switcher + currency selector work; Pipeline shows stage columns

## Spec

See [Design Spec](./docs/superpowers/specs/2026-07-07-purchase-tool-design.md) for architecture, data model, roles, and non-goals (phase 2+).
