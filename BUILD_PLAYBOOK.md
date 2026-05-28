# Build Playbook — Next.js + Supabase + Vercel

Capture of the full setup we used for **Porra Mundial 2026** so a future session can ramp up fast on a similar project. Skim the top for stack/sequence; dive into the "Gotchas we hit" section before you write the same code twice.

This playbook assumes:
- A multi-user web app
- Auth via passwordless magic link
- Postgres-backed with row-level security
- i18n out of the gate
- Mobile-friendly
- Deployed to Vercel with Supabase as the backend
- A single owner / admin role

If the new project is wildly different (e.g. a static marketing site, a real-time chat app), some of this won't apply — but the auth/data/RLS/deploy parts almost always will.

---

## 1. Stack decisions

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router, TypeScript)** | Server components keep the DB-touching code on the server. The new App Router is mature on Vercel. |
| Hosting | **Vercel** | Zero-config Next.js deploy. Free tier is plenty for a personal app. |
| DB + Auth + Storage | **Supabase** | Single integrated backend — Postgres, auth, file storage, RLS, all in one. Free tier fits friend-and-family projects. |
| Styling | **Tailwind CSS** | Fast to iterate, no naming overhead. Use a small custom component layer (`@layer components` in `globals.css`) for `.btn`, `.input`, `.card`, etc. |
| i18n | **Hand-rolled JSON + React Context** | `next-intl` is heavyweight for 3 languages. A 60-line provider + 3 JSON files is enough. |
| Icons | **Inline SVGs** (Heroicons paths or hand-drawn) | No icon-library dependency. Set `fill="currentColor"` and let parent set color via Tailwind class. |
| Email | **Resend → Gmail SMTP** | Started with Resend. Hit `onboarding@resend.dev` sandbox limit (only sends to account owner). Switched to **Gmail SMTP with an app password** which gives 500/day to any address. |

**Use the latest minor of `@supabase/ssr` and `@supabase/supabase-js`** when scaffolding (`npm view <pkg> version`). Hardcoding old versions cost us a debug cycle around the new `sb_publishable_*` key format. Don't pin to a major-zero version like `^0.5.x` — go `^0.10.x` or whatever is current.

---

## 2. Build sequence

Order matters — schema and auth before pages, otherwise you write pages against types that don't exist yet.

1. **Scaffold the Next.js project** (`package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.ts`, `.env.local.example`, `.gitignore`).
2. **Database schema** as numbered SQL migrations in `supabase/migrations/`. Apply each one via the Supabase Dashboard SQL editor (or `supabase db push` if linked). Run them in numeric order.
3. **RLS policies** (separate migration). Always before any data write code.
4. **Server-side helpers** (`src/lib/supabase/{client,server,middleware}.ts`).
5. **Middleware** (`/middleware.ts`) for auth session refresh + redirects.
6. **i18n** (`src/i18n/{es,en,ca}.json` + `provider.tsx`).
7. **Auth pages** (`/login`, `/auth/confirm`, `/onboarding`).
8. **Feature pages** in priority order. Always do the highest-leverage page first.
9. **Deploy early and often**. Don't sit on local-only for weeks.
10. **Admin tools** last (you can hand-edit DB while iterating).

---

## 3. Database / RLS patterns

### Migration file layout

```
supabase/migrations/
  0001_initial_schema.sql      -- tables + types + indexes + updated_at trigger
  0002_rls_policies.sql        -- enable RLS + every policy + helper functions
  0003_<feature>.sql           -- scoring fn / triggers / views
  0004_seed_<x>.sql            -- reference data (teams, venues, etc.)
  0005_seed_<y>.sql            -- larger seed (e.g. fixtures)
  0006_storage.sql             -- bucket + storage policies
  ...
```

Always keep `0001` clean. Subsequent migrations are usually:
- New columns (`alter table add column if not exists`)
- New tables
- New policies (`drop policy if exists ... ; create policy ...`)
- Bumping limits / defaults

### Reusable RLS helpers

These two functions paid for themselves many times:

```sql
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_emails ae
    join auth.users u on lower(u.email) = lower(ae.email)
    where u.id = auth.uid()
  );
$$;

-- Membership check that does NOT recurse when called from a policy ON the
-- same table (because SECURITY DEFINER bypasses RLS for the inner query).
create or replace function public.is_group_member(gid bigint)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;
```

