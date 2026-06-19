# Demo setup

This `demo` branch is a sellable copy with **fake company data and no real logo**.
All the branding lives in code (already swapped here); the actual records live in
the database, so a demo = this branch + its own database + its own deployment.

## What's already fake on this branch
- Company name / CIF / address / signatory → `PROFESSIONAL` + `COMPANY_NAME` in `src/lib/proposta-doc.ts`
- Bank / IBAN → `BANK` in `src/app/facturacio/facturacio-view.tsx`
- COAC number + admin line → `rolSignatari` / `adminSignatari` in `src/lib/proposta-doc.ts`
- App name "Estudi Demo" → layout / login / nav
- Logo → text wordmark in documents; `public/logo.svg` placeholder in the UI (real `logo.jpg` removed)

To rebrand for a specific client, edit those few values and replace `public/logo.svg`.

## One-time infra setup
1. **Database** — create a new (empty) Neon database, separate from the real one.
2. **Migrate it:**
   ```
   DATABASE_URL="<demo-neon-url>" npm run db:migrate
   ```
3. **Seed fake data:**
   ```
   DATABASE_URL="<demo-neon-url>" npm run db:seed-demo
   ```
   (Refuses to run on a non-empty DB unless you pass `SEED_FORCE=1`, so it can't
   wipe the real database by accident.)
4. **Deploy** — new Vercel project from this repo, set the **Production Branch to
   `demo`**, with env vars:
   - `DATABASE_URL` = the demo Neon URL
   - `SESSION_PASSWORD` = a fresh random string ≥ 32 chars
   - `ADRI_PASSWORD` = the demo login password (username is `adri`)

That's it — the demo opens already populated with fake clients, expedients,
càlculs, propostes and factures.
