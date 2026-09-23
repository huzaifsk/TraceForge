# Contributing to TraceForge

Thanks for helping! TraceForge aims for a high bar of quality. These guidelines keep it that way.

## Getting set up

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up && pnpm db:migrate
pnpm dev
```

## Before you open a PR

1. Read the engineering handbook: [`.claude/skills/traceforge/SKILL.md`](.claude/skills/traceforge/SKILL.md).
   It covers the architecture decisions, the dependency rules between packages, and the definition of done.
2. Run `pnpm check`. It must pass: formatting, lint, types, tests and build.
3. Add tests for the behavior you changed, including failure paths.
4. For UI changes, include screenshots in light and dark themes at desktop and mobile widths.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):
`feat(sdk): capture unhandled rejections`, `fix(api): reject oversized events`.
Scopes: `sdk`, `api`, `dashboard`, `demo`, `schema`, `shared`, `ui`, `repo`, `docs`, `ci`.

## Changing the wire format

`packages/event-schema` is a public contract between SDK versions and the API. A change there
must update the Zod schema, the TypeScript types (a compile-time guard enforces that they match), the
database migration if needed, and the docs, all in the same PR. Be backwards compatible
whenever possible: old SDKs in the wild keep sending the old shape.

## Privacy

Proposals to collect new data need a clear justification. Anything personal must be opt-in.

## Reporting security issues

Please don't open a public issue for a vulnerability. Email the maintainers instead (see the repository's security policy).