**Always prefix `SECURITY DEFINER` functions with `set search_path = public`** to prevent search-path attacks. Grant execute to `authenticated`.

### Admin gating pattern

A tiny `admin_emails` table (one column, `email text primary key`) seeded with the owner's email. The `is_admin()` function joins it with `auth.users`. Then every admin policy is just `using (public.is_admin())`. Adding another admin = one `INSERT`.

### Avoid the infinite-recursion trap

If a policy on table `X` does `EXISTS (SELECT FROM X WHERE ...)`, you get **`42P17: infinite recursion detected in policy for relation X`** the moment anyone queries the table.

Fix: hoist the membership check into a `SECURITY DEFINER` function (see `is_group_member` above) so the inner query bypasses RLS.

### Audit your RLS via the SQL editor

When something seems off, simulate the user's session:

```sql
set local role authenticated;
set local request.jwt.claim.sub to '<their-uuid>';

-- now run the query you suspect is wrong
select * from public.some_table;

reset role;
```

This is much faster than re-deploying with `console.log`.

### The "embedded join" gotcha

PostgREST can only embed two tables when there's a **direct FK between them**. If both tables FK out to a third (like our `group_members.user_id → auth.users` and `profiles.id → auth.users`), the embed silently returns empty arrays. We wasted an evening on this.

**Rule**: if there's no direct FK, do two queries and join in app code. Don't fight PostgREST.

### Scoring / aggregation logic

Put aggregation logic in **a single Postgres function + a trigger that runs it when the source data changes**, not in app code. Predictable, atomic, and you can rerun it any time.

```sql
create or replace function public.calculate_points(...) returns smallint
language plpgsql immutable as $$ ... $$;

create or replace function public.score_match_predictions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'finished' and (old.status is distinct from 'finished' or ...) then
    update public.predictions set points_awarded = public.calculate_points(...)
    where match_id = new.id;
  end if;
  return new;
end;
$$;

create trigger matches_score_predictions after update on public.matches
  for each row execute function public.score_match_predictions();
```

When the trigger backfills, also handle the reverse case (admin unmarks a match → clear `points_awarded`).

### Leaderboard via a view

Don't compute the leaderboard in app code; create a Postgres view with `security_invoker = true` so the view's underlying RLS still applies. Querying the view from the page becomes a one-liner.

```sql
create or replace view public.group_leaderboard
with (security_invoker = true)
as select gm.group_id, p.id as user_id, ... from public.group_members gm
   join public.profiles p on ... left join public.predictions pr on ...;
```

### Schema-level conventions we kept

- `updated_at timestamptz not null default now()` on tables that get edited, with a per-table trigger that bumps it.
- `created_at timestamptz not null default now()` everywhere.
- Use `bigserial` for table IDs unless you specifically need a UUID exposed in URLs.
- Enums via `create type ... as enum (...)` for stage/status fields.
- `check` constraints for invariants (e.g. "if status='finished' then scores must be set").

### Migration `if not exists` discipline

Every `alter table add column`, `create policy`, `create index`, `insert ... on conflict ...` should be idempotent. This lets the user re-run a migration without fear, which they will.

---

## 4. Auth (the hardest part)

### Magic link, token-hash flow (NOT PKCE for cross-device)

Default Supabase magic link uses **PKCE**, which requires the verifier cookie set on the device that **requested** the link. If the user taps the link from Gmail, iMessage, Instagram, etc., it opens in an in-app webview — different cookie jar → exchange fails → user bounces back to login.

**The fix**: use the **token-hash flow**. Two parts:

**A) A server route at `/auth/confirm`:**

```ts
// src/app/auth/confirm/route.ts
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "magiclink") as EmailOtpType;
  const next = searchParams.get("next") ?? "/dashboard";
  if (!token_hash) return NextResponse.redirect(`${origin}/login?error=missing-token`);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);

  // First-time user → onboarding. Existing user → bump login stats and mirror
  // saved language/timezone into cookies so server pages render correctly
  // on a fresh device.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles")
      .select("id, login_count, language, timezone")
      .eq("id", user.id).maybeSingle();
    if (!profile) return NextResponse.redirect(`${origin}/onboarding`);

    await supabase.from("profiles").update({
      login_count: (profile.login_count ?? 0) + 1,
      last_login_at: new Date().toISOString(),
    }).eq("id", user.id);

    const response = NextResponse.redirect(`${origin}${next}`);
    if (profile.language) response.cookies.set("locale", profile.language, { path: "/", maxAge: 31536000, sameSite: "lax" });
    if (profile.timezone) response.cookies.set("tz", profile.timezone, { path: "/", maxAge: 31536000, sameSite: "lax" });
    return response;
  }
  return NextResponse.redirect(`${origin}${next}`);
}
```

