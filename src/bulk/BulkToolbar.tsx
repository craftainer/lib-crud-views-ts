import type { BulkResult, Filters, JsonObject } from "@craftainer/crud-sdk";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRef, useState, type ReactElement } from "react";
import {
  toQueryFilters,
  type FieldFilters,
  type ReadyResource,
} from "../core/index.ts";
import { ConfirmDialog } from "../lifecycle/ConfirmDialog.tsx";
import { useInvalidateResource } from "../lifecycle/mutations.ts";
import {
  BulkLimitError,
  PartialPublishError,
  describeBulkError,
} from "./errors.ts";
import { downloadText, toCsv } from "./export.ts";
import type { BulkSelection } from "./selection.ts";

export type BulkAction = "delete" | "export" | "publish";

export interface BulkDone {
  readonly action: BulkAction;
  /** Records the call touched. */
  readonly count: number;
}

export interface BulkToolbarProps {
  readonly ready: ReadyResource;
  readonly selection: BulkSelection;
  /** The list's current filters. "Select all matching" needs at least one. */
  readonly filters?: FieldFilters | undefined;
  /** Actions to offer; each also needs the matching capability. Default: all. */
  readonly actions?: readonly BulkAction[] | undefined;
  /** Receives the CSV of "Export"; default: a file download. */
  readonly onExport?: ((csv: string, filename: string) => void) | undefined;
  readonly onDone?: ((done: BulkDone) => void) | undefined;
}

const ALL: readonly BulkAction[] = ["delete", "export", "publish"];

/**
 * Whether the bulk list shows drafts: `BulkPanel` lists them (so Publish can
 * act on them) exactly when the resource has drafts. "Delete all matching"
 * sends the same flag, so it deletes the rows the list shows, no more.
 */
export const listsDrafts = (ready: ReadyResource): boolean =>
  ready.capabilities.draft_publish;

/**
 * Bulk calls use filters, never `?id=` with filters (the server rejects that):
 * the ticked ids become `id__in`, "all matching" is the list's own filters.
 */
function serverFilters(
  ready: ReadyResource,
  selection: BulkSelection,
  filters: FieldFilters,
): Filters {
  return selection.allMatching
    ? toQueryFilters(filters)
    : { [`${ready.resource.id_field}__in`]: selection.selected };
}

