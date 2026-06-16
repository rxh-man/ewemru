## Goal
Convert the app from TanStack Start (SSR) to a **pure static Vite + React SPA** so it can be hosted on GitHub Pages with no server, then wire up automatic deployment from the repo.

## Why this is needed
GitHub Pages only serves static files. TanStack Start needs a running server. The app's logic (auth, Supabase queries, xlsb parsing) is already 100% client-side, so a static build is fully feasible — only the framework shell needs replacing.

## What I'll change

### 1. Replace the framework shell
- Remove TanStack Start, TanStack Router, and the server-function / SSR plumbing.
- Add plain `react-router-dom` with **HashRouter** (required so deep links like `/#/admin` work on GitHub Pages without 404s).
- New entry: `index.html` + `src/main.tsx` + `src/App.tsx`.
- Delete: `src/router.tsx`, `src/server.ts`, `src/start.ts`, `src/routes/__root.tsx`, `src/routeTree.gen.ts`, `src/integrations/supabase/auth-attacher.ts`, `auth-middleware.ts`, `client.server.ts`, `src/lib/api/`, `src/lib/config.server.ts`, `src/lib/error-page.ts`.

### 2. Port the pages
- `src/routes/index.tsx` → `src/pages/Login.tsx`
- `src/routes/admin.tsx` → `src/pages/Admin.tsx`
- `src/routes/surveyor.tsx` → `src/pages/Surveyor.tsx`
- Replace TanStack `createFileRoute` / `useNavigate` imports with `react-router-dom` equivalents. Auth, Supabase queries, xlsb parsing, and UI stay identical.

### 3. Vite config for GitHub Pages
- Switch `vite.config.ts` to the standard React SPA preset (no TanStack Start plugin).
- Set `base: './'` so assets resolve correctly under `https://<user>.github.io/<repo>/`.
- Add `public/404.html` that redirects to `index.html` (belt-and-suspenders for hash routing).

### 4. Automatic GitHub Pages deployment
- Add `.github/workflows/deploy.yml` — on every push to `main`, it runs `bun install`, `bun run build`, and publishes `dist/` to the `gh-pages` branch using the official `actions/deploy-pages` action.
- Add `.nojekyll` to the build output so Pages serves files starting with `_` correctly.

### 5. Environment variables for the published site
Supabase URL + anon key are currently in `.env`. For the GitHub Action build they need to be available as repo secrets. I'll:
- Reference `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the workflow as `${{ secrets.* }}`.
- Document the one-time setup you need to do on GitHub (see below).

## What you need to do once on GitHub (only thing not automated)
1. Push the project to a GitHub repo (Lovable's GitHub integration does this).
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. In the repo: **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `VITE_SUPABASE_URL` = (your Lovable Cloud URL — I'll print the exact value in chat after the conversion)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (your anon key — same)

After that, every push deploys automatically. The site will live at `https://<your-username>.github.io/<repo-name>/`.

## Trade-offs you should know
- **Lovable preview will still work** — the SPA build runs fine in Lovable's sandbox too, so you don't lose anything.
- **No SSR / SEO metadata per route** — fine for an internal field tool.
- **HashRouter URLs** look like `yoursite.com/#/admin` instead of `/admin`. This is the standard, reliable pattern for GitHub Pages and is what your original spec actually asked for.
- All app behavior (login, upload, search, verify, export) stays identical.

## Technical summary
- Remove: `@tanstack/react-start`, `@tanstack/react-router`, related Vite plugins, server function code, SSR entry, route tree generator.
- Add: `react-router-dom`, `.github/workflows/deploy.yml`, `public/404.html`, `public/.nojekyll`, `index.html`, `src/main.tsx`, `src/App.tsx`.
- Keep: Supabase client (`src/integrations/supabase/client.ts`), `src/lib/auth.ts`, `src/lib/fields.ts`, all UI components, Tailwind setup, xlsx parsing logic.

Approve and I'll execute the whole conversion in one pass.