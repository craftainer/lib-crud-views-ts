import type { ReactElement, ReactNode } from "react";
import type { ReadyResource } from "../core/index.ts";
import { parsePrediction, type Bucket, type PredictionData } from "./model.ts";
import { CapabilityGate, QueryBoundary, type ViewProps } from "./shared.tsx";

/** What `/predict` is asked: a numeric field (default the record count), how many buckets ahead, and the bucket size. */
export interface PredictionQuery {
  /** A numeric field to forecast the per-bucket sum of; omit to forecast the record count. */
  readonly field?: string | undefined;
  /** Buckets to project, 1 to 52. Default 4. */
  readonly periods?: number | undefined;
  /** Default `"day"`. */
  readonly bucket?: Bucket | undefined;
}

export type PredictionProps = ViewProps & PredictionQuery;

const DEFAULT_PERIODS = 4;

/** The `/predict` request for a view's props. */
export function predictionRequest(query: PredictionQuery): {
  field?: string;
  periods: number;
  bucket: Bucket;
} {
  return {
    ...(query.field === undefined ? {} : { field: query.field }),
    periods: query.periods ?? DEFAULT_PERIODS,
    bucket: query.bucket ?? "day",
  };
}

function Loaded({
  ready,
  query,
  children,
}: {
  readonly ready: ReadyResource;
  readonly query: PredictionQuery;
  readonly children: (
    prediction: PredictionData,
    ready: ReadyResource,
  ) => ReactNode;
}): ReactElement {
  const result = ready.hooks.usePredict(predictionRequest(query));
  return (
    <QueryBoundary query={result} label="forecast">
      {(body) => children(parsePrediction(body), ready)}
    </QueryBoundary>
  );
}

/**
 * The gate of every prediction variant: hidden without the `predict`
 * capability; otherwise `children` gets the parsed forecast. A resource with
 * too little history answers 422 and the server's message shows as a warning.
 */
export function PredictionBoundary({
  resource,
  apiVersion,
  query,
  children,
}: {
  readonly resource: string;
  readonly apiVersion: string | undefined;
  readonly query: PredictionQuery;
  readonly children: (
    prediction: PredictionData,
    ready: ReadyResource,
  ) => ReactNode;
}): ReactElement {
  return (
    <CapabilityGate
      resource={resource}
      apiVersion={apiVersion}
      capability="predict"
    >
      {(ready) => (
        <Loaded ready={ready} query={query}>
          {children}
        </Loaded>
      )}
    </CapabilityGate>
  );
}
