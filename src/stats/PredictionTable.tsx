import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { ReactElement } from "react";
import { humanize, useCrud } from "../core/index.ts";
import { formatBucket, rounded } from "./model.ts";
import { PredictionBoundary, type PredictionProps } from "./predictShared.tsx";
import { Aggregate } from "./shared.tsx";

/**
 * Predictions variant 2: the last known value and every forecast bucket as a
 * table, values shown by the field's renderer. Hidden without the `predict`
 * capability.
 */
export function PredictionTable(props: PredictionProps): ReactElement {
  const { locale } = useCrud();
  return (
    <PredictionBoundary
      resource={props.resource}
      apiVersion={props.apiVersion}
      query={props}
    >
      {(prediction, ready) => {
        const name = prediction.field ?? "count";
        const rows = [
          ...(prediction.lastKnown === null
            ? []
            : [{ kind: "Last known", point: prediction.lastKnown }]),
          ...prediction.predictions.map((point) => ({
            kind: "Forecast",
            point,
          })),
        ];
        return (
          <TableContainer component="section" aria-label="Forecast table">
            <Table
              size="small"
              aria-label={`Forecast of ${prediction.field === null ? "records" : humanize(prediction.field).toLowerCase()} per ${prediction.bucket}`}
            >
              <TableHead>
                <TableRow>
                  <TableCell>{`${humanize(prediction.bucket)} starting (UTC)`}</TableCell>
                  <TableCell>{"Kind"}</TableCell>
                  <TableCell align="right">
                    {prediction.field === null
                      ? "Records"
                      : humanize(prediction.field)}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ kind, point }) => (
                  <TableRow key={`${kind}:${point.at.toISOString()}`}>
                    <TableCell component="th" scope="row">
                      {formatBucket(point.at, prediction.bucket, locale)}
                    </TableCell>
                    <TableCell>{kind}</TableCell>
                    <TableCell align="right">
                      <Aggregate
                        ready={ready}
                        name={name}
                        value={rounded(point.value)}
                        renderers={props.renderers}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        );
      }}
    </PredictionBoundary>
  );
}
