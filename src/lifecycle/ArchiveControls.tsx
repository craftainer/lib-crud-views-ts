import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import { useState, type ReactElement } from "react";
import type { ReadyResource } from "../core/index.ts";
import type { RecordActionProps } from "./DraftControls.tsx";
import { useRestore } from "./mutations.ts";

export interface ArchivedToggleProps {
  readonly ready: ReadyResource;
  /** Maps to the list query's `includeArchived`. */
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

/** "Show archived" switch. Hidden unless `capabilities.archive_restore`. */
export function ArchivedToggle({
  ready,
  checked,
  onChange,
}: ArchivedToggleProps): ReactElement | null {
  if (!ready.capabilities.archive_restore) return null;
  return (
    <FormControlLabel
      label="Show archived"
      control={
        <Switch
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      }
    />
  );
}

/**
 * Archives a record (the server's delete is a soft delete when it has an
 * archive) and offers Undo, which restores it. Hidden without `archive_restore`.
 */
export function ArchiveButton({
  ready,
  id,
  onDone,
  onArchived,
  onUndone,
  label = "Archive",
  ariaLabel,
  archived = false,
}: RecordActionProps & {
  /** Button text. Default "Archive". */
  readonly label?: string | undefined;
  /** Accessible name when the text alone is ambiguous, e.g. "Delete hero 1". */
  readonly ariaLabel?: string | undefined;
  /** Called once the record is archived (`onDone` also runs, as after an undo). */
  readonly onArchived?: (() => void) | undefined;
  /** Called once Undo restored the record. */
  readonly onUndone?: (() => void) | undefined;
  /** The record is archived already: the button hides, an Undo toast can still show. */
  readonly archived?: boolean;
}): ReactElement | null {
  const remove = ready.hooks.useDelete();
  const restore = useRestore(ready);
  const [undoOpen, setUndoOpen] = useState(false);
  if (!ready.capabilities.archive_restore) return null;
  const error = remove.error ?? restore.error;
  return (
    <>
      {!archived && (
        <Button
          color="error"
          size="small"
          aria-label={ariaLabel}
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(id, {
              onSuccess: () => {
                setUndoOpen(true);
                onArchived?.();
                onDone?.();
              },
            })
          }
        >
          {label}
        </Button>
      )}
      {error !== null && <Alert severity="error">{error.message}</Alert>}
      <Snackbar
        open={undoOpen}
        autoHideDuration={8000}
        onClose={(_event, reason) => {
          if (reason !== "clickaway") setUndoOpen(false);
        }}
        message="Record archived"
        action={
          <Button
            size="small"
            color="inherit"
            onClick={() =>
              restore.mutate(id, {
                onSuccess: () => {
                  setUndoOpen(false);
                  onUndone?.();
                  onDone?.();
                },
              })
            }
          >
            Undo
          </Button>
        }
      />
    </>
  );
}

/** Restores an archived record. Hidden without `archive_restore`. */
export function RestoreButton({
  ready,
  id,
  onDone,
}: RecordActionProps): ReactElement | null {
  const restore = useRestore(ready);
  if (!ready.capabilities.archive_restore) return null;
  return (
    <>
      <Button
        size="small"
        variant="contained"
        disabled={restore.isPending}
        onClick={() => restore.mutate(id, { onSuccess: () => onDone?.() })}
      >
        Restore
      </Button>
      {restore.error !== null && (
        <Alert severity="error">{restore.error.message}</Alert>
      )}
    </>
  );
}
