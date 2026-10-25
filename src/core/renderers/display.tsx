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

export function StringDisplay({
  value,
  field,
}: DisplayRendererProps): ReactElement {
  if (isEmpty(value)) return <Empty />;
  const text = asText(value);
  if (field.format === "email") {
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
