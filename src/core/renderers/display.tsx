import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { humanize } from "../fields.ts";
import { useFormat } from "../context.ts";
import { parseInstant } from "../values.ts";
import type { DisplayRendererProps, FieldValue } from "../types.ts";

function Empty(): ReactElement {
  return (
    <Typography component="span" variant="body2" color="text.secondary">
      {"—"}
    </Typography>
  );
}

const isEmpty = (value: FieldValue): boolean =>
  value === null || value === undefined || value === "";

function asText(value: FieldValue): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Characters that could add a mailto header, a second recipient or markup. */
const UNSAFE_IN_MAILBOX = /[\s?&#%,;:"<>()[\]\\]/;

/** C0 and C1 control characters (and DEL), which a URL parser may drop or encode. */
const hasControl = (text: string): boolean =>
  Array.from(text).some((c) => {
    const code = c.charCodeAt(0);
    return code < 0x20 || (code >= 0x7f && code <= 0x9f);
  });

/**
 * A single plain address, checked without a backtracking pattern: one `@`, a
 * non-empty local part, a dotted domain with no empty label, and none of the
 * characters a mailto link could use to add a `bcc` or `body`.
 */
const isMailbox = (text: string): boolean => {
  if (UNSAFE_IN_MAILBOX.test(text) || hasControl(text)) return false;
  const at = text.indexOf("@");
  if (at < 1 || at !== text.lastIndexOf("@")) return false;
  const labels = text.slice(at + 1).split(".");
  return labels.length >= 2 && labels.every((label) => label !== "");
};

export function StringDisplay({
  value,
  field,
}: DisplayRendererProps): ReactElement {
  if (isEmpty(value)) return <Empty />;
  const text = asText(value);
  if (field.format === "email" && isMailbox(text)) {
    return <Link href={`mailto:${text}`}>{text}</Link>;
  }
  if (field.format === "uri" && /^https?:\/\//i.test(text)) {
    return (
      <Link href={text} target="_blank" rel="noreferrer noopener">
        {text}
      </Link>
    );
  }
  return (
    <Typography component="span" variant="body2">
      {text}
    </Typography>
  );
}

export function NumberDisplay({
  value,
  field,
}: DisplayRendererProps): ReactElement {
  const { locale } = useFormat();
  if (typeof value !== "number") return <Empty />;
  const text = new Intl.NumberFormat(locale, {
    maximumFractionDigits: field.kind === "integer" ? 0 : 20,
  }).format(value);
  return (
    <Typography component="span" variant="body2">
      {text}
    </Typography>
  );
}

export function BooleanDisplay({
  value,
  size,
}: DisplayRendererProps): ReactElement {
  if (typeof value !== "boolean") return <Empty />;
  return (
    <Chip
      size={size ?? "small"}
      variant="outlined"
      color={value ? "primary" : "default"}
      label={value ? "Yes" : "No"}
    />
  );
}

export function DateDisplay({ value }: DisplayRendererProps): ReactElement {
  const { locale } = useFormat();
  const date = parseInstant(value);
  if (date === null) return <Empty />;
  // A date has no zone: format it in UTC so it never shifts a day.
  const text = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
  return (
    <Typography component="span" variant="body2">
      {text}
    </Typography>
  );
}

export function DatetimeDisplay({ value }: DisplayRendererProps): ReactElement {
  const { locale, timeZone } = useFormat();
  const date = parseInstant(value);
  if (date === null) return <Empty />;
  const text = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
  return (
    <Typography component="time" variant="body2" dateTime={date.toISOString()}>
      {text}
    </Typography>
  );
}

export function EnumDisplay({
  value,
  size,
}: DisplayRendererProps): ReactElement {
  if (isEmpty(value)) return <Empty />;
  return (
    <Chip
      size={size ?? "small"}
      variant="outlined"
      label={humanize(asText(value))}
    />
  );
}

export function ArrayDisplay({
  value,
  size,
}: DisplayRendererProps): ReactElement {
  if (!Array.isArray(value) || value.length === 0) return <Empty />;
  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
      {value.map((item, index) => (
        <Chip
          key={index}
          size={size ?? "small"}
          variant="outlined"
          label={asText(item)}
        />
      ))}
    </Stack>
  );
}

export function JsonDisplay({ value }: DisplayRendererProps): ReactElement {
  if (value === null || value === undefined) return <Empty />;
  return (
    <Typography
      component="code"
      variant="body2"
      sx={{ fontFamily: "monospace" }}
    >
      {JSON.stringify(value)}
    </Typography>
  );
}
