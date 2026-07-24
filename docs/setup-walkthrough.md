# Procurement Hub Setup Walkthrough (detailed, click-by-click)

A beginner-friendly companion to [SETUP.md](../SETUP.md). SETUP.md is the terse
runbook; this document explains every click and why.

**Recommended order for a first rollout:** set up a fresh, empty Procurement Hub system and
test it end to end (Phases 1–2 and 4–6). Migrate legacy data later, once you
trust the tool (Phase 3 is optional and can be run at any time before real
usage begins — see the note inside it).

---

## The big picture

Three pieces, connected like this:

```
Google Sheet (the database)
   ↑ read/write
Apps Script (the backend — code that lives INSIDE the sheet)
   ↑ HTTP requests
Frontend dashboard (the website your team uses)
```

You will: create a blank sheet → put the backend code inside it → run one
function that builds all the tabs automatically → connect the Google Form →
publish the backend → point the frontend at it. Legacy data migration is a
separate, optional step.

Total time: roughly 30–45 minutes (excluding migration).

---

## Phase 0 — Before you start

1. **Git branch.** The code lives on `main`. Make sure your working copy is
   on it and up to date before copying any files:

   ```bash
   git branch --show-current
   ```

2. **(Only if migrating later) old spreadsheet's file ID.** Open the legacy
   purchase spreadsheet in the browser and copy the long string from its URL:

   ```
   https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKl.../edit
                                          ^^^^^^^^^^^^^^^^
                                          this is the file ID
   ```

---

## Phase 1 — Create the new spreadsheet and paste the backend code

