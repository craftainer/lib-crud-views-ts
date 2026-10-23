import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { humanize, useCrud } from "../core/index.ts";
import { formatBucket, rounded } from "./model.ts";
import { PredictionBoundary, type PredictionProps } from "./predictShared.tsx";
import { Aggregate, kpiValueSx } from "./shared.tsx";

/**
 * Predictions variant 3: a card with the first forecast bucket's value and how
 * it moves from the last known one. Hidden without the `predict` capability.
 */
export function PredictionKpi(props: PredictionProps): ReactElement {
  const { locale } = useCrud();
  return (
    <PredictionBoundary
      resource={props.resource}
      apiVersion={props.apiVersion}
      query={props}
    >
      {(prediction, ready) => {
        const next = prediction.predictions[0];
        const name = prediction.field ?? "count";
        const what =
          prediction.field === null
            ? "records"
            : humanize(prediction.field).toLowerCase();
        if (next === undefined) {
          return (
            <Typography color="text.secondary">
              {"The server returned no forecast."}
            </Typography>
          );
        }
        const delta =
          prediction.lastKnown === null
            ? null
            : rounded(next.value - prediction.lastKnown.value);
        return (
          <Card
            variant="outlined"
            component="section"
            aria-label="Next period forecast"
          >
            <CardContent>
              <Typography
                component="h3"
                variant="overline"
                color="text.secondary"
              >
                {`Next ${prediction.bucket}: ${what}`}
              </Typography>
              <Box sx={kpiValueSx}>
                <Aggregate
                  ready={ready}
                  name={name}
                  value={rounded(next.value)}
                  renderers={props.renderers}
                />
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block" }}
              >
                {`Bucket starting ${formatBucket(next.at, prediction.bucket, locale)} (UTC)`}
              </Typography>
              {delta === null ? null : (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "flex", gap: 0.5, alignItems: "baseline" }}
                >
                  {delta < 0 ? "Down" : "Up"}
                  <Aggregate
                    ready={ready}
                    name={name}
                    value={Math.abs(delta)}
                    renderers={props.renderers}
                  />
                  {"from the last known"}
                </Typography>
              )}
            </CardContent>
          </Card>
        );
      }}
    </PredictionBoundary>
  );
}
