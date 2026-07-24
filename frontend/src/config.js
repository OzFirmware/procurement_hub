// Values come from the environment, never from source:
//  - local dev:  frontend/.env.local (gitignored) — copy .env.example
//  - CI builds:  GitHub Actions secrets VITE_APP_URL / VITE_CLIENT_ID (see SETUP.md)
// Note: both values ship in the built JS bundle by design (the browser needs
// them); keeping them out of the repo enables rotation without code changes.
export const CFG = {
    // Apps Script web app URL, ends with /exec
    APP_URL: import.meta.env.VITE_APP_URL || "",
    // Google OAuth client ID, ends with .apps.googleusercontent.com
    CLIENT_ID: import.meta.env.VITE_CLIENT_ID || "",
};

if (!CFG.APP_URL || !CFG.CLIENT_ID) {
    console.error(
        "Missing VITE_APP_URL / VITE_CLIENT_ID — copy frontend/.env.example to frontend/.env.local (local dev) or set GitHub Actions secrets (CI). See SETUP.md."
    );
}