1. Go to [sheets.google.com](https://sheets.google.com) → **Blank
   spreadsheet**. Name it (e.g. "Oizom Procurement Hub"). Leave it completely
   empty — no tabs, no columns.

2. In the new spreadsheet: **Extensions → Apps Script**. A code editor opens
   in a new tab. This backend project is permanently bound to this
   spreadsheet.

3. Recreate the 11 files from the repo's `apps-script/` folder. For each one:

   - Left sidebar → **+** next to "Files" → **Script**.
   - Name it exactly as in the repo **without** the `.gs` extension (type
     `prs`, the editor shows `prs.gs`).
   - Copy the file's full contents from the repo and paste, replacing
     anything already there.

   The 12 files: `Code.gs` (paste into the default file), `auth.gs`,
   `prs.gs`, `items.gs`, `users.gs`, `lists.gs`, `vendors.gs`,
   `projects.gs`, `materialTypes.gs`, `migrate.gs`, `setup.gs`, `dev.gs`.

4. The 13th file, `appsscript.json` (project manifest), is hidden by default:

   - Gear icon (**Project Settings**) → check **"Show 'appsscript.json'
     manifest file in editor"**.
   - Back in the editor (< > icon), open `appsscript.json` and paste the
     contents of `apps-script/appsscript.json`.

5. In `auth.gs`, set `OAUTH_CLIENT_ID` near the top. Reuse the existing OAuth
   client ID from v2 — it is the `CLIENT_ID` value in
   `frontend/src/config.js` (ends in `.apps.googleusercontent.com`). No new
   OAuth client is needed. (Setting up a client from scratch: SETUP.md §2.)

6. **Ctrl+S** to save all files.

---

## Phase 2 — Let the code build the sheet structure

Never create tabs or columns by hand — `setup()` builds everything.

1. In the toolbar's function dropdown (next to **Run**), select **`setup`**
   → **Run**.
2. The first run asks for authorization: pick your Google account → if it
   says "Google hasn't verified this app", click **Advanced → Go to (project
   name)** → **Allow**. Normal for your own scripts.
3. Check the execution log (bottom panel, or **View → Logs**) — expect
   **"Procurement Hub tabs ready"**.
4. Switch to the spreadsheet: 6 tabs should exist — **PRs, Items, Users,
   Log, Lists, Vendors** — with headers, and `Lists` seeded with dropdown
   values (departments, materialTypes, priorities, couriers, paymentTerms,
   units, currencies).

The Procurement Hub structure now exists. For a fresh-start rollout, skip to Phase 4.

---

## Phase 3 — Migrate legacy data (OPTIONAL — run later if desired)

> **Timing note:** migration refuses to run if the `PRs` tab already has
> rows (that guard makes it safe against double-runs). So migrate **before**
> the team starts creating real PRs in the new system. Test PRs are fine —
> just delete their rows from `PRs` and `Items` before migrating. If you're
> in testing mode, skip this phase now and come back.

1. In `migrate.gs`, set the constant at the top:

   ```js
   var LEGACY_FILE_ID = '<old spreadsheet file ID>';
   ```

2. **Dry-run check first.** Run **`dumpLegacyHeaders`** and read the log:

   - Every legacy column header should be mapped. Unmapped headers must be
     added to `HEADER_MAP` as synonyms before migrating.
   - **Eyeball the legacy status values.** `OLD_STATUS_MAP` only understands
     "in process", "in transit", "received", "cancelled", "on hold"
     (case-insensitive). Any other status text silently becomes
     **"Received"**. Extend the map first if needed.

3. Run **`migrateLegacy`**. The log ends with "Migrated N PRs, M items,
   K vendors" — sanity-check the numbers against the legacy sheet's row
   counts. It never writes to the old file, and it skips entirely if `PRs`
   already has rows (delete test rows first; see timing note above).

4. Open the **Vendors** tab and review once for near-duplicates from legacy
   free text (e.g. "Amazon" vs "amazone"). To merge: edit the affected
   `PRs` rows' `vendor` value to the canonical name, then delete the
   duplicate `Vendors` row.

---

## Phase 4 — Retire the Google Form

The Google Form intake is retired — purchase requests are created in the
tool itself (New PR button on the dashboard).

1. Open the old Form in edit mode → **Responses** tab → toggle
   **Accepting responses** off.
2. If an `onFormSubmit` trigger exists in the Apps Script project (clock
   icon → **Triggers**), delete it.

---

## Phase 5 — Publish the backend (get the URL)

1. Apps Script editor: **Deploy → New deployment**.
2. Gear next to "Select type" → **Web app**.
3. Settings:

   - Execute as: **Me**
   - Who has access: **Anyone** — safe, because the code itself validates
     the caller's @oizom.com Google sign-in on every request; "Anyone" only
     means the URL is reachable.

4. **Deploy** → copy the URL ending in **`/exec`**.

> After any later code change in the Apps Script editor, use **Deploy →
> Manage deployments → edit (pencil) → Version: New version → Deploy** to
> update the same URL, instead of creating a new deployment each time.

---

## Phase 6 — Point the dashboard at the new backend

1. In `frontend/src/config.js`, replace `APP_URL` with the new `/exec` URL.
   Leave `CLIENT_ID` unchanged.
2. Test locally:

   ```bash
   cd frontend && npm install && npm run dev
   ```

   Open http://localhost:5173, sign in with an @oizom.com account. Expect:
   empty dashboard (fresh sheet), working "New PR" form with multi-item rows
   and live total, dropdowns coming from the `Lists` tab. Create a test PR
   and verify it appears in the `PRs` + `Items` tabs of the spreadsheet.
3. When happy, deploy the frontend to GitHub Pages as in SETUP.md §5.

---

## Phase 7 — Retire the old spreadsheet (after migration / cut-over)

Old spreadsheet → **Share** → change every "Editor" to **Viewer**. It stays
readable as an archive, and nobody keeps editing it out of habit.

---

## First sign-in and roles

The first sign-in against the new backend auto-registers that user in the
`Users` tab. To grant admin: open `Users` in the spreadsheet and set the
row's role to `admin` (roles: viewer / requester / approver / admin;
`developer` additionally shows the Dev tab in the dashboard).

## Where people get stuck

- **Authorization popups** (Phases 2 and 4): Advanced → Go to project →
  Allow. Expected for personal scripts.
- **"Form Responses 2" trap** (Phase 4): the intake trigger only reads a tab
  named exactly "Form Responses 1".
- **Sign-in button missing on localhost**: the OAuth client must list
  `http://localhost:5173` as an authorized JavaScript origin (Google Cloud
  console → Credentials → your OAuth client).
- **Statuses all showing "Received" after migration** (Phase 3): legacy
  status words weren't in `OLD_STATUS_MAP` — fix the map, clear `PRs` +
  `Items`, migrate again.
