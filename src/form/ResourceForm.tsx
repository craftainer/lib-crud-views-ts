// <ResourceForm>: a create or edit form generated from a resource's
// `create`/`update` schemas (see ./README.md).
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { JsonObject } from "@craftainer/crud-sdk";
import { recordOptions } from "@craftainer/crud-sdk/tanstack";
import { useQuery } from "@tanstack/react-query";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  DialogShell,
  DrawerShell,
  FieldInput,
  PageShell,
  ResourceGate,
  type FieldDescriptor,
  type FieldValue,
  type ReadyResource,
  type RendererOverrides,
} from "../core/index.ts";
import { FormLayout } from "./layout.tsx";
import {
  groupFields,
  type FormLayoutKind,
  type FormSection,
} from "./sections.ts";
import { describeFailure } from "./problem.ts";
import { validateAll } from "./validate.ts";

type Row = Readonly<Record<string, FieldValue>>;

export interface ResourceFormProps {
  /** The manifest resource name. */
  readonly name: string;
  readonly apiVersion?: string | undefined;
  /** Edit this record; without it the form creates one. */
  readonly id?: number | undefined;
  /** Where the form renders. Default `"page"`. */
  readonly presentation?: "page" | "dialog" | "drawer";
  /** Dialog and drawer: whether it shows (a closed one renders nothing). */
  readonly open?: boolean | undefined;
  readonly onClose?: (() => void) | undefined;
  /** How fields are arranged. Default `"flat"`. */
  readonly layout?: FormLayoutKind;
  /** Titled groups of field names for `sections`, `tabs` and `stepper`; default Required and Optional. */
  readonly sections?: readonly FormSection[] | undefined;
  /** Only these fields (in the resource's order). Default every writable field. */
  readonly fields?: readonly string[] | undefined;
  /** Create: starting values. */
  readonly initial?: Row | undefined;
  /** Edit: save by itself after a pause in typing, while the form is valid. */
  readonly autoSave?: boolean | undefined;
  /** Pause before an auto-save, in milliseconds. Default 1000. */
  readonly autoSaveDelayMs?: number | undefined;
  /**
   * The record's current ETag, sent as `If-Match` on every save (edit only,
   * when the resource has `conditional_requests`). Called before each save,
   * because a save changes the ETag. Without it no header is sent by the form
   * (the SDK cache's `autoIfMatch` can still add one).
   */
  readonly etag?:
    | ((id: number) => string | undefined | Promise<string | undefined>)
    | undefined;
  readonly onSaved?: ((record: JsonObject) => void) | undefined;
  /** Heading override. Default "New <recordLabel>" or "Edit <recordLabel> <id>". */
  readonly title?: ReactNode;
  /** What one record is called in titles. Default "record". */
  readonly recordLabel?: string | undefined;
  readonly renderers?: RendererOverrides | undefined;
}

const noop = (): void => {};

const same = (a: FieldValue, b: FieldValue): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const pick = (fields: readonly FieldDescriptor[], row: Row): Row =>
  Object.fromEntries(fields.map((f) => [f.name, row[f.name]]));

/** Members of the create body or update patch: set values, and in edit only those that changed. */
function changes(
  fields: readonly FieldDescriptor[],
  values: Row,
  baseline: Row | undefined,
): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const field of fields) {
    const value = values[field.name];
    // A cleared field with no null to send is left out of the request.
    if (value === undefined) continue;
    if (baseline !== undefined && same(value, baseline[field.name])) continue;
    out[field.name] = value;
  }
  return out;
}

const hasProperty = (schema: JsonObject, name: string): boolean => {
  const props = schema["properties"];
  return (
    typeof props === "object" &&
    props !== null &&
    Object.hasOwn(props as object, name)
  );
};

type Status = "idle" | "saving" | "saved" | "nothing";

const STATUS_TEXT: Record<Status, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  nothing: "No changes to save",
};

/** A create or edit form for a resource; see `ResourceFormProps`. */
export function ResourceForm(props: ResourceFormProps): ReactElement | null {
  const presentation = props.presentation ?? "page";
  if (presentation !== "page" && props.open !== true) return null;
  return (
    <ResourceGate name={props.name} apiVersion={props.apiVersion}>
      {(ready) => (
        <FormController key={props.id ?? "new"} ready={ready} {...props} />
      )}
    </ResourceGate>
  );
}