**B) Update the Supabase Magic Link email template** (Dashboard → Authentication → Email Templates → Magic Link) to use the token hash:

```html
<h2>Magic Link</h2>
<p>Click here to sign in:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink">Sign in</a></p>
```

This makes the link work from any browser/device.

### The Supabase clients (browser / server / middleware)

Three thin wrappers around `@supabase/ssr`:

```ts
// src/lib/supabase/client.ts — for client components
"use client";
import { createBrowserClient } from "@supabase/ssr";
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```ts
// src/lib/supabase/server.ts — for server components / route handlers
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {/* Server Component — middleware will refresh instead */}
        },
      },
    }
  );
}
```

```ts
// src/lib/supabase/middleware.ts — for /middleware.ts session refresh
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const PUBLIC = ["/login", "/auth/callback", "/auth/confirm", "/", "/favicon.ico"];
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith("/_next"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone(); url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (user && (path === "/" || path === "/login")) {
    const url = request.nextUrl.clone(); url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return supabaseResponse;
}
```

```ts
// /middleware.ts
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";
export async function middleware(request: NextRequest) { return await updateSession(request); }
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

### Don't use the typed `Database` generic on @supabase/ssr until you've generated real types

We tried hand-writing a `Database` type and ended up with `never` errors because the shape PostgREST expects is intricate (`Relationships`, `CompositeTypes`, etc.). Two options:

- **Untyped client + cast each query result**: pragmatic, works fine. Define plain interfaces in `src/types/database.ts` and cast `data as MyType[]`.
- **`supabase gen types typescript`**: proper, but you have to regenerate after every migration.

Start untyped, switch later if it pays off.

### Don't skip `auth.getUser()` on the server

`getUser()` validates the session against Supabase. `getSession()` just reads the cookie. Server-side, always call `getUser()` — otherwise you trust a cookie that may be expired or tampered with.

### Storage policies for user-uploaded files (avatars etc.)

Avatars under `<user.id>/avatar.<ext>`. RLS allows insert/update/delete only when `(storage.foldername(name))[1] = auth.uid()::text`. Public read so the leaderboard can render `<img>` directly.

Always bump the `file_size_limit` on the bucket — the default 2 MiB rejects most phone photos. Set it to 10 MiB.

---

## 5. UI patterns we kept reaching for

### Server component fetches data, client component renders + interacts

```
page.tsx              <- server: createClient(), fetch everything, pass props
view-component.tsx    <- "use client", takes props, manages local state
```

The view component is responsible for "look real-time" — after a write, it updates its own local state (don't rely on `router.refresh()` to repaint instantly; props are stable until full re-fetch). Pattern:

```tsx
// Parent owns the cached map; passes update fn to children.
const [preds, setPreds] = useState(initial);
function onSaved(matchId, prediction) {
  setPreds((prev) => ({ ...prev, [matchId]: prediction }));
}

// Child syncs its inputs whenever the prediction prop changes.
useEffect(() => {
  setHome(prediction?.home_score?.toString() ?? "");
  setAway(prediction?.away_score?.toString() ?? "");
}, [prediction?.home_score, prediction?.away_score]);
```

### `router.refresh()` is unreliable; prefer `window.location` after mutations

In several places we saw `router.refresh()` fail to re-render with fresh server data when the underlying query was a Supabase call (not a tracked `fetch()`). When it matters that the next page shows fresh data, use a hard navigation:

```ts
window.location.href = `/groups/${id}`;
// or
window.location.reload();
```

Less elegant but correct.

### Modal pattern

Single `Modal` component (`src/components/modal.tsx`) — close on Escape, close on backdrop click, lock body scroll while open. Use `event.stopPropagation()` on the modal panel so inner clicks don't close it. Pass `size: "sm" | "md" | "lg" | "xl"` for the max-width preset.

### Mobile nav = sticky bottom bar

Header on desktop, sticky bottom-bar on mobile (`hidden sm:flex` + `fixed inset-x-0 bottom-0 sm:hidden`). Add bottom padding on `<body>` so content isn't covered. Active state lit in the accent color.

### Top tabbed-collapsible pattern for long lists

The Matches page: 12 group cards each collapsible. Better than one giant scrollable list. Track open state with `useState<string | null>`. Only one open at a time.

### i18n provider (lightweight)

```tsx
// src/i18n/provider.tsx
"use client";
const I18nContext = createContext<...>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => {
    const dict = DICTIONARIES[locale] ?? DICTIONARIES.es;
    return {
      locale, dict,
      t(key: string, vars?: Record<string, string | number>) {
        const raw = getNested(dict, key) ?? key;
        return vars ? Object.entries(vars).reduce(
          (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), raw) : raw;
      },
    };
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
```

Mount it once in the root layout with `locale = coerceLocale(cookieStore.get("locale")?.value)`. Save the user's chosen locale to a long-lived cookie when their profile updates AND set it as a cookie from `/auth/confirm` based on `profile.language` so it works on fresh devices.

For forms where the user picks the language live, wrap the form in a **nested** `I18nProvider` driven by the form's local `language` state — labels swap instantly without a reload.

### Custom dropdown (TeamPicker)

Native `<select>` can't render images, and Windows refuses to render flag emojis (it shows `CH` instead of 🇨🇭). Built a `<TeamPicker>` combobox with:
- A button that toggles a panel
- A search input at the top
- A scrollable list with flag images (from `flagcdn.com`)
- Close on outside click + Escape

Don't fight native selects; build the picker.

### Custom user-supplied icon images

When you need a real-world image (a trophy, a brand logo), pull a transparent PNG from Wikimedia Commons via PowerShell, drop in `public/`, render with `<img>`:

```powershell
Invoke-WebRequest -Uri 'https://upload.wikimedia.org/wikipedia/commons/...' `
  -OutFile 'public/<name>.png' -UserAgent 'YourApp/1.0 (you@email)'
```

(Wikipedia blocks default user agents; always send a custom UA.) Always check the file is actually RGBA: `file public/<name>.png` should say `8-bit/color RGBA`.

### Inline SVG icons

For UI icons (chevrons, navigation, etc.), inline the SVG path with `fill="currentColor"`. No icon library, color via Tailwind `text-gold-400`, no ID collisions when rendered many times. **Don't use SVG gradients with hardcoded IDs** — they collide when the icon appears many times on one page. Use a unique ID per instance (`useId()`) or just use solid `currentColor`.

### Tutorial / onboarding overlay

A multi-step modal triggered on first dashboard visit (tracked in `localStorage` with a versioned key like `"app:tutorial:v1"`). A persistent **"Replay tutorial"** button anchored on the dashboard so users can re-trigger it. Versioned key means you can ship `v2` and existing users see the updated tutorial once.

---

## 6. Deployment

### Supabase project

1. Create a separate project per app (don't share a project across products).
2. Apply migrations in order via the SQL editor (or `supabase db push` if linked locally).
3. **Auth → URL Configuration**:
   - Site URL = your production URL
   - Redirect URLs include: `https://yourapp.vercel.app/auth/confirm`, `https://*.vercel.app/auth/confirm`, `http://localhost:3000/auth/confirm`
4. **Auth → Email Templates** → Magic Link → swap to the token-hash flow (see above).
5. **Auth → SMTP** → set up Gmail SMTP (free tier of Supabase only sends 2-3 emails/hour via their default).

### Gmail SMTP setup (~5 min)

1. Enable 2-Step Verification on the Google account.
2. Create an "App Password" at https://myaccount.google.com/apppasswords (16 chars).
3. In Supabase SMTP settings:
   | | |
   |---|---|
   | Sender email | your-gmail@gmail.com |
   | Sender name | Your App Name |
   | Host | `smtp.gmail.com` |
   | Port | `465` |
   | Username | your-gmail@gmail.com |
   | Password | the app password (no spaces) |

Sends up to 500/day. Plenty for friends/family-scale projects. Switch to a domain in Resend if you need branding.

### Vercel

1. Push the repo to GitHub.
2. Import in Vercel.
3. **Environment variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` — base URL only (no `/rest/v1/`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the publishable key (sb_publishable_… or anon JWT)
   - (Optional) `NEXT_PUBLIC_SITE_URL`, admin emails if you parameterize them
4. Deploy. After it's up, copy the URL back into Supabase's Site URL setting.

### `.gitignore` must include

```
.env.local
.next/
node_modules/
tsconfig.tsbuildinfo
.vercel
```

Easy to forget `tsconfig.tsbuildinfo` — it gets committed on the first push if you don't.

---

## 7. Gotchas we hit (in order, with the fix)

| Symptom | Cause | Fix |
|---|---|---|
| `Application error: a server-side exception` on the root route, but `/login` worked | Pinned `@supabase/ssr@^0.5.2` didn't support the new `sb_publishable_*` key | Bump to `^0.10.x` |
| Migration `function gen_random_bytes(integer) does not exist` inside `SECURITY DEFINER` fn | pgcrypto lives in `extensions` schema; my fn set `search_path = public` | Use `gen_random_uuid()` (Postgres core) + string-slice the hex |
| Group creation silently "did nothing" | (a) UI didn't refresh after the RPC; (b) RLS infinite recursion on group_members | (a) `window.location.href = ...` instead of `router.refresh()`; (b) hoist membership check into a SECURITY DEFINER helper |
| Members list always empty | `profiles!inner` join failed because there's no direct FK between `group_members` and `profiles` | Run two separate queries and join in app code |
| Magic link "kicks you back to login" on phone | PKCE flow needs same-browser verifier cookie; in-app webviews don't have it | Switch to token-hash flow with `/auth/confirm` route + update email template |
| `email rate limit exceeded` for second user | Supabase default SMTP allows ~3 emails/hour | Set up Resend OR Gmail SMTP |
| Resend works for owner but not for anyone else | `onboarding@resend.dev` only sends to the Resend account email | Verify a domain in Resend, OR switch to Gmail SMTP |
| Country names cut off on mobile | Long localized names + tight flex layout | Render the 3-letter code (e.g. `MEX`) on `<sm:` and full name on `sm:+` |
| Windows browsers render flag emojis as letters | Microsoft never shipped flag glyphs | Use `flagcdn.com/wXX/<iso2>.png` images everywhere |
| Native `<select>` dropdown unreadable on dark theme on Windows | OS default for `<option>` is white background | Add `color-scheme: dark` to `:root` + explicit `option { background; color; }` in CSS |
| Prediction "Save" appeared to do nothing immediately (showed after refresh) | Stale prediction prop after save; on collapse-then-expand, child re-mounted with old data | Lift prediction map into parent, update via `onSaved` callback, sync child state with `useEffect` on prop change |
| SVG icon with `<defs id="xxx">` rendered broken when used many times on a page | Duplicate IDs in DOM; gradients only resolved for first instance | Use `useId()` for IDs, OR drop gradients and use `fill="currentColor"` |
| Trophy PNG showed up with a white square around it | The "PNG" was actually a JPEG-with-white-background renamed to .png | Verify with `file <name.png>` — must say `RGBA`; pull from Wikimedia Commons |
| Avatar upload rejected for big phone photos | Default Supabase bucket `file_size_limit` was 2 MiB | `update storage.buckets set file_size_limit = 10485760 where id = 'avatars'` |
| User's language reset to default after logging in on a new device | Locale cookie not present on the new browser | In `/auth/confirm`, read `profile.language` and set the cookie on the redirect response |

---

## 8. File map of a typical feature

```
src/app/<feature>/
  page.tsx                <- server: fetch everything, redirect to login if needed, pass props
  <feature>-view.tsx      <- "use client", renders + manages local state + writes back to Supabase
  <sub-feature>/          <- nested routes if needed
```

Shared:
```
src/components/<name>.tsx   <- reusable UI (modal, team-picker, trophy-icon, nav-link, tutorial)
src/lib/supabase/           <- the three clients
src/lib/utils.ts            <- flagUrl, formatKickoff, coerceLocale, coerceTimezone, classNames
src/i18n/{es,en,ca}.json    <- dictionaries
src/i18n/provider.tsx       <- I18nProvider + useI18n hook
src/i18n/dictionaries.ts    <- LOCALES, DEFAULT_LOCALE, teamName(team, locale), etc.
src/types/database.ts       <- hand-written interfaces matching the DB
```

---

## 9. Conventions that made debugging easier

- **All times in UTC in the DB**, render in the user's timezone in the UI. Each user picks their IANA timezone in onboarding + profile. Pass it as a prop from server pages to client views; never trust the browser's clock.
- **Numbered migrations only** (`0001_*.sql`, `0002_*.sql`). No date-based names — they sort wrong in some editors.
- **All `INSERT … ON CONFLICT DO UPDATE` for seeds**, all `CREATE OR REPLACE` for functions/views, all `IF NOT EXISTS` for indexes. Migrations are re-runnable.
- **Use `dynamic = "force-dynamic"`** on server pages that hit the DB. Avoids stale-data confusion in Next.js's caching layers.
- **Cast Supabase results explicitly** (`(data as MyType[]) ?? []`) when not using generated types. Never silently rely on `any`.
- **Always check the actual user/data when something's wrong** via `select ... from auth.users` / `select ... from public.<table>` in the SQL editor before deep-diving into code.
- **Memory files** for the project alongside `CLAUDE.md` if working with Claude. Capture decisions ("we picked X because Y") and the user's preferences. Saves an entire onboarding loop in the next session.
- **`git -c user.email=... -c user.name=...`** for ad-hoc commits in fresh repos — don't modify the user's global git config.

---

## 10. What I'd start with on the next project

If you give me this playbook and say "let's build X", expect me to do roughly:

1. **Ask 4 clarifying questions max** about scope: who uses it, auth method, mobile importance, language(s), payment model. Stop and confirm before building.
2. **Sketch the data model** in plain English. Get a yes/no before writing SQL.
3. **Scaffold the project** — `package.json`, configs, `.gitignore`, `.env.local.example`, `tsconfig`, Tailwind, the Supabase clients, middleware. Maybe 15 files in one batch. **Pin `@supabase/ssr` and `@supabase/supabase-js` to the latest** via `npm view`.
4. **Write all migrations first** (schema, RLS, seeds, storage), have you apply them in the Supabase SQL editor.
5. **Build auth** (`/login` + `/auth/confirm` + the SMTP setup instructions for Gmail).
6. **One page at a time**, deploying to Vercel after each major slice. **Run typecheck after every batch**.

Specific defaults I'd reach for unless told otherwise:
- Next.js 15 App Router + TypeScript + Tailwind + Supabase
- Magic link auth, token-hash flow from day one
- Gmail SMTP (don't even try Resend without a custom domain)
- 16 MiB upload limit on file buckets
- Black/neutral background with one accent color
- Sticky bottom nav on mobile, header nav on desktop
- All times in UTC, user picks their timezone
- Lightweight i18n if multi-language
- Inline-SVG icons with `currentColor`
- Custom combobox for any picker that needs images (countries, teams, products with thumbnails)
- A small admin panel: list users + groups + activity counts. Owner-email allowlist in a single-column `admin_emails` table.

---

## 11. Things I would have skipped from day one

Most of these are "we built it, here's why I'd skip it next time":

- **A separate page for member details** when a modal works (we ended up replacing the page with a modal).
- **Multiple admin gating mechanisms** — one allowlist table is enough.
- **`router.refresh()` for any meaningful mutation flow** — go straight to `window.location.href` in App Router until they fix this for non-`fetch()` queries.
- **The `Database<>` generic on @supabase/ssr** until you have generated types. The hand-written one fights you constantly.
- **Custom SVG with gradients** for icons that appear many times on a page. Solid color with `currentColor` is bulletproof.
- **Native `<select>` for anything that should show an image** — just build a custom picker once and reuse it.

---

## Appendix A — minimum dependency set

```json
{
  "dependencies": {
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.106.1",
    "next": "^15.2.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3"
  }
}
```

These are the versions we shipped — bump to latest for new projects.

## Appendix B — `.env.local.example`

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAIL=you@example.com
```

`NEXT_PUBLIC_SUPABASE_URL` is the base URL — **no `/rest/v1/`**. Supabase's dashboard often shows the REST endpoint with that suffix; strip it.

---

End of playbook. If you give this whole file to a fresh session along with "let's build a [thing]", you should be productive in the first message.
