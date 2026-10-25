import Box from "@mui/material/Box";
import { LineChart } from "@mui/x-charts/LineChart";
import type { ReactElement, ReactNode } from "react";
import { humanize, useCrud, type ReadyResource } from "../core/index.ts";
import {
  forecastSeries,
  parseStats,
  type PredictionData,
  type SeriesPoint,
} from "./model.ts";
import {
  PredictionBoundary,
  predictionRequest,
  type PredictionProps,
} from "./predictShared.tsx";
import { ChartFigure, timeAxis, useChartColors } from "./shared.tsx";

function Plot({
  ready,
  prediction,
  history,
}: {
  readonly ready: ReadyResource;
  readonly prediction: PredictionData;
  readonly history: readonly SeriesPoint[];
}): ReactElement {
  const { locale } = useCrud();
  const [knownColor, forecastColor] = useChartColors();
  const series = forecastSeries(history, prediction);
  const what =
    prediction.field === null ? "Records" : humanize(prediction.field);
  return (
    <ChartFigure
      title={`${ready.resource.title}: ${what.toLowerCase()} per ${prediction.bucket} with forecast`}
      caption={`Dashed: ${prediction.predictions.length} ${prediction.bucket} buckets forecast by ${prediction.method.replaceAll("_", " ")} over the bucket sequence; buckets are UTC.`}
    >
      <LineChart
        height={300}
        skipAnimation
        xAxis={[timeAxis(series.at, prediction.bucket, locale)]}
        yAxis={[{ label: what }]}
        series={[
          {
            id: "known",
            label: "Known",
            data: [...series.known],
            color: knownColor,
            showMark: true,
            curve: "linear",
            connectNulls: true,
          },
          {
            id: "forecast",
            label: "Forecast",
            data: [...series.forecast],
            color: forecastColor,
            showMark: true,
            curve: "linear",
          },
        ]}
        sx={{ '& [data-series="forecast"]': { strokeDasharray: "6 4" } }}
      />
    </ChartFigure>
  );
}

/** Loads the count history when the forecast is of the record count and the server serves `stats`. */
function WithHistory({
  ready,
  bucket,
  children,
}: {
  readonly ready: ReadyResource;
  readonly bucket: "day" | "week" | "month";
  readonly children: (history: readonly SeriesPoint[]) => ReactNode;
}): ReactElement {
  const query = ready.hooks.useStats({ bucket });
  return (
    <>
      {children(
        query.data === undefined ? [] : parseStats(query.data).timeSeries,
      )}
    </>
  );
}

/**
 * Predictions variant 1: a line chart of the known series and the forecast
 * after it. The history is the server's count series, so it is drawn only
 * when the forecast is of the record count (no `field`) and `stats` is
 * available; a field forecast shows its last known value and the projection.
 * Hidden without the `predict` capability.
 */
export function PredictionChart(props: PredictionProps): ReactElement {
  const { resource, apiVersion } = props;
  const { bucket } = predictionRequest(props);
  return (
    <PredictionBoundary
      resource={resource}
      apiVersion={apiVersion}
      query={props}
    >
      {(prediction, ready) => (
        <Box component="section" aria-label="Forecast chart">
          {prediction.field === null && ready.capabilities.stats ? (
            <WithHistory ready={ready} bucket={bucket}>
              {(history) => (
                <Plot ready={ready} prediction={prediction} history={history} />
              )}
            </WithHistory>
          ) : (
            <Plot ready={ready} prediction={prediction} history={[]} />
          )}
        </Box>
      )}
    </PredictionBoundary>
  );
}
