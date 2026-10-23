import type { JsonObject } from "@craftainer/crud-sdk";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, type ReactElement } from "react";
import {
  FieldDisplay,
  ResourceGate,
  type FieldDescriptor,
  type FieldValue,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import { FieldList } from "../detail/FieldList.tsx";
import { ConfirmDialog } from "../lifecycle/ConfirmDialog.tsx";
import { useInvalidateResource } from "../lifecycle/mutations.ts";
import {
  CREATED_AT_FIELD,
  changedFields,
  restorePatch,
  toRevisions,
  type Revision,
} from "./revision.ts";

export type RevisionsVariant = "list" | "audit" | "diff" | "preview";

export interface RevisionsPanelProps {
  readonly ready: ReadyResource;
  readonly id: number;
  readonly variant?: RevisionsVariant | undefined;
  readonly renderers?: RendererOverrides | undefined;
  /** Called after a revision was restored (list variant). */
  readonly onRestored?: ((revision: Revision) => void) | undefined;
}

interface VariantProps {
  readonly ready: ReadyResource;
  readonly id: number;
  readonly revisions: readonly Revision[];
  readonly renderers: RendererOverrides | undefined;
  readonly onRestored: ((revision: Revision) => void) | undefined;
}

function When({
  ready,
  value,
  renderers,
}: {
  ready: ReadyResource;
  value: string;
  renderers: RendererOverrides | undefined;
}): ReactElement {
  return (
    <FieldDisplay
      field={CREATED_AT_FIELD}
      resource={ready.resource.name}
      value={value}
      renderers={renderers}
    />
  );
}

/** Revisions newest first, each with Restore: a `PATCH` of the snapshot's writable fields. */
function RevisionListVariant({
  ready,
  id,
  revisions,
  renderers,
  onRestored,
}: VariantProps): ReactElement {
  const update = ready.hooks.useUpdate();
  const invalidate = useInvalidateResource(ready.resource.name);
  const [target, setTarget] = useState<Revision | null>(null);
  return (
    <>
      {update.error !== null && (
        <Alert severity="error">{update.error.message}</Alert>
      )}
      <List aria-label="Revisions" disablePadding>
        {revisions.map((revision) => (
          <ListItem
            key={revision.id}
            divider
            secondaryAction={
              <Button
                size="small"
                aria-label={`Restore revision ${revision.id}`}
                onClick={() => {
                  update.reset();
                  setTarget(revision);
                }}
              >
                Restore
              </Button>
            }
          >
            <ListItemText
              primary={`${revision.action} by ${revision.actor}`}
              secondary={
                <When
                  ready={ready}
                  value={revision.createdAt}
                  renderers={renderers}
                />
              }
              slotProps={{ secondary: { component: "div" } }}
            />
          </ListItem>
        ))}
      </List>
      <ConfirmDialog
        open={target !== null}
        title="Restore this revision?"
        confirmLabel="Restore"
        busy={update.isPending}
        onClose={() => setTarget(null)}
        onConfirm={() => {
          // The dialog is only open with a target.
          const revision = target as Revision;
          update.mutate(
            { id, patch: restorePatch(ready.fields, revision.snapshot) },
            {
              onSuccess: () => {
                setTarget(null);
                void invalidate();
                onRestored?.(revision);
              },
            },
          );
        }}
      >
        The record is updated with the values of this revision.
      </ConfirmDialog>
    </>
  );
}

const changedLabels = (
  fields: readonly FieldDescriptor[],
  before: JsonObject,
  after: JsonObject,
): string => {
  const names = changedFields(fields, before, after);
  return fields
    .filter((f) => names.includes(f.name))
    .map((f) => f.label)
    .join(", ");
};

/** A table of who did what and when, with the fields each change touched. */
function RevisionAuditVariant({
  ready,
  revisions,
  renderers,
}: VariantProps): ReactElement {
  return (
    <Table size="small" aria-label="Audit trail">
      <TableHead>
        <TableRow>
          <TableCell>When</TableCell>
          <TableCell>Action</TableCell>
          <TableCell>Actor</TableCell>
          <TableCell>Changed fields</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {revisions.map((revision, index) => (
          <TableRow key={revision.id}>
            <TableCell>
              <When
                ready={ready}
                value={revision.createdAt}
                renderers={renderers}
              />
            </TableCell>
            <TableCell>{revision.action}</TableCell>
            <TableCell>{revision.actor}</TableCell>
            <TableCell>
              {changedLabels(
                ready.fields,
                revisions[index + 1]?.snapshot ?? {},
                revision.snapshot,
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RevisionSelect({
  label,
  value,
  revisions,
  onChange,
}: {
  label: string;
  value: number;
  revisions: readonly Revision[];
  onChange: (id: number) => void;
}): ReactElement {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      sx={{ minWidth: 220 }}
    >
      {revisions.map((revision) => (
        <MenuItem key={revision.id} value={revision.id}>
          {`#${revision.id} ${revision.action}`}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** Two revisions side by side, field by field; unchanged fields are hidden by default. */
function RevisionDiffVariant({
  ready,
  revisions,
  renderers,
}: VariantProps): ReactElement {
  const newest = revisions[0] as Revision;
  const [toId, setToId] = useState<number | null>(null);
  const [fromId, setFromId] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const to = revisions.find((r) => r.id === toId) ?? newest;
  const from =
    revisions.find((r) => r.id === fromId) ??
    revisions[revisions.indexOf(to) + 1] ??
    to;
  const changed = new Set(
    changedFields(ready.fields, from.snapshot, to.snapshot),
  );
  const rows = ready.fields.filter((f) => all || changed.has(f.name));
  const show = (field: FieldDescriptor, revision: Revision): ReactElement => (
    <FieldDisplay
      field={field}
      resource={ready.resource.name}
      value={revision.snapshot[field.name] as FieldValue}
      renderers={renderers}
    />
  );
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
        <RevisionSelect
          label="From"
          value={from.id}
          revisions={revisions}
          onChange={setFromId}
        />
        <RevisionSelect
          label="To"
          value={to.id}
          revisions={revisions}
          onChange={setToId}
        />
        <FormControlLabel
          label="Show unchanged fields"
          control={
            <Switch
              checked={all}
              onChange={(event) => setAll(event.target.checked)}
            />
          }
        />
      </Stack>
      {rows.length === 0 ? (
        <Typography color="text.secondary">
          These revisions are identical.
        </Typography>
      ) : (
        <Table size="small" aria-label="Changes">
          <TableHead>
            <TableRow>
              <TableCell>Field</TableCell>
              <TableCell>Before</TableCell>
              <TableCell>After</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((field) => (
              <TableRow
                key={field.name}
                sx={
                  changed.has(field.name)
                    ? { bgcolor: "action.selected" }
                    : undefined
                }
              >
                <TableCell component="th" scope="row">
                  {field.label}
                  {changed.has(field.name) && (
                    <Chip size="small" label="changed" sx={{ ml: 1 }} />
                  )}
                </TableCell>
                <TableCell>{show(field, from)}</TableCell>
                <TableCell>{show(field, to)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}

/** One revision's snapshot as a read-only field list; pick the revision from a menu. */
function RevisionPreviewVariant({
  ready,
  revisions,
  renderers,
}: VariantProps): ReactElement {
  const [pickedId, setPickedId] = useState<number | null>(null);
  const picked =
    revisions.find((r) => r.id === pickedId) ?? (revisions[0] as Revision);
  return (
    <Stack spacing={2}>
      <Box>
        <RevisionSelect
          label="Revision"
          value={picked.id}
          revisions={revisions}
          onChange={setPickedId}
        />
      </Box>
      <FieldList
        resource={ready.resource.name}
        fields={ready.fields}
        record={picked.snapshot}
        renderers={renderers}
      />
    </Stack>
  );
}

const VARIANTS = {
  list: RevisionListVariant,
  audit: RevisionAuditVariant,
  diff: RevisionDiffVariant,
  preview: RevisionPreviewVariant,
} as const satisfies Record<
  RevisionsVariant,
  (p: VariantProps) => ReactElement
>;

function RevisionsBody({
  ready,
  id,
  variant = "list",
  renderers,
  onRestored,
}: RevisionsPanelProps): ReactElement {
  const query = ready.hooks.useRevisions(id);
  if (query.isPending) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  }
  if (query.error !== null) {
    return <Alert severity="error">{query.error.message}</Alert>;
  }
  const revisions = toRevisions(query.data);
  if (revisions.length === 0) {
    return <Typography color="text.secondary">No revisions yet.</Typography>;
  }
  const Variant = VARIANTS[variant];
  return (
    <Variant
      ready={ready}
      id={id}
      revisions={revisions}
      renderers={renderers}
      onRestored={onRestored}
    />
  );
}

/** The history of one record of an already loaded resource. Hidden without `capabilities.revisions`. */
export function RevisionsPanel(
  props: RevisionsPanelProps,
): ReactElement | null {
  return props.ready.capabilities.revisions ? (
    <RevisionsBody {...props} />
  ) : null;
}

export interface RecordRevisionsProps extends Omit<
  RevisionsPanelProps,
  "ready"
> {
  readonly resource: string;
  readonly apiVersion?: string | undefined;
}

/**
 * A record's revisions in one of four shapes: `list` (with Restore), `audit`
 * (table), `diff` (two revisions compared) or `preview` (one snapshot).
 */
export function RecordRevisions({
  resource,
  apiVersion,
  ...rest
}: RecordRevisionsProps): ReactElement {
  return (
    <ResourceGate name={resource} apiVersion={apiVersion}>
      {(ready) => <RevisionsPanel ready={ready} {...rest} />}
    </ResourceGate>
  );
}
