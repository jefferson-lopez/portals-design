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

## Quality checks

```bash
bun run lint
bun run build
```
