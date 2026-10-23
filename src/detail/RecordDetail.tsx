import type { JsonObject } from "@craftainer/crud-sdk";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useId, useState, type ReactElement, type ReactNode } from "react";
import {
  DialogShell,
  DrawerShell,
  PageShell,
  ResourceGate,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import { ArchiveButton, RestoreButton } from "../lifecycle/ArchiveControls.tsx";
import { DraftControls } from "../lifecycle/DraftControls.tsx";
import { recordStatus, SYSTEM_FIELDS } from "../lifecycle/status.ts";
import { RevisionsPanel } from "../revisions/Revisions.tsx";
import { FieldList } from "./FieldList.tsx";

export type DetailVariant =
  "page" | "form" | "metadata" | "tabs" | "dialog" | "drawer";

/** What `renderForm` receives: enough to mount VW2's edit form for this record. */
export interface DetailFormContext {
  readonly ready: ReadyResource;
  readonly id: number;
  readonly record: JsonObject;
  /** Call after a save so the detail refetches. */
  readonly onDone: () => void;
}

export interface DetailPanelProps {
  readonly ready: ReadyResource;
  readonly id: number;
  readonly variant?: DetailVariant | undefined;
  readonly renderers?: RendererOverrides | undefined;
  /** Replaces the page title; default `<Resource title> #<id>`. */
  readonly title?: ReactNode;
  /**
   * The `form` variant renders this in place of the field list, so the edit
   * form (VW2's `RecordForm`, or your own) lives in the detail page without
   * this package importing it.
   */
  readonly renderForm?: ((context: DetailFormContext) => ReactNode) | undefined;
  /** `dialog` and `drawer`: whether it is shown (default true). */
  readonly open?: boolean | undefined;
  /** `dialog` and `drawer`: called when the overlay asks to close. */
  readonly onClose?: (() => void) | undefined;
  /** Called after a publish, discard, archive or restore. */
  readonly onChanged?: (() => void) | undefined;
}

const doNothing = (): void => {};

interface BodyProps {
  readonly ready: ReadyResource;
  readonly record: JsonObject;
  readonly renderers: RendererOverrides | undefined;
}

function mainFields(ready: ReadyResource): ReadyResource["fields"] {
  return ready.fields.filter((f) => !SYSTEM_FIELDS.includes(f.name));
}

function Main({ ready, record, renderers }: BodyProps): ReactElement {
  return (
    <FieldList
      resource={ready.resource.name}
      fields={mainFields(ready)}
      record={record}
      renderers={renderers}
    />
  );
}

/** The server-maintained fields: ids, owner, lifecycle and audit timestamps. */
export function DetailMetadata({
  ready,
  record,
  renderers,
}: BodyProps): ReactElement {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography component="h2" variant="subtitle1" sx={{ mb: 1.5 }}>
        Metadata
      </Typography>
      <FieldList
        resource={ready.resource.name}
        fields={ready.fields.filter((f) => SYSTEM_FIELDS.includes(f.name))}
        record={record}
        renderers={renderers}
      />
    </Paper>
  );
}

function Tabbed({
  ready,
  record,
  renderers,
  id,
}: BodyProps & { id: number }): ReactElement {
  const base = useId();
  const tabs = [
    { key: "details", label: "Details" },
    { key: "metadata", label: "Metadata" },
    ...(ready.capabilities.revisions
      ? [{ key: "history", label: "History" }]
      : []),
  ];
  const [current, setCurrent] = useState("details");
  return (
    <Box>
      <Tabs
        value={current}
        onChange={(_event, key: string) => setCurrent(key)}
        aria-label="Record sections"
        sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            value={tab.key}
            label={tab.label}
            id={`${base}-${tab.key}-tab`}
            aria-controls={`${base}-${tab.key}-panel`}
          />
        ))}
      </Tabs>
      <Box
        role="tabpanel"
        id={`${base}-${current}-panel`}
        aria-labelledby={`${base}-${current}-tab`}
      >
        {current === "details" && (
          <Main ready={ready} record={record} renderers={renderers} />
        )}
        {current === "metadata" && (
          <DetailMetadata ready={ready} record={record} renderers={renderers} />
        )}
        {current === "history" && (
          <RevisionsPanel
            ready={ready}
            id={id}
            variant="audit"
            renderers={renderers}
          />
        )}
      </Box>
    </Box>
  );
}

