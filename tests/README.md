# tests/

- `core/` — unit tests of `src/core/` (Vitest + Testing Library, jsdom). The
  100% coverage gate covers `src/**/*.{ts,tsx}` except stories.
- `fixtures/` — the manifest fixture and the stub CRUD client; see its
  `README.md`.
- `visual/` — Storybook visual-regression and axe suite; see its `README.md`.
- `release-repository.test.ts` — template-owned guard for `make publish`.
- `setup.ts`, `helpers.tsx` — Vitest setup and render helpers.

## Do

- Test through the public exports (`src/core/index.ts`) and the stub client.
- Keep fixtures in `fixtures/`; copy a changed manifest fixture from
  `lib-crud-py` instead of editing it.

## Don't

- Mock `@craftainer/crud-sdk`: the stub replaces only `fetch`.