function FormController({
  ready,
  ...props
}: ResourceFormProps & { readonly ready: ReadyResource }): ReactElement {
  const { id, layout = "flat", autoSave = false, renderers } = props;
  const mode = id === undefined ? "create" : "edit";
  const presentation = props.presentation ?? "page";
  const { hooks, resource, capabilities } = ready;
  const formId = useId();

  const record = useQuery({
    ...recordOptions(ready.namespace, ready.queryName, ready.api, id ?? 0),
    enabled: mode === "edit",
  });
  const create = hooks.useCreate();
  const update = hooks.useUpdate();

  const writable =
    mode === "create" ? resource.schemas.create : resource.schemas.update;
  const editable = ready.fields.filter(
    (f) =>
      !f.readOnly &&
      hasProperty(writable, f.name) &&
      (props.fields === undefined || props.fields.includes(f.name)),
  );
  const sections = groupFields(
    editable,
    layout === "flat"
      ? [{ title: "", fields: editable.map((f) => f.name) }]
      : props.sections,
  );

  const [baseline, setBaseline] = useState<Row | undefined>(undefined);
  const [values, setValues] = useState<Row>(() =>
    mode === "create" ? pick(editable, props.initial ?? {}) : {},
  );
  const [loaded, setLoaded] = useState(mode === "create");
  if (!loaded && record.data !== undefined) {
    // The record arrived: it becomes both the baseline and the first values.
    setLoaded(true);
    setBaseline(record.data as Row);
    setValues(pick(editable, record.data as Row));
  }

  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [invalid, setInvalid] = useState<Readonly<Record<string, string>>>({});
  const [serverErrors, setServerErrors] = useState<
    Readonly<Record<string, string>>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [active, setActive] = useState(0);
  const saving = useRef(false);

  const local = validateAll(editable, values);
  const invalidCount = Object.keys(invalid).length;
  const patch = changes(
    editable,
    values,
    mode === "edit" ? baseline : undefined,
  );
  const dirty = Object.keys(patch).length > 0;
  const errorOf = (name: string): string | undefined =>
    serverErrors[name] ?? (touched.has(name) ? local[name] : undefined);
  const errorCount = (section: FormSection): number =>
    section.fields.filter(
      (name) => errorOf(name) !== undefined || invalid[name] !== undefined,
    ).length;

  const edits = useRef(0);
  const setValue = (name: string, value: FieldValue): void => {
    edits.current += 1;
    setValues((prev) => ({ ...prev, [name]: value }));
    setServerErrors(({ [name]: _removed, ...rest }) => rest);
    setMessage(null);
    setStatus("idle");
  };

  const reset = (row: Row): void => {
    setBaseline(row);
    setValues(pick(editable, row));
    setTouched(new Set());
    setServerErrors({});
    setMessage(null);
    setConflict(false);
    setStatus("idle");
  };

  const save = async (options: {
    overwrite?: boolean;
    quiet?: boolean;
  }): Promise<void> => {
    if (saving.current) return;
    if (options.quiet !== true) {
      setTouched(new Set(editable.map((f) => f.name)));
      const firstBad = sections.findIndex((s) =>
        s.fields.some(
          (name) => local[name] !== undefined || invalid[name] !== undefined,
        ),
      );
      if (firstBad >= 0) setActive(firstBad);
    }
    if (Object.keys(local).length > 0 || invalidCount > 0) return;
    if (mode === "edit" && !dirty) {
      setStatus("nothing");
      return;
    }
    saving.current = true;
    setStatus("saving");
    setConflict(false);
    setMessage(null);
    setServerErrors({});
    try {
      if (mode === "create") {
        const created = await create.mutateAsync(patch as JsonObject);
        reset(pick(editable, props.initial ?? {}));
        setStatus("saved");
        props.onSaved?.(created);
      } else {
        const ifMatch =
          options.overwrite === true ||
          !capabilities.conditional_requests ||
          props.etag === undefined
            ? undefined
            : await props.etag(id as number);
        const seen = edits.current;
        const saved = await update.mutateAsync({
          id: id as number,
          patch: patch as JsonObject,
          ...(ifMatch === undefined ? {} : { ifMatch }),
        });
        setBaseline(saved as Row);
        // Edits made while the request ran are not saved yet.
        setStatus(edits.current === seen ? "saved" : "idle");
        props.onSaved?.(saved);
      }
    } catch (error) {
      const failure = describeFailure(
        error,
        editable.map((f) => f.name),
      );
      setConflict(failure.conflict);
      setServerErrors(failure.fieldErrors);
      setMessage(failure.message);
      setStatus("idle");
      const firstBad = sections.findIndex((s) =>
        s.fields.some((name) => failure.fieldErrors[name] !== undefined),
      );
      if (firstBad >= 0) setActive(firstBad);
    } finally {
      saving.current = false;
    }
  };

  const reload = async (): Promise<void> => {
    const result = await record.refetch();
    if (result.isError) {
      setMessage(`The record could not be reloaded: ${result.error.message}`);
    } else {
      reset(result.data as Row);
    }
  };

  // Auto-save: a quiet pause after the last edit, only while valid and not in conflict.
  const latestSave = useRef(save);
  useEffect(() => {
    latestSave.current = save;
  });
  const delay = props.autoSaveDelayMs ?? 1000;
  const autoSaveReady =
    autoSave &&
    mode === "edit" &&
    dirty &&
    !conflict &&
    message === null &&
    Object.keys(serverErrors).length === 0 &&
    Object.keys(local).length === 0 &&
    invalidCount === 0 &&
    status === "idle";
  useEffect(() => {
    if (!autoSaveReady) return undefined;
    const timer = setTimeout(
      () => void latestSave.current({ quiet: true }),
      delay,
    );
    return () => clearTimeout(timer);
  }, [autoSaveReady, values, delay]);

  const goNext = (): void => {
    const section = sections[active] as FormSection;
    setTouched((prev) => new Set([...prev, ...section.fields]));
    const blocked = section.fields.some(
      (name) => local[name] !== undefined || invalid[name] !== undefined,
    );
    if (!blocked) setActive(active + 1);
  };

  const label = props.recordLabel ?? "record";
  const title =
    props.title ?? (mode === "create" ? `New ${label}` : `Edit ${label} ${id}`);
  const stepper = layout === "stepper";
  const submit = (
    <Button
      type="submit"
      form={formId}
      variant="contained"
      disabled={invalidCount > 0 || status === "saving"}
    >
      {mode === "create" ? "Create" : "Save"}
    </Button>
  );
  const actions = stepper || (autoSave && mode === "edit") ? undefined : submit;

  const fieldByName = new Map(editable.map((f) => [f.name, f]));
  const renderField = (name: string): ReactElement => (
    <FieldInput
      key={name}
      field={fieldByName.get(name) as FieldDescriptor}
      resource={resource.name}
      value={values[name]}
      id={`${formId}-${name}`}
      error={errorOf(name)}
      renderers={renderers}
      onChange={(value) => setValue(name, value)}
      onBlur={() => setTouched((prev) => new Set(prev).add(name))}
      onInvalid={(reason) =>
        setInvalid((prev) => {
          if ((prev[name] ?? null) === reason) return prev;
          const { [name]: _removed, ...rest } = prev;
          return reason === null ? rest : { ...rest, [name]: reason };
        })
      }
    />
  );

  let content: ReactElement;
  if (!loaded && record.isError) {
    content = <Alert severity="error">{record.error.message}</Alert>;
  } else if (!loaded) {
    content = (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  } else {
    content = (
      <Box
        component="form"
        id={formId}
        noValidate
        aria-label={typeof title === "string" ? title : "Form"}
        onSubmit={(event) => {
          event.preventDefault();
          void save({});
        }}
      >
        <Stack spacing={2}>
          {message !== null && <Alert severity="error">{message}</Alert>}
          {conflict && (
            <Alert
              severity="warning"
              action={
                <>
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void reload()}
                  >
                    Reload
                  </Button>
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void save({ overwrite: true })}
                  >
                    Overwrite
                  </Button>
                </>
              }
            >
              This record was changed since you opened it. Reload to discard
              your edits and see the current version, or overwrite it with
              yours.
            </Alert>
          )}
          <FormLayout
            layout={layout}
            sections={sections}
            renderField={renderField}
            errorCount={errorCount}
            active={Math.min(active, sections.length - 1)}
            onActive={setActive}
            onNext={goNext}
            submit={submit}
          />
          <Typography
            role="status"
            variant="body2"
            sx={{ color: "text.secondary", minHeight: "1lh" }}
          >
            {STATUS_TEXT[status]}
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (presentation === "dialog") {
    return (
      <DialogShell
        open
        title={title}
        actions={actions}
        onClose={props.onClose ?? noop}
      >
        {content}
      </DialogShell>
    );
  }
  if (presentation === "drawer") {
    return (
      <DrawerShell
        open
        title={title}
        actions={actions}
        onClose={props.onClose ?? noop}
      >
        {content}
      </DrawerShell>
    );
  }
  return (
    <PageShell title={title} actions={actions}>
      {content}
    </PageShell>
  );
}