function RecordActions({
  ready,
  record,
  id,
  onChanged,
}: {
  ready: ReadyResource;
  record: JsonObject;
  id: number;
  onChanged: () => void;
}): ReactElement {
  const archived = recordStatus(record) === "archived";
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <DraftControls
        ready={ready}
        record={record}
        id={id}
        onChanged={onChanged}
      />
      {archived && <RestoreButton ready={ready} id={id} onDone={onChanged} />}
      <ArchiveButton
        ready={ready}
        id={id}
        onDone={onChanged}
        archived={archived}
      />
    </Stack>
  );
}

function DetailLoaded({
  ready,
  id,
  record,
  variant,
  renderers,
  title,
  renderForm,
  open,
  onClose,
  refetch,
  onChanged,
}: DetailPanelProps & {
  record: JsonObject;
  variant: DetailVariant;
  open: boolean;
  refetch: () => void;
}): ReactElement {
  const heading = title ?? `${ready.resource.title} #${id}`;
  const changed = (): void => {
    refetch();
    onChanged?.();
  };
  const actions = (
    <RecordActions ready={ready} record={record} id={id} onChanged={changed} />
  );
  const body: BodyProps = { ready, record, renderers };
  switch (variant) {
    case "form":
      return (
        <PageShell title={heading} actions={actions}>
          {renderForm === undefined ? (
            <Main {...body} />
          ) : (
            renderForm({ ready, id, record, onDone: changed })
          )}
        </PageShell>
      );
    case "metadata":
      return (
        <PageShell title={heading} actions={actions}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            sx={{ alignItems: { md: "flex-start" } }}
          >
            <Box sx={{ flex: 2, minWidth: 0 }}>
              <Main {...body} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <DetailMetadata {...body} />
            </Box>
          </Stack>
        </PageShell>
      );
    case "tabs":
      return (
        <PageShell title={heading} actions={actions}>
          <Tabbed {...body} id={id} />
        </PageShell>
      );
    case "dialog":
    case "drawer": {
      const Shell = variant === "dialog" ? DialogShell : DrawerShell;
      return (
        <Shell
          open={open}
          onClose={onClose ?? doNothing}
          title={heading}
          actions={actions}
        >
          <Stack spacing={3}>
            <Main {...body} />
            <DetailMetadata {...body} />
          </Stack>
        </Shell>
      );
    }
    default:
      return (
        <PageShell title={heading} actions={actions}>
          <Main {...body} />
        </PageShell>
      );
  }
}

/** One record of an already loaded resource, in the chosen `variant` (default `page`). */
export function DetailPanel({
  variant = "page",
  open = true,
  ...rest
}: DetailPanelProps): ReactElement {
  const query = rest.ready.hooks.useRecord(rest.id);
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
  return (
    <DetailLoaded
      {...rest}
      record={query.data}
      variant={variant}
      open={open}
      refetch={() => void query.refetch()}
    />
  );
}

export interface RecordDetailProps extends Omit<DetailPanelProps, "ready"> {
  readonly resource: string;
  readonly apiVersion?: string | undefined;
}

/**
 * The detail of one record: `page` (read-only fields), `form` (an edit form
 * from `renderForm`), `metadata` (fields beside a metadata panel), `tabs`,
 * `dialog` or `drawer`. Status, publish, discard, archive and restore actions
 * show only when the manifest's `capabilities` allow them.
 */
export function RecordDetail({
  resource,
  apiVersion,
  ...rest
}: RecordDetailProps): ReactElement {
  return (
    <ResourceGate name={resource} apiVersion={apiVersion}>
      {(ready) => <DetailPanel ready={ready} {...rest} />}
    </ResourceGate>
  );
}
