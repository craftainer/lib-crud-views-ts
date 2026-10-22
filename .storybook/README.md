# .storybook/

Storybook 10 configuration (ADR 0002), copied from `template-react` and adapted
to a library.

- `main.ts` — story globs (`src/**/*.stories.tsx`) and addons.
- `preview.tsx` and `Frame.tsx` — wrap every story in `CrudProvider` over a stub CRUD client
  (`tests/fixtures/stub.ts`), the demo theme and the light/dark toolbar switch
  (`theme` global). `parameters.stub` sets how the fake server behaves.
- `demoTheme.ts` — a Field-Ledger-like MUI theme. It exists only for stories:
  the package itself is theme-agnostic.

## Do

- Write a `*.stories.tsx` next to every exported component, covering its
  loading, empty and error states.
- Use the theme (`sx`, `theme.vars`) in stories; the design-token lint covers
  `src/**/*.stories.tsx`.

## Don't

- Hit a real server from a story; use the stub client.
