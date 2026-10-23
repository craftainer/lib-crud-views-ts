# src/delete/

- `DeleteAction.tsx` — a delete button with four variants: `immediate`,
  `confirm` (dialog showing the record), `undo` (deletion waits `undoMs`; Undo
  cancels; leaving the page commits it), `soft` (delete, then an Undo toast that
  restores; needs `archive_restore`, else it renders nothing).
- `TrashView.tsx` — archived records with Restore (needs `archive_restore`).
- `restore.ts` — the shared restore mutation, refreshing the resource's cache.

## Don't

- Call `DELETE` with a stale `If-Match`: the delete hook takes only the id.
