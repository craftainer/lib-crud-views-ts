# src/stats/

Statistics and predictions views over the server's `/stats` and `/predict`
routes, drawn with MUI X Charts (MIT tier: `LineChart`, `BarChart`,
`PieChart`). Every view takes `resource` (a manifest name), an optional
`apiVersion` and an optional `renderers` override, loads the resource through
`ResourceGate`, and renders **nothing** unless `ready.capabilities.stats`
(statistics) or `.predict` (predictions) is true.

- Statistics: `StatsKpiCards`, `StatsTimeSeries` (day/week/month toggle),
  `StatsCategoryChart` (bar or pie, field picker), `StatsTablePanel`, and
  `StatsDashboard` composing the four.
- Predictions: `PredictionChart` (known series plus dashed forecast),
  `PredictionTable`, `PredictionKpi` (next bucket and its move from the last
  known value), and `PredictionsDashboard` with the field, buckets-ahead and
  bucket controls. `PredictionQuery` is `{ field?, periods?, bucket? }`.
- `model.ts` parses the two bodies defensively; `shared.tsx` has the gate, the
  query states, theme colors and the UTC time axis.

## Notes

- Buckets are UTC calendar buckets: axes and tables are labelled UTC and
  parsed as UTC (a zoneless server timestamp is read as UTC). The x axis is a
  `utc` time scale, so a missing bucket is a visible gap, not squeezed out.
- The server regresses on whole buckets since the first bucket, so a forecast
  follows bucket spacing. The chart draws history only for the record-count
  forecast (from `/stats`'s `time_series`); `/predict` returns only the last
  known point.
- The `id` column's aggregates are hidden. Averages and forecasts of integer
  fields display as `number` (two decimals).
- Charts take their accessible name from a wrapping `figure`: the charts'
  own `title` prop puts `aria-label` on a role-less element (axe rejects it).
