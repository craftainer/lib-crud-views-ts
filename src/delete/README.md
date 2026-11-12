# src/delete/

- `DeleteAction.tsx` — a delete button with four variants: `immediate`,
  `confirm` (dialog showing the record), `undo` (deletion waits `undoMs`; Undo
  cancels; leaving the page commits it; if that delayed delete fails, also
  after leaving, `onDeleteError(id, error)` is called, else the failure is
  logged with `console.error`), `soft` (delete, then an Undo toast that
  restores; needs `archive_restore`, else it renders nothing). `soft` renders
  `lifecycle/ArchiveButton`, the one implementation of archive-with-undo.

The trash list (archived records with Restore) is `lifecycle/TrashList` /
`TrashPanel`, not part of this area.

## Behaviour to know

- `undo` commits the pending delete when the component unmounts inside
  `undoMs`. That is deliberate: dropping a delete the user was told about would
  be worse. The risk is a host that remounts the row (a refetch that changes
  `key`s, a route change): keep the row mounted or use `confirm`.

## Don't

- Call `DELETE` with a stale `If-Match`: the delete hook takes only the id.
