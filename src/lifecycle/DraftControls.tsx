import type { JsonObject } from "@craftainer/crud-sdk";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { useState, type ReactElement } from "react";
import type { ReadyResource } from "../core/index.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { usePublish } from "./mutations.ts";
import { recordStatus, type RecordStatus } from "./status.ts";

const STATUS_LABEL: Record<RecordStatus, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

const STATUS_COLOR = {
  published: "success",
  draft: "warning",
  archived: "default",
} as const satisfies Record<RecordStatus, "success" | "warning" | "default">;

export interface StatusBadgeProps {
  readonly ready: ReadyResource;
  readonly record: JsonObject;
}

/** A chip with the record's state. Hidden unless the resource has drafts or an archive. */
export function StatusBadge({
  ready,
  record,
}: StatusBadgeProps): ReactElement | null {
  const { draft_publish, archive_restore } = ready.capabilities;
  if (!draft_publish && !archive_restore) return null;
  const status = recordStatus(record);
  return (
    <Chip
      size="small"
      variant="outlined"
      color={STATUS_COLOR[status]}
      label={STATUS_LABEL[status]}
    />
  );
}

export interface RecordActionProps {
  readonly ready: ReadyResource;
  readonly id: number;
  /** Called after the server accepted the change. */
  readonly onDone?: (() => void) | undefined;
}

/** Publishes a draft. Hidden unless `capabilities.draft_publish`. */
export function PublishButton({
  ready,
  id,
  onDone,
}: RecordActionProps): ReactElement | null {
  const publish = usePublish(ready);
  if (!ready.capabilities.draft_publish) return null;
  return (
    <>
      <Button
        variant="contained"
        size="small"
        disabled={publish.isPending}
        onClick={() => publish.mutate(id, { onSuccess: () => onDone?.() })}
      >
        Publish
      </Button>
      {publish.error !== null && (
        <Alert severity="error">{publish.error.message}</Alert>
      )}
    </>
  );
}

/** Discards a draft after a confirmation (a draft has no published state to fall back to, so it is deleted). */
export function DiscardDraftButton({
  ready,
  id,
  onDone,
}: RecordActionProps): ReactElement | null {
  const remove = ready.hooks.useDelete();
  const [open, setOpen] = useState(false);
  if (!ready.capabilities.draft_publish) return null;
  return (
    <>
      <Button
        color="error"
        size="small"
        onClick={() => {
          remove.reset();
          setOpen(true);
        }}
      >
        Discard draft
      </Button>
      <ConfirmDialog
        open={open}
        title="Discard this draft?"
        confirmLabel="Discard"
        busy={remove.isPending}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          remove.mutate(id, {
            onSuccess: () => {
              setOpen(false);
              onDone?.();
            },
          })
        }
      >
        The draft is deleted and cannot be brought back.
        {remove.error !== null && ` ${remove.error.message}`}
      </ConfirmDialog>
    </>
  );
}

export interface DraftControlsProps {
  readonly ready: ReadyResource;
  readonly record: JsonObject;
  readonly id: number;
  /** Called after a publish or a discard. */
  readonly onChanged?: (() => void) | undefined;
}

/** Status badge plus, for a draft, Publish and Discard draft. Hidden without `draft_publish`. */
export function DraftControls({
  ready,
  record,
  id,
  onChanged,
}: DraftControlsProps): ReactElement | null {
  if (!ready.capabilities.draft_publish) return null;
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", flexWrap: "wrap" }}
    >
      <StatusBadge ready={ready} record={record} />
      {recordStatus(record) === "draft" && (
        <>
          <PublishButton ready={ready} id={id} onDone={onChanged} />
          <DiscardDraftButton ready={ready} id={id} onDone={onChanged} />
        </>
      )}
    </Stack>
  );
}
