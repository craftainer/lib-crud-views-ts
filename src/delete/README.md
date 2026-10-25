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

## Don't

- Call `DELETE` with a stale `If-Match`: the delete hook takes only the id.
