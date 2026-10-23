import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { FieldDisplay, humanize, type ReadyResource } from "../core/index.ts";
import { parseStats, rounded } from "./model.ts";
import {
  Aggregate,
  dataStats,
  CapabilityGate,
  QueryBoundary,
  categoryField,
  categoryValue,
  type ViewProps,
} from "./shared.tsx";

function Panel({
  ready,
  renderers,
}: {
  readonly ready: ReadyResource;
  readonly renderers: ViewProps["renderers"];
}): ReactElement {
  const query = ready.hooks.useStats();
  return (
    <QueryBoundary query={query} label="statistics">
      {(body) => {
        const stats = parseStats(body);
        return (
          <Box sx={{ display: "grid", gap: 3 }}>
            <TableContainer component="section" aria-label="Numeric fields">
              <Typography component="h3" variant="h6" sx={{ mb: 1 }}>
                {"Numeric fields"}
              </Typography>
              <Table size="small" aria-label="Numeric field statistics">
                <TableHead>
                  <TableRow>
                    <TableCell>{"Field"}</TableCell>
                    <TableCell align="right">{"Count"}</TableCell>
                    <TableCell align="right">{"Minimum"}</TableCell>
                    <TableCell align="right">{"Maximum"}</TableCell>
                    <TableCell align="right">{"Average"}</TableCell>
                    <TableCell align="right">{"Total"}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dataStats(ready, stats).map((stat) => (
                    <TableRow key={stat.field}>
                      <TableCell component="th" scope="row">
                        {humanize(stat.field)}
                      </TableCell>
                      <TableCell align="right">{stat.count}</TableCell>
                      {(
                        [
                          stat.minimum,
                          stat.maximum,
                          stat.average,
                          stat.total,
                        ] as const
                      ).map((value, index) => (
                        <TableCell key={index} align="right">
                          <Aggregate
                            ready={ready}
                            name={stat.field}
                            value={rounded(value)}
                            renderers={renderers}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TableContainer component="section" aria-label="Value counts">
              <Typography component="h3" variant="h6" sx={{ mb: 1 }}>
                {"Value counts"}
              </Typography>
              <Table size="small" aria-label="Categorical value counts">
                <TableHead>
                  <TableRow>
                    <TableCell>{"Field"}</TableCell>
                    <TableCell>{"Value"}</TableCell>
                    <TableCell align="right">{"Records"}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.categorical.map((row) => {
                    const field = categoryField(ready, row.field);
                    return (
                      <TableRow key={`${row.field}:${row.value}`}>
                        <TableCell component="th" scope="row">
                          {field.label}
                        </TableCell>
                        <TableCell>
                          <FieldDisplay
                            field={field}
                            resource={ready.resource.name}
                            value={categoryValue(field, row.value)}
                            renderers={renderers}
                          />
                        </TableCell>
                        <TableCell align="right">{row.count}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );
      }}
    </QueryBoundary>
  );
}

/**
 * Variant 4: two tables, the numeric aggregates of every numeric field and
 * the value counts of every categorical field. Values go through the field
 * renderers. Hidden without the `stats` capability.
 */
export function StatsTablePanel({
  resource,
  apiVersion,
  renderers,
}: ViewProps): ReactElement {
  return (
    <CapabilityGate
      resource={resource}
      apiVersion={apiVersion}
      capability="stats"
    >
      {(ready) => <Panel ready={ready} renderers={renderers} />}
    </CapabilityGate>
  );
}
