# Setup Guide — production sheet + GitHub Pages (public repo)

Target layout: **public repo** (`OzFirmware/procurement_hub`) hosting the
frontend on GitHub Pages, backend on a Google Apps Script web app bound to
the production spreadsheet. No credentials live in the repo — build values
come from GitHub Actions secrets; local dev reads `frontend/.env.local`
(gitignored).

> Click-by-click details for the spreadsheet/Apps Script parts:
> [docs/setup-v3-walkthrough.md](docs/setup-v3-walkthrough.md)

## 0. What is public vs secret (read once)

- The **built site** always contains the Apps Script `/exec` URL and the
  OAuth client ID — the browser needs both. They are *identifiers*, not
  secrets: data access is protected server-side (Google ID token signature,
  `@oizom.com` domain, Users-tab membership check on every call).
- Keeping them out of the **source repo** still matters: it lets you rotate
  URLs without commits, keeps demo/prod configs separate, and avoids
  copy-paste reuse of stale URLs.
- The only *hard* secret in the system is Google's signing of ID tokens —
  never disable the `OAUTH_CLIENT_ID` audience check (§2.4).

## 1. Backend — production spreadsheet

You've already pasted all `apps-script/` files into the new sheet's bound
project. Remaining steps, in order:

1. Project Settings → check "Show appsscript.json" → paste
   `apps-script/appsscript.json` if not done.
2. Run `setupV3()` (select function → Run → authorize). Logs must say
   "v3 tabs ready". Verify tabs: PRs, Items, Users, Log, Lists, Vendors;
   `Lists` seeded; dropdown validation on PRs + Items.
3. **Migration (optional).** Bringing legacy data from the v1 sheet:
   set `LEGACY_FILE_ID` in `migrate.gs` to the OLD sheet's file id, run
   `dumpLegacyHeaders()` and eyeball logs (unmapped headers → add to
   `HEADER_MAP`; odd status words → extend `OLD_STATUS_MAP`), then run
   `migrateLegacyV3()`. Idempotent; never writes to the old file. Afterwards
   review the Vendors tab for near-duplicates. You validated this flow on
   the demo sheet — repeat it here against the production copy.
4. Set `OAUTH_CLIENT_ID` in `auth.gs` (value from §2). **Do this BEFORE
   deploying** — an unset value skips the token-audience check.
5. Deploy → New deployment → type **Web app** → Execute as **Me** → access
   **Anyone** → Deploy. Copy the `/exec` URL — it goes ONLY into:
   - GitHub secret `VITE_APP_URL` (§3)
   - `frontend/.env.local` for local dev (§4)
   Never paste it into committed files.
6. Retire old intake: close any legacy Google Form for responses, remove
   leftover `onFormSubmit` triggers, set the old sheets' editors to Viewer.

## 2. OAuth client

Reuse the existing client or create a fresh one (fresh recommended since the
old ID sat in a public git history — see §6):

1. console.cloud.google.com → APIs & Services → OAuth consent screen →
   **Internal** (Workspace) → save.
2. Credentials → Create credentials → OAuth client ID → **Web application**.
3. Authorized JavaScript origins:
   - `http://localhost:5173` (dev)
   - `https://ozfirmware.github.io` (Pages origin — origin only, no path)
4. Copy the client ID → it goes into `auth.gs` `OAUTH_CLIENT_ID` (§1.4),
   GitHub secret `VITE_CLIENT_ID` (§3), and `frontend/.env.local` (§4).
   If you set it in `auth.gs` after deploying, create a NEW deployment
   version (Deploy → Manage deployments → edit → new version).

## 3. GitHub Pages (public repo)

1. Repo → Settings → Secrets and variables → **Actions** → New repository
   secret, twice:
   - `VITE_APP_URL` = the `/exec` URL from §1.5
   - `VITE_CLIENT_ID` = the client ID from §2.4
2. Repo → Settings → Pages → Build and deployment → Source:
   **GitHub Actions**.
3. Push to `main` (or Actions → "Deploy to GitHub Pages" → Run workflow).
   The workflow (`.github/workflows/pages.yml`) runs tests, builds with the
   secrets injected, deploys `frontend/dist`.
4. Site: `https://ozfirmware.github.io/procurement_hub/`

Rotating later = update the secret, re-run the workflow. No commit.

## 4. Local development

```bash
cd frontend
cp .env.example .env.local   # fill both values
npm install
npm run dev                  # http://localhost:5173
npm test                     # vitest suite
```

`.env.local` is gitignored — it never reaches the repo.

## 5. First sign-in & data setup

- The first `@oizom.com` user to call the API becomes **admin**.
- Admin tab: add users with roles (`admin` / `approver` / `requester`) and
  a department each — PR creation fails until the requester has one.
- `Projects` tab (Admin → Department Projects): each department needs at
  least one running project.
- `MaterialTypes` tab (Admin → Item Types): per-department item types;
  every line item requires one, plus qty + unit.
- `Vendors` tab (Admin → Vendors): registry incl. departments (comma list),
  contact, banking, payment terms, display name + logo URL for the Vendors
  tab cards. PR form offers only the requester's department's vendors.

## 6. Credential hygiene — exposed history cleanup

The old private-repo history (and the first push of the public repo)
contained real `/exec` URLs and a client ID inside `frontend/src/config.js`.
Cleanup is two-sided: rewrite the public history AND invalidate what leaked.

**a) Public repo history.** Replace the public repo's history with a single
fresh commit (no old blobs survive — nothing to scrub):

```bash
git checkout --orphan public-release
git commit -m "Procurement tool v3"
git push ozfirmware +public-release:main
git checkout main && git branch -D public-release
```

(Anyone who cloned the old history still has it — which is why b) matters
more than a).)

**b) Invalidate the leaked values:**
- **Apps Script URLs**: Deploy → Manage deployments → archive/delete every
  old deployment on the demo AND v1 sheets' script projects. An archived
  deployment's `/exec` URL stops working. Keep only the production
  deployment whose URL lives in the GitHub secret.
- **OAuth client ID**: create the fresh client (§2), point everything at
  it, then delete the old client in Google Cloud console → Credentials.
  Deleted client = old ID rejects all sign-ins.
- Consent screen stays Internal → even a live client ID never worked for
  non-Workspace accounts.

## 7. Ongoing releases

Frontend: merge to `main` → push → Pages workflow deploys.
Backend: edit `.gs` files in the Apps Script editor → Deploy → Manage
deployments → edit → **New version** (same URL, no secret change). Keep
`apps-script/` in the repo as the source of truth — paste changes both ways.
