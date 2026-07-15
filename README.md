# Starnext

A clean Next.js starter for cloning and building quickly without repeating the same setup for theme, UI primitives, fonts and internationalization.

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

## Clone and rename this starter

Use this when starting a new project from Starnext:

```bash
git clone <your-starnext-repo-url> my-new-app
cd my-new-app
rm -rf .git
git init
bun install
```

Then rename the project:

```txt
package.json              -> name
README.md                 -> project title and description
messages/en.json          -> Metadata title/description
messages/es.json          -> Metadata title/description
src/i18n/routing.ts       -> locales/defaultLocale if needed
```

Post-clone checklist:

- [ ] Rename `package.json`.
- [ ] Update README title and product description.
- [ ] Update metadata translations in `messages/*.json`.
- [ ] Confirm supported locales in `src/i18n/routing.ts`.
- [ ] Replace the starter home with the real product entry point.
- [ ] Run `bun run lint`.
- [ ] Run `bun run build`.

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

The starter uses shadcn/Base UI with Tailwind tokens. Shared primitives live in:

```txt
src/components/ui
```

Use semantic tokens like `bg-background`, `text-foreground` and `text-muted-foreground` instead of hardcoded colors.

Add new UI components only when a project needs them:

```bash
bunx --bun shadcn@latest add <component>
```

Do not preinstall a large component set in the starter. Keep the base small and let each product pull the UI primitives it actually uses.

## Fonts

The project uses the `geist` package, not `next/font/google`.

Geist is wired through Tailwind CSS variables in:

```txt
src/app/[locale]/layout.tsx
src/app/globals.css
```

## What is intentionally not included

This base starter does not include auth, ORM or database setup by default. Those are project-specific decisions and should be added through future starter variants or a CLI generator.

Recommended future options:

- DB/ORM: Drizzle, Prisma or Supabase
- Auth: Better Auth, Auth.js, Clerk or Supabase Auth

## Quality checks

```bash
bun run lint
bun run build
```

## Official documentation

- [Next.js docs](https://nextjs.org/docs) — App Router, routing, rendering and deployment.
- [next-intl docs](https://next-intl.dev/) — translations, locale routing and formatting.
- [shadcn/ui docs](https://ui.shadcn.com/docs) — component workflow, theming, CLI and examples.
