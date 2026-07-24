# Portals Design

Portals Design is a focused platform for organizing, presenting, and delivering branding projects through professional client portals.

The product principle is simple:

> Each project deserves its own portal.

And the design principle is:

> The designer organizes the content. Portals Design presents it professionally.

## Product direction

Portals Design is not trying to become Notion, a CRM, a task manager, or a free-form website builder. The app is centered on four pillars:

1. **Authentication** — simple sign in, sign up, OAuth, password recovery, and profile.
2. **Dashboard** — a focused list of the designer's portals.
3. **Portal** — the project container where settings, sharing, branding, and publishing live.
4. **Block builder** — a specialized editor for branding content blocks such as text, images, galleries, colors, typography, files, videos, comparisons, dividers, and automatic assets.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS v4
- shadcn/Base UI
- next-themes
- next-intl
- Geist local fonts via `geist`
- Biome
- Bun

## Getting started

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

## Routes and languages

The app uses locale-prefixed routes:

- `/en`
- `/es`

Translations live in:

```txt
messages/en.json
messages/es.json
```

i18n configuration lives in:

```txt
src/i18n/routing.ts
src/i18n/request.ts
src/i18n/navigation.ts
src/proxy.ts
```

## UI foundation

The project uses shadcn/Base UI with Tailwind tokens. Shared primitives live in:

```txt
src/components/ui
```

Use semantic tokens like `bg-background`, `text-foreground`, and `text-muted-foreground` instead of hardcoded colors.

Add new UI components only when the product needs them:

```bash
bunx --bun shadcn@latest add <component>
```

## Supabase direction

Supabase will be added local-first:

- `supabase/migrations/` for schema, RLS, policies, and RPC functions.
- `supabase/seed.sql` for local development data.
- Supabase Auth for authentication.
- Supabase Postgres as the database.
- Important writes through Postgres RPC functions.
- Simple reads may use typed Supabase queries where RLS is enough.

### Deploying database migrations

The `Deploy Supabase migrations` GitHub Actions workflow applies pending
migrations when files under `supabase/migrations/` are pushed to `main`. It can
also be started manually from the Actions tab, but only a run targeting `main`
can deploy. Changing the workflow file itself on `main` also starts a run.

Create a GitHub Environment named `production` in **GitHub repository Settings
→ Environments**. Configure deployment branch protection for `main` and, when
the repository plan supports it, add required reviewers. Store these values in
that environment:

| Type | Name | Value |
| --- | --- | --- |
| Environment variable | `SUPABASE_PROJECT_ID` | Project reference from the Supabase dashboard URL |
| Environment secret | `SUPABASE_ACCESS_TOKEN` | Personal access token created in Supabase account settings |
| Environment secret | `SUPABASE_DB_PASSWORD` | Database password for the target Supabase project |

The project reference is not the public API URL or a Supabase API key. For a
dashboard URL such as `https://supabase.com/dashboard/project/abc123`, the
project reference is `abc123`.

Do not reuse `SUPABASE_SERVICE_ROLE_KEY` as the access token or database
password; they are different credentials. Vercel environment variables
configure the application runtime and are not automatically available to
GitHub Actions.

Before enabling the workflow against a database whose schema was created
manually, reconcile its migration history with the files in
`supabase/migrations/`. Running the workflow against a new empty Supabase
project applies all committed migrations in timestamp order.

## Quality checks

```bash
bun run lint
bun run build
```
