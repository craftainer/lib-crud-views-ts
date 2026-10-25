// <DeleteAction>: a delete button with four ways to confirm or take back the
// deletion (see ./README.md).
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  DialogShell,
  FieldDisplay,
  ResourceGate,
  type FieldValue,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import { ArchiveButton } from "../lifecycle/ArchiveControls.tsx";

/**
 * - `immediate`: delete on click.
 * - `confirm`: ask first, showing the record.
 * - `undo`: hold the deletion back for `undoMs`; Undo cancels it.
 * - `soft`: delete (the server archives the record) and offer Undo, which
 *   restores it; renders lifecycle's `ArchiveButton`, needs the `archive_restore`
 *   capability, else renders nothing.
 */
export type DeleteVariant = "immediate" | "confirm" | "undo" | "soft";

export interface DeleteActionProps {
  readonly name: string;
  readonly apiVersion?: string | undefined;
  readonly id: number;
  /** Default `"confirm"`. */
  readonly variant?: DeleteVariant;
  /** Button text. Default "Delete". */
  readonly label?: string | undefined;
  /** What one record is called in messages. Default "record". */
  readonly recordLabel?: string | undefined;
  /** Called once the record is deleted on the server. */
  readonly onDeleted?: ((id: number) => void) | undefined;
  /** Called when Undo cancelled a pending deletion or restored the record. */
  readonly onUndone?: ((id: number) => void) | undefined;
  /**
   * Called when an `undo` deletion fails once its window has passed, also
   * when the component has been unmounted by then (the delete is committed on
   * unmount) and no toast can show it. Without it the failure is logged with
   * `console.error`.
   */
  readonly onDeleteError?: ((id: number, error: Error) => void) | undefined;
  /** `undo`: how long the deletion waits, in milliseconds. Default 6000. */
  readonly undoMs?: number | undefined;
  /** `confirm`: the fields shown. Default the first three besides `id`. */
  readonly summaryFields?: readonly string[] | undefined;
  readonly renderers?: RendererOverrides | undefined;
}

interface Toast {
  readonly text: string;
  readonly undo: () => void;
}

/** A delete button for one record; see `DeleteActionProps`. */
export function DeleteAction(props: DeleteActionProps): ReactElement {
  return (
    <ResourceGate
      name={props.name}
      apiVersion={props.apiVersion}
      pending={<></>}
      fallback={() => null}
    >
      {(ready) =>
        props.variant === "soft" ? (
          ready.capabilities.archive_restore ? (
            <ArchiveButton
              ready={ready}
              id={props.id}
              label={props.label ?? "Delete"}
              ariaLabel={`${props.label ?? "Delete"} ${props.recordLabel ?? "record"} ${props.id}`}
              onArchived={() => props.onDeleted?.(props.id)}
              onUndone={() => props.onUndone?.(props.id)}
            />
          ) : null
        ) : (
          <DeleteController ready={ready} {...props} />
        )
      }
    </ResourceGate>
  );
}

function RecordSummary({
  ready,
  id,
  names,
  renderers,
}: {
  readonly ready: ReadyResource;
  readonly id: number;
  readonly names: readonly string[] | undefined;
  readonly renderers: RendererOverrides | undefined;
}): ReactElement {
  const record = ready.hooks.useRecord(id);
  const shown =
    names === undefined
      ? ready.fields
          .filter((f) => f.name !== ready.resource.id_field)
          .slice(0, 3)
      : ready.fields.filter((f) => names.includes(f.name));
  const row = record.data as Record<string, FieldValue> | undefined;
  return (
    <Stack component="dl" spacing={1} sx={{ m: 0 }}>
      {row !== undefined &&
        shown.map((field) => (
          <Stack key={field.name} direction="row" spacing={2}>
            <Typography
              component="dt"
              variant="body2"
              sx={{ color: "text.secondary", minWidth: "10ch" }}
            >
              {field.label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>
              <FieldDisplay
                field={field}
                resource={ready.resource.name}
                value={row[field.name]}
                record={row}
                renderers={renderers}
              />
            </Typography>
          </Stack>
        ))}
    </Stack>
  );
}

function DeleteController({
  ready,
  ...props
}: DeleteActionProps & { readonly ready: ReadyResource }): ReactElement | null {
  const { id, variant = "confirm", undoMs = 6000 } = props;
  const label = props.recordLabel ?? "record";
  const remove = ready.hooks.useDelete();
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The latest callback, for a delete that settles after a re-render or unmount.
  const onDeleteError = useRef(props.onDeleteError);
  useEffect(() => {
    onDeleteError.current = props.onDeleteError;
  });

  const run = async (delayed = false): Promise<boolean> => {
    setBusy(true);
    try {
      await remove.mutateAsync(id);
      props.onDeleted?.(id);
      return true;
    } catch (failure) {
      const failed =
        failure instanceof Error ? failure : new Error("Could not delete");
      setError(failed.message);
      // Nobody may be looking after a delayed delete (the user left): never fail silently.
      if (delayed) {
        try {
          if (onDeleteError.current === undefined) throw failed;
          onDeleteError.current(id, failed);
        } catch (reported) {
          // No callback, or it threw: the log is the last place left to say so.
          console.error(`Could not delete ${label} ${id}`, failed);
          if (reported !== failed)
            console.error("onDeleteError threw", reported);
        }
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Leaving while an `undo` deletion waits commits it: the user asked for it.
  const pending = useRef<(() => Promise<boolean>) | undefined>(undefined);
  useEffect(
    () => () => {
      if (timer.current !== undefined) {
        clearTimeout(timer.current);
        void pending.current?.();
      }
    },
    [],
  );

  const undoLater = (): void => {
    pending.current = () => run(true);
    setToast({
      text: `Deleting ${label} ${id}…`,
      undo: () => {
        clearTimeout(timer.current);
        timer.current = undefined;
        setToast(null);
        props.onUndone?.(id);
      },
    });
    timer.current = setTimeout(() => {
      timer.current = undefined;
      setToast(null);
      void run(true);
    }, undoMs);
  };

  const click = (): void => {
    if (variant === "confirm") setConfirming(true);
    else if (variant === "undo") undoLater();
    else void run();
  };

  return (
    <>
      <Button
        color="error"
        size="small"
        disabled={busy || (variant === "undo" && toast !== null)}
        onClick={click}
        aria-label={`${props.label ?? "Delete"} ${label} ${id}`}
      >
        {props.label ?? "Delete"}
      </Button>
      {variant === "confirm" && (
        <DialogShell
          open={confirming}
          onClose={() => setConfirming(false)}
          title={`Delete ${label} ${id}?`}
          closeLabel="Cancel"
          maxWidth="xs"
          actions={
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                setConfirming(false);
                void run();
              }}
            >
              {props.label ?? "Delete"}
            </Button>
          }
        >
          <RecordSummary
            ready={ready}
            id={id}
            names={props.summaryFields}
            renderers={props.renderers}
          />
        </DialogShell>
      )}
      <Snackbar
        open={toast !== null}
        message={toast?.text}
        autoHideDuration={null}
        action={
          <Button color="inherit" size="small" onClick={toast?.undo}>
            Undo
          </Button>
        }
      />
      <Snackbar open={error !== null} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
