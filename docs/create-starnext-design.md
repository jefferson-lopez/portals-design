# create-starnext CLI design

`create-starnext` will generate a new project from the Starnext starter while letting the user choose only the architecture pieces that are project-specific.

The goal is simple: clone the clean base fast, then optionally add i18n, database/ORM, and auth without turning the base starter into a heavy SaaS template.

## Decision

Build `create-starnext` as a modular generator, not as a second hardcoded starter.

| Area | Decision |
| --- | --- |
| Base template | Bun-first Next.js starter from this repository |
| Package manager | Bun by default |
| i18n | Optional; default recommended because Starnext already supports it |
| DB/ORM | Optional: None, Drizzle, Prisma, Supabase |
| Auth | Optional: None, Better Auth, Auth.js, Clerk, Supabase Auth |
| Supabase pairing | If DB is Supabase, recommend Supabase Auth |
| Output | A ready-to-run app with only selected dependencies/files |

## User flow

```bash
bunx create-starnext my-app
```

```txt
Project name: my-app
Use internationalization? Yes
Database / ORM: None | Drizzle | Prisma | Supabase
Auth: None | Better Auth | Auth.js | Clerk | Supabase Auth
Install dependencies? Yes
Initialize git? Yes
```

When the user selects Supabase as database/backend:

```txt
Supabase Auth is recommended because you selected Supabase.
Use Supabase Auth? Yes
```

The user can still choose `None` for database and `None` for auth.

## Architecture

```txt
packages/
  create-starnext/
    src/
      index.ts
      prompts.ts
      scaffold.ts
      recipes/
        i18n.ts
        db-drizzle.ts
        db-prisma.ts
        db-supabase.ts
        auth-better-auth.ts
        auth-authjs.ts
        auth-clerk.ts
        auth-supabase.ts

templates/
  base/
  recipes/
    i18n/
    db-drizzle/
    db-prisma/
    db-supabase/
    auth-better-auth/
    auth-authjs/
    auth-clerk/
    auth-supabase/
```

## Generator model

The CLI should apply recipes over a base template.

Each recipe owns:

- files to copy
- dependencies to add
- environment variables to document
- post-install notes
- compatibility rules

Example recipe contract:

```ts
type Recipe = {
  id: string;
  label: string;
  dependencies?: string[];
  devDependencies?: string[];
  files?: RecipeFile[];
  env?: EnvVar[];
  apply: (context: ScaffoldContext) => Promise<void>;
};
```

## Compatibility rules

| Selection | Rule |
| --- | --- |
| DB: None + Auth: Better Auth | Warn that Better Auth usually needs persistence |
| DB: None + Auth: Auth.js | Allow, but generate minimal config only |
| DB: Supabase | Recommend Supabase Auth |
| DB: Drizzle | Ask database target later: PostgreSQL first, SQLite later |
| DB: Prisma | Generate minimal Prisma schema and `.env.example` |
| Auth: Clerk | Do not add ORM by default |

## Version strategy

First version can read templates from the published package.

Later versions can support:

- `--template-ref latest`
- `--template-ref github:user/repo`
- `--template-ref local/path`

Do not solve remote updates in v1. A reliable local package generator is more valuable than an over-engineered updater.

## Commands

Minimum v1 commands:

```bash
create-starnext <project-name>
create-starnext <project-name> --no-install
create-starnext <project-name> --no-git
create-starnext <project-name> --yes
```

Future commands:

```bash
create-starnext recipes
create-starnext doctor
create-starnext upgrade
```

## Acceptance criteria for v1

- [ ] Creates a project directory from the base starter.
- [ ] Supports Bun install by default.
- [ ] Can generate with no DB and no auth.
- [ ] Can keep i18n or remove it cleanly.
- [ ] Adds only dependencies required by selected recipes.
- [ ] Generates `.env.example` for selected recipes.
- [ ] Runs `bun run lint` successfully in the generated app.
- [ ] Runs `bun run build` successfully in the generated app.

## Out of scope for v1

- SaaS dashboard.
- Billing.
- Email.
- Organizations/teams.
- Remote template upgrade automation.
- Multiple package managers.
- Full auth implementation for every provider.

## Next step

Create the CLI package skeleton under `packages/create-starnext` and start with the base-template copy flow before adding recipes.
