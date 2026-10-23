import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useState, type ReactElement } from "react";
import type { Bucket } from "./model.ts";
import { PredictionChart } from "./PredictionChart.tsx";
import { PredictionKpi } from "./PredictionKpi.tsx";
import { PredictionTable } from "./PredictionTable.tsx";
import { CapabilityGate, type ViewProps } from "./shared.tsx";
import { BucketPicker } from "./StatsTimeSeries.tsx";
import { Section } from "./StatsDashboard.tsx";

const COUNT = "";

/** The server accepts 1 to 52 buckets ahead. */
const isPeriods = (n: number): boolean =>
  Number.isInteger(n) && n >= 1 && n <= 52;

/** All three prediction variants with the controls that drive them (field, buckets ahead, bucket size). Hidden without the `predict` capability. */
export function PredictionsDashboard(props: ViewProps): ReactElement {
  const [field, setField] = useState(COUNT);
  const [periods, setPeriods] = useState(4);
  const [periodsText, setPeriodsText] = useState("4");
  const periodsValid = isPeriods(Number(periodsText));
  const [bucket, setBucket] = useState<Bucket>("day");
  const query = { field: field === COUNT ? undefined : field, periods, bucket };
  return (
    <CapabilityGate
      resource={props.resource}
      apiVersion={props.apiVersion}
      capability="predict"
    >
      {(ready) => (
        <Box sx={{ display: "grid", gap: 3 }}>
          <Box
            component="form"
            aria-label="Forecast settings"
            onSubmit={(event) => event.preventDefault()}
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              alignItems: "center",
            }}
          >
            <TextField
              select
              size="small"
              label="Forecast"
              value={field}
              sx={{ minWidth: "12rem" }}
              onChange={(event) => setField(event.target.value)}
            >
              <MenuItem value={COUNT}>{"Record count"}</MenuItem>
              {ready.fields
                .filter((f) => f.numeric && f.name !== ready.resource.id_field)
                .map((f) => (
                  <MenuItem key={f.name} value={f.name}>
                    {`Sum of ${f.label.toLowerCase()}`}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              size="small"
              type="number"
              label="Buckets ahead"
              value={periodsText}
              error={!periodsValid}
              helperText={periodsValid ? undefined : "1 to 52"}
              slotProps={{ htmlInput: { min: 1, max: 52 } }}
              sx={{ width: "9rem" }}
              onChange={(event) => {
                setPeriodsText(event.target.value);
                const next = Number(event.target.value);
                if (isPeriods(next)) setPeriods(next);
              }}
            />
            <BucketPicker value={bucket} onChange={setBucket} />
          </Box>
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
            }}
          >
            <Section title="Forecast">
              <PredictionChart {...props} {...query} />
            </Section>
            <Box sx={{ display: "grid", gap: 3, alignContent: "start" }}>
              <PredictionKpi {...props} {...query} />
              <PredictionTable {...props} {...query} />
            </Box>
          </Box>
        </Box>
      )}
    </CapabilityGate>
  );
}
