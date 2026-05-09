# Contributing

## Branching

- `main` is the integration branch. It must always be deployable.
- Feature branches: `feat/<topic>`, fixes: `fix/<topic>`, chore work:
  `chore/<topic>`.
- Open a PR early; mark as draft until ready for review.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org). The
allowed types are enforced by `commitlint.config.cjs`:

```
feat | fix | perf | refactor | docs | test | build | ci | chore | style | revert | security
```

Examples:

```
feat(pos): support split tender between cash and card
fix(billing): mount Stripe webhook before JSON parser
docs(api): describe idempotencyKey contract
```

The Husky `commit-msg` hook runs commitlint locally so bad messages
fail before pushing.

## Local checks

`npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`.
The `pre-commit` hook runs `lint-staged` (eslint --fix + prettier) on
the staged files automatically.

## Code style

- TypeScript strict mode is on; no `any` without an explanation.
- Imports are sorted via `eslint-plugin-import` (`import/order` warn).
- Money math goes through `lib/money.ts` and `lib/saleMath.ts`; never
  hand-roll currency arithmetic in routes/services.
- Every Express handler that touches request data must validate it
  through a Zod schema in `validation/schemas.ts`.
- Use the `requestId` from `req.requestId` when logging — never log
  user-typed values without sanitisation.

## Pull requests

- One concern per PR. If a refactor is needed to land a feature, do the
  refactor in its own commit (or its own PR) so reviewers can compare
  cleanly.
- Update OpenAPI (`backend/src/lib/openapi.ts`) whenever a contract
  changes.
- Tests are not optional for new behaviour. Aim to add at least one
  unit or integration test per feature.
- The PR template checklist must be filled in.

## Releasing

1. `npm version --workspaces patch|minor|major` (or bump
   `frontend/package.json` and `backend/package.json` directly).
2. Tag the commit: `git tag v1.2.3 && git push --tags`.
3. The `Desktop Release` workflow builds Windows/macOS/Linux installers
   and publishes them as a GitHub Release. Promote it to "latest" once
   QA signs off.
