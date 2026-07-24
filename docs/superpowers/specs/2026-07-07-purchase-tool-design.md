# Oizom Purchase Tool v2 — Design Spec

**Date:** 2026-07-07
**Status:** Approved by user

## Problem

Oizom's purchase requests live in one Google Sheet (10 department tabs). The existing
single-file prototype (`index.html.bak`) reads it via gviz CSV / Apps Script and has
client-side-only auth — no real permissions, no audit trail, hard to maintain at
1,500+ lines. The team needs an organizational purchasing tool: live PR tracking,
PR creation from a dashboard, role-based permissions, reports, and order tracking —
with the Google Sheet remaining the database.

## Goals

1. Dashboard with live view of every purchase request (PR) from the sheet.
2. Create and edit PRs from the dashboard (write back to the sheet).
3. Role-based access: Admin, Approver, Requester, Viewer — enforced server-side.
4. Single-approver workflow with full audit log.
5. Reports: spend summary, PR status/aging, vendor performance, CSV/PDF export.
6. Courier-level order tracking (tracking number + link-out). Vendor APIs are phase 2.

## Non-Goals (Phase 2+)

- Mouser/DigiKey API polling; Amazon/robu.in scraping
- Email/Slack notifications
- Amount-based multi-level approval
- Mobile app

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

- **Frontend:** Vite project, vanilla JS modules. Reuses the prototype's CSS design
  language (fonts, color variables, chip styles). Deployed as static files
  (GitHub Pages/Netlify).
- **Backend:** one Google Apps Script project bound to the sheet, deployed as a web
  app ("execute as me"). All reads, writes, role checks, and audit logging go
  through it. The sheet never needs to be public.
- **Auth:** an external static origin cannot use Apps Script's session identity
  (cookies don't cross origins). Instead: frontend signs in with Google Identity
  Services (GIS) → obtains an ID token → sends it with every request → Apps Script
  verifies the token against `https://oauth2.googleapis.com/tokeninfo` via
  UrlFetchApp, restricts to `@oizom.com`, and maps email → role from the `Users`
  tab. Verified tokens are cached (CacheService) until expiry.

## Data Model (sheet tabs)

| Tab | Purpose |
|-----|---------|
| `PRs` | Master table, one row per PR |
| `Users` | email → role mapping |
| `Log` | Audit trail: timestamp, user, PR id, action, old → new |

`PRs` columns: `id, createdAt, department, requesterEmail, item, qty, vendor,
amount, currency, priority, status, approverEmail, approvedAt, paymentStatus,
courier, trackingNo, expectedDate, receivedAt, notes, updatedAt`.

PR ids: `PR-YYYY-NNNN`.

**Migration:** a one-time Apps Script function merges the existing 10 department
tabs into `PRs` (department = tab name). Old tabs stay untouched as archive.
Because current column headers are unknown, `dumpHeaders()` runs first and its
output drives the column mapping. Migration is idempotent.

## Roles & Workflow

| Role | Can do |
|------|--------|
| Requester | Create PR, edit own PRs while `Submitted`, view all |
| Approver | Approve/reject, edit any PR, everything Requester can |
| Admin | Everything + manage users + run migration |
| Viewer | Read only |

Status flow: `Submitted → Approved | Rejected → Ordered → In Transit → Received`,
plus `Cancelled` and `On Hold` side states. Transitions are role-gated in the
backend; every mutation appends a `Log` row. Bootstrap rule: if `Users` tab is
empty, the first authenticated caller becomes Admin.

## Live Tracking

- Frontend polls the backend every 60 s and after every write; "● Live · HH:MM ·
  N PRs" chip (same UX as prototype).
- Each PR stores courier + tracking number; UI renders one-click deep links
  (BlueDart, DHL, FedEx, DTDC, India Post templates + generic 17track.net).

## Reports

Computed client-side from the full PR list (dataset is small):

1. Spend by department / vendor / month — currency-aware, reusing the prototype's
   currency detection and formatting logic.
2. PR status + aging (PRs stuck in a state too long, pending approvals).
3. Vendor performance (delivery time, delayed orders).
4. Export: CSV via Blob download; PDF via print stylesheet.

## Error Handling

Writes show a spinner, wait for backend confirmation, then refetch. Failures show
a toast with a retry button — no silent failures, no optimistic writes.

## Testing

- Vitest unit tests for pure logic: currency parsing, report aggregation, status
  transition matrix.
- Manual E2E checklist for auth + sheet writes, run against both the dev server
  and the deployed static site (the latter catches CORS/token issues).

## Deployment / Setup (user-interactive steps)

1. User creates the Apps Script project bound to the sheet and authorizes it.
2. User creates a GIS OAuth client ID in Google Cloud console (free).
3. Apps Script deployed as web app; its URL + the OAuth client ID configured in
   the frontend.
