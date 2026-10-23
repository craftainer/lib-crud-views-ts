# src/

- `index.ts` — the package's only entry point (`.`). It re-exports each view
  area; it holds one sorted `export * from "./<area>/index.ts";` line per area.
- `core/` — provider, `useResource`, the field model and renderer registry
  (contract I4, `../docs/contracts/I4-field-renderers.md`) and the layout
  shells. Everything the view areas build on.
- The view areas — `list/`, `filter/`, `form/`, `delete/`, `detail/`,
  `revisions/`, `bulk/`, `lifecycle/`, `stats/` — each own their directory,
  with stories (`*.stories.tsx`, next to the component) and tests under
  `../tests/`. Archive, restore and trash live only in `lifecycle/`
  (`ArchiveButton`, `TrashList`/`TrashPanel`, `useRestore`); `delete/`'s
  `soft` variant renders `ArchiveButton`.

## Do

- Style only through MUI theme tokens (`sx`, `theme.vars`); no raw colors or
  `px` (`../scripts/check-design-tokens.sh` enforces it, stories included).
- Give every exported function and component an explicit return type
  (`isolatedDeclarations`).
- Render fields through `FieldDisplay`, `FieldInput` and `FieldFilterInput`.

## Don't

- Import `@mui/x-data-grid-pro`/`-premium` or other paid MUI X packages: only
  the MIT tier is allowed.
- Add a dependency: every library is a peer (and a dev dependency).