/** The toolbar over a list's selection: count, bulk delete, export and bulk publish. Hidden while nothing is selected. */
export function BulkToolbar({
  ready,
  selection,
  filters = {},
  actions = ALL,
  onExport,
  onDone,
}: BulkToolbarProps): ReactElement | null {
  const invalidate = useInvalidateResource(ready.resource.name);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // "Delete all matching": the filters as the confirmation showed them, and
  // how many records they match (`"many"`: over the limit, `"unknown"`: could not be read).
  const [frozen, setFrozen] = useState<Filters | null>(null);
  const [matching, setMatching] = useState<number | "many" | "unknown" | null>(
    null,
  );
  const countRun = useRef(0);
  const { capabilities, bulk, id_field } = ready.resource;
  const max = bulk.max_matched;
  const hasFilters = Object.keys(toQueryFilters(filters)).length > 0;
  const count = selection.selected.length;
  const noticeAlert =
    notice === null ? null : (
      <Alert severity="success" role="status" sx={{ mt: 1.5 }}>
        {notice}
      </Alert>
    );
  if (count === 0 && !selection.allMatching) return noticeAlert;

  /** Runs `work`, then reports it. `work` returns the number of records it touched. */
  const run = async (
    action: BulkAction,
    changes: boolean,
    done: (count: number) => string,
    work: () => Promise<number>,
  ): Promise<void> => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!selection.allMatching && count > max) throw new BulkLimitError(max);
      // "All matching" with the filters gone would mean every record.
      if (selection.allMatching && !hasFilters) {
        throw new Error("The filter was cleared. Select the records again.");
      }
      const touched = await work();
      if (changes) {
        await invalidate();
        selection.clear();
      }
      setNotice(done(touched));
      onDone?.({ action, count: touched });
    } catch (caught) {
      // A partly done change (publish goes one record at a time) still moved the server.
      if (changes) void invalidate();
      setError(describeBulkError(caught as Error, max));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const records = async (): Promise<JsonObject[]> => {
    const rows: JsonObject[] = [];
    for await (const row of ready.handle.iterAll({
      filters: serverFilters(ready, selection, filters),
      includeUnpublished: true,
    })) {
      if (rows.length === max) throw new BulkLimitError(max);
      rows.push(row);
    }
    return rows;
  };

  /** Freezes the filters for the confirmation and counts what they match (at most `max + 1` rows are read). */
  const askDelete = (): void => {
    const token = ++countRun.current;
    const server = serverFilters(ready, selection, filters);
    setFrozen(server);
    setMatching(selection.allMatching ? null : count);
    setConfirming(true);
    if (!selection.allMatching) return;
    void (async () => {
      let found = 0;
      try {
        for await (const _row of ready.handle.iterAll({
          filters: server,
          includeUnpublished: listsDrafts(ready),
        })) {
          found += 1;
          if (found > max) break;
        }
      } catch {
        if (token === countRun.current) setMatching("unknown");
        return;
      }
      if (token === countRun.current) setMatching(found > max ? "many" : found);
    })();
  };

  const remove = (): Promise<void> =>
    run(
      "delete",
      true,
      (n) => `Deleted ${n} ${n === 1 ? "record" : "records"}.`,
      async () => {
        // The server deletes drafts too unless told otherwise: with drafts
        // hidden from the list, "all matching" must not reach them. Ticked
        // ids name their rows, so only "all matching" needs the flag.
        const result: BulkResult = await ready.handle.deleteMany(
          // Set when the dialog opened: the filters the user was shown.
          frozen as Filters,
          selection.allMatching
            ? { includeUnpublished: listsDrafts(ready) }
            : undefined,
        );
        return result.matched;
      },
    );

  const exportRows = (): Promise<void> =>
    run(
      "export",
      false,
      (n) => `Exported ${n} ${n === 1 ? "record" : "records"}.`,
      async () => {
        const rows = await records();
        const filename = `${ready.resource.name}-export.csv`;
        const csv = toCsv(ready.fields, rows);
        if (onExport === undefined) downloadText(filename, csv);
        else onExport(csv, filename);
        return rows.length;
      },
    );

  const publish = (): Promise<void> =>
    run(
      "publish",
      true,
      (n) => `Published ${n} ${n === 1 ? "record" : "records"}.`,
      async () => {
        const drafts = (await records()).filter(
          (row) => row["is_draft"] === true,
        );
        const published: number[] = [];
        for (const row of drafts) {
          const id = row[id_field] as number;
          try {
            await ready.handle.publish(id);
          } catch (caught) {
            // Untick what went through, so a retry covers only the rest.
            // ("All matching" refetches the drafts, so it needs no change.)
            if (!selection.allMatching) selection.setPage(published, false);
            throw new PartialPublishError(
              [...published],
              drafts.length,
              id,
              caught instanceof Error ? caught : new Error(String(caught)),
            );
          }
          published.push(id);
        }
        return drafts.length;
      },
    );

  const label = selection.allMatching
    ? "All records matching the filter are selected"
    : `${count} selected`;
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <Typography aria-live="polite" sx={{ mr: 1 }}>
          {label}
        </Typography>
        {!selection.allMatching && hasFilters && (
          <Button size="small" onClick={selection.selectAllMatching}>
            Select all matching the filter
          </Button>
        )}
        {actions.includes("export") && (
          <Button
            size="small"
            disabled={busy}
            onClick={() => void exportRows()}
          >
            Export
          </Button>
        )}
        {actions.includes("publish") && capabilities.draft_publish && (
          <Button size="small" disabled={busy} onClick={() => void publish()}>
            Publish
          </Button>
        )}
        {actions.includes("delete") && capabilities.bulk_delete && (
          <Button
            size="small"
            color="error"
            disabled={busy}
            onClick={askDelete}
          >
            Delete
          </Button>
        )}
        <Button size="small" disabled={busy} onClick={selection.clear}>
          Clear selection
        </Button>
      </Stack>
      {noticeAlert}
      {error !== null && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
      <ConfirmDialog
        open={confirming}
        title="Delete the selected records?"
        confirmLabel="Delete"
        // Fail closed: "all matching" waits for a count within the limit.
        busy={
          busy ||
          (selection.allMatching &&
            (matching === null ||
              matching === "many" ||
              matching === "unknown"))
        }
        onClose={() => {
          countRun.current += 1;
          setConfirming(false);
        }}
        onConfirm={() => void remove()}
      >
        {!selection.allMatching
          ? `${count} ${count === 1 ? "record is" : "records are"} deleted.`
          : matching === null
            ? "Counting the records that match the filter..."
            : matching === "unknown"
              ? "The number of matching records could not be read, so nothing is deleted. Close this and try again."
              : matching === "many"
                ? `More than ${max} records match the filter, which is over the limit. Narrow the filter.`
                : `${matching} ${matching === 1 ? "record matches" : "records match"} the filter and ${matching === 1 ? "is" : "are"} deleted.`}
      </ConfirmDialog>
    </Paper>
  );
}
