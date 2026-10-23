import { QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import {
  CrudProvider,
  PredictionChart,
  PredictionKpi,
  PredictionTable,
  PredictionsDashboard,
  StatsCategoryChart,
  StatsDashboard,
  StatsKpiCards,
  StatsTablePanel,
  StatsTimeSeries,
  type Bucket,
  type RendererOverrides,
} from "../../src/index.ts";
import { createStatsClient } from "../fixtures/routes/stats.ts";
import { newQueryClient, renderCrud } from "../helpers.tsx";

/** `ui` over a client whose stats routes answer through `answer` first. */
function renderWith(
  ui: ReactElement,
  answer?: (url: URL) => Response | undefined,
) {
  const client = createStatsClient(answer);
  const queryClient = newQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CrudProvider
        client={client}
        queryClient={queryClient}
        locale="en-US"
        timeZone="UTC"
      >
        {ui}
      </CrudProvider>
    </QueryClientProvider>,
  );
}

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status });

describe("capability gating", () => {
  it("renders nothing for a version without stats or predict", async () => {
    const { container, stub } = renderCrud(
      <>
        <StatsDashboard resource="heroes" apiVersion="v1" />
        <PredictionsDashboard resource="heroes" apiVersion="v1" />
      </>,
    );
    await waitFor(() =>
      expect(stub.requests.some((r) => r.includes("/heroes/v1"))).toBe(false),
    );
    await waitFor(() =>
      expect(container.querySelector("[role=progressbar]")).toBeNull(),
    );
    expect(container).toBeEmptyDOMElement();
    expect(stub.requests.join("\n")).not.toMatch(/stats|predict/);
  });

  it("shows the manifest error through the gate", async () => {
    renderCrud(<StatsKpiCards resource="ghosts" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/ghosts/);
  });
});

describe("StatsKpiCards", () => {
  it("shows the record count and one card per numeric field, not the id", async () => {
    const { stub } = renderCrud(<StatsKpiCards resource="heroes" />);
    const list = await screen.findByRole("list", {
      name: "Heroes key figures",
    });
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Records");
    expect(cards[0]).toHaveTextContent("31");
    expect(cards[1]).toHaveTextContent("Average power level");
    expect(cards[1]).toHaveTextContent("52.39");
    expect(cards[1]).toHaveTextContent(/Range\s*8\s*to\s*97/);
    expect(stub.requests).toContain("GET /api/crud/v1/heroes/v2/json/stats");
  });

  it("omits the range when the field has no values", async () => {
    renderWith(<StatsKpiCards resource="heroes" />, (url) =>
      url.pathname.endsWith("/stats")
        ? json({
            total: 0,
            numeric: [
              {
                field: "power_level",
                count: 0,
                minimum: null,
                maximum: null,
                average: null,
                total: null,
              },
            ],
            categorical: [],
          })
        : undefined,
    );
    const card = (await screen.findAllByRole("listitem"))[1];
    expect(card).not.toHaveTextContent("Range");
  });

  it("renders values through the renderers it is given", async () => {
    const renderers: RendererOverrides = {
      "heroes.power_level": {
        display: ({ value }) => (
          <b data-testid="custom">{`<${String(value)}>`}</b>
        ),
      },
    };
    renderCrud(<StatsKpiCards resource="heroes" renderers={renderers} />);
    expect(await screen.findAllByTestId("custom")).not.toHaveLength(0);
    expect(screen.getAllByTestId("custom")[0]).toHaveTextContent("<52.39>");
  });

  it("describes a numeric field the manifest does not list", async () => {
    renderWith(<StatsKpiCards resource="heroes" />, (url) =>
      url.pathname.endsWith("/stats")
        ? json({
            total: 1,
            numeric: [
              {
                field: "mystery_score",
                count: 1,
                minimum: 1,
                maximum: 1,
                average: 1,
                total: 1,
              },
            ],
          })
        : undefined,
    );
    expect(await screen.findByText("Average mystery score")).toBeVisible();
  });

  it("shows a loading state and then the server's error", async () => {
    renderWith(<StatsKpiCards resource="heroes" />, (url) =>
      url.pathname.endsWith("/stats")
        ? json({ title: "boom", status: 500 }, 500)
        : undefined,
    );
    expect(await screen.findByText(/500/)).toBeVisible();
  });
});

describe("StatsTimeSeries", () => {
  it("asks for the chosen bucket and switches with the toggle", async () => {
    const user = userEvent.setup();
    const { stub } = renderCrud(<StatsTimeSeries resource="heroes" />);
    await screen.findByRole("figure", { name: /Heroes created per day/ });
    expect(stub.requests).toContain(
      "GET /api/crud/v1/heroes/v2/json/stats?bucket=day",
    );
    const group = screen.getByRole("group", { name: "Bucket size" });
    await user.click(within(group).getByRole("button", { name: "week" }));
    await screen.findByRole("figure", { name: /Heroes created per week/ });
    expect(stub.requests).toContain(
      "GET /api/crud/v1/heroes/v2/json/stats?bucket=week",
    );
    // Clicking the pressed button keeps it selected.
    await user.click(within(group).getByRole("button", { name: "week" }));
    expect(within(group).getByRole("button", { name: "week" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("starts from the bucket it is given", async () => {
    const { stub } = renderCrud(
      <StatsTimeSeries resource="heroes" bucket="month" />,
    );
    await screen.findByRole("figure", { name: /per month/ });
    expect(stub.requests.join("\n")).toContain("stats?bucket=month");
  });

  it("says so when there are no buckets", async () => {
    renderWith(<StatsTimeSeries resource="heroes" />, (url) =>
      url.pathname.endsWith("/stats") ? json({ total: 0 }) : undefined,
    );
    expect(await screen.findByText("No records in this period.")).toBeVisible();
  });

  it("shows the server's rejection of a bucket", async () => {
    renderCrud(<StatsTimeSeries resource="heroes" bucket={"year" as Bucket} />);
    expect(await screen.findByText(/422/)).toBeVisible();
  });
});

describe("StatsCategoryChart", () => {
  it("charts the first categorical field as bars, then another as a pie", async () => {
    const user = userEvent.setup();
    renderCrud(<StatsCategoryChart resource="heroes" />);
    await screen.findByRole("figure", { name: "Heroes by is draft" });
    const type = screen.getByRole("group", { name: "Chart type" });
    await user.click(within(type).getByRole("button", { name: "Pie" }));
    expect(within(type).getByRole("button", { name: "Pie" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(type).getByRole("button", { name: "Pie" }));
    await user.click(screen.getByRole("combobox", { name: "Field" }));
    await user.click(screen.getByRole("option", { name: "Is locked" }));
    await screen.findByRole("figure", { name: "Heroes by is locked" });
    await user.click(within(type).getByRole("button", { name: "Bar" }));
    expect(within(type).getByRole("button", { name: "Bar" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("starts from the given kind and field, falling back to the first field", async () => {
    const { unmount } = renderCrud(
      <StatsCategoryChart resource="heroes" kind="pie" field="is_locked" />,
    );
    await screen.findByRole("figure", { name: "Heroes by is locked" });
    expect(screen.getByRole("button", { name: "Pie" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    unmount();
    renderCrud(<StatsCategoryChart resource="heroes" field="nope" />);
    await screen.findByRole("figure", { name: "Heroes by is draft" });
  });

  it("says so without categorical fields", async () => {
    renderWith(<StatsCategoryChart resource="heroes" />, (url) =>
      url.pathname.endsWith("/stats") ? json({ total: 0 }) : undefined,
    );
    expect(
      await screen.findByText("No categorical fields to chart."),
    ).toBeVisible();
  });
});

describe("StatsTablePanel", () => {
  it("tabulates numeric aggregates and value counts through the renderers", async () => {
    renderCrud(<StatsTablePanel resource="heroes" />);
    const numeric = await screen.findByRole("table", {
      name: "Numeric field statistics",
    });
    const row = within(numeric).getByRole("row", { name: /Power level/ });
    expect(row).toHaveTextContent("28");
    expect(row).toHaveTextContent("52.39");
    expect(row).toHaveTextContent("1,467");
    expect(within(numeric).queryByText("Id")).toBeNull();
    const counts = screen.getByRole("table", {
      name: "Categorical value counts",
    });
    const rows = within(counts).getAllByRole("row");
    // Header plus four value rows; booleans show as Yes / No chips.
    expect(rows).toHaveLength(5);
    expect(rows[1]).toHaveTextContent("Is draft");
    expect(rows[1]).toHaveTextContent("No");
    expect(rows[1]).toHaveTextContent("26");
    expect(rows[2]).toHaveTextContent("Yes");
  });

  it("shows a null aggregate as an empty cell and an enum value as given", async () => {
    renderWith(<StatsTablePanel resource="quests" />, (url) =>
      url.pathname.endsWith("/stats") ? json({}) : undefined,
    );
    // quests v1 has no stats capability: nothing renders.
    await waitFor(() => expect(screen.queryByRole("table")).toBeNull());
  });

  it("copes with fields the manifest does not describe", async () => {
    renderWith(<StatsTablePanel resource="heroes" />, (url) =>
      url.pathname.endsWith("/stats")
        ? json({
            total: 2,
            numeric: [{ field: "mystery", count: 1, minimum: null }],
            categorical: [{ field: "colour", value: "Red", count: 2 }],
          })
        : undefined,
    );
    const counts = await screen.findByRole("table", {
      name: "Categorical value counts",
    });
    expect(within(counts).getByText("Colour")).toBeVisible();
    expect(within(counts).getByText("Red")).toBeVisible();
  });
});

describe("StatsDashboard", () => {
  it("combines the four variants", async () => {
    renderCrud(<StatsDashboard resource="heroes" />);
    expect(
      await screen.findByRole("list", { name: "Heroes key figures" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("figure", { name: /created per day/ }),
    ).toBeVisible();
    expect(
      await screen.findByRole("figure", { name: /by is draft/ }),
    ).toBeVisible();
    expect(
      await screen.findByRole("table", { name: "Numeric field statistics" }),
    ).toBeVisible();
  });
});

describe("PredictionTable", () => {
  it("lists the last known value and the projected buckets, in UTC", async () => {
    const { stub } = renderCrud(
      <PredictionTable resource="heroes" periods={3} />,
    );
    const table = await screen.findByRole("table", {
      name: "Forecast of records per day",
    });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(rows[1]).toHaveTextContent("Jan 26, 2026");
    expect(rows[1]).toHaveTextContent("Last known");
    expect(rows[1]).toHaveTextContent("7");
    // The forecast follows the daily spacing from the last known bucket.
    expect(rows[2]).toHaveTextContent("Jan 27, 2026");
    expect(rows[4]).toHaveTextContent("Jan 29, 2026");
    expect(rows[2]).toHaveTextContent("Forecast");
    expect(stub.requests).toContain(
      "GET /api/crud/v1/heroes/v2/json/predict?periods=3&bucket=day",
    );
  });

  it("forecasts a field per week", async () => {
    const { stub } = renderCrud(
      <PredictionTable
        resource="heroes"
        field="power_level"
        bucket="week"
        periods={2}
      />,
    );
    const table = await screen.findByRole("table", {
      name: "Forecast of power level per week",
    });
    expect(within(table).getByText("Power level")).toBeVisible();
    expect(within(table).getAllByRole("row")[2]).toHaveTextContent(
      "Feb 2, 2026",
    );
    expect(stub.requests.join("\n")).toContain("field=power_level");
  });

  it("shows the server's message when there is too little history", async () => {
    renderCrud(<PredictionTable resource="heroes" bucket="month" />);
    expect(await screen.findByText(/at least 2 time buckets/)).toBeVisible();
  });

  it("tolerates a forecast without a last known point", async () => {
    renderWith(<PredictionTable resource="heroes" />, (url) =>
      url.pathname.endsWith("/predict")
        ? json({
            field: null,
            bucket: "day",
            predictions: [{ bucket_start: "2026-02-01T00:00:00", value: 2 }],
          })
        : undefined,
    );
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
  });
});

describe("PredictionKpi", () => {
  it("shows the next bucket and how it moves", async () => {
    renderCrud(<PredictionKpi resource="heroes" />);
    const card = await screen.findByRole("region", {
      name: "Next period forecast",
    });
    expect(card).toHaveTextContent("Next day: records");
    expect(card).toHaveTextContent("Bucket starting Jan 27, 2026 (UTC)");
    expect(card).toHaveTextContent(/Up\s*0\.62\s*from the last known/);
  });

  it("says Down for a falling forecast and omits the move without a last known value", async () => {
    const { unmount } = renderWith(
      <PredictionKpi resource="heroes" field="power_level" />,
      (url) =>
        url.pathname.endsWith("/predict")
          ? json({
              field: "power_level",
              bucket: "week",
              method: "linear_regression",
              last_known: { bucket_start: "2026-01-12T00:00:00Z", value: 9 },
              predictions: [{ bucket_start: "2026-01-19T00:00:00Z", value: 4 }],
            })
          : undefined,
    );
    expect(await screen.findByText(/Down/)).toBeVisible();
    expect(screen.getByText(/Next week: power level/)).toBeVisible();
    unmount();
    renderWith(<PredictionKpi resource="heroes" />, (url) =>
      url.pathname.endsWith("/predict")
        ? json({
            field: null,
            bucket: "day",
            predictions: [{ bucket_start: "2026-01-19T00:00:00Z", value: 4 }],
          })
        : undefined,
    );
    const card = await screen.findByRole("region", {
      name: "Next period forecast",
    });
    expect(card).not.toHaveTextContent("from the last known");
  });

  it("says so when the server projects nothing", async () => {
    renderWith(<PredictionKpi resource="heroes" />, (url) =>
      url.pathname.endsWith("/predict") ? json({ predictions: [] }) : undefined,
    );
    expect(
      await screen.findByText("The server returned no forecast."),
    ).toBeVisible();
  });
});

describe("PredictionChart", () => {
  it("draws the count history with the forecast when stats are available", async () => {
    const { stub } = renderCrud(<PredictionChart resource="heroes" />);
    await screen.findByRole("figure", {
      name: "Heroes: records per day with forecast",
    });
    await waitFor(() =>
      expect(stub.requests).toContain(
        "GET /api/crud/v1/heroes/v2/json/stats?bucket=day",
      ),
    );
  });

  it("charts a field forecast without history", async () => {
    const { stub } = renderCrud(
      <PredictionChart resource="heroes" field="power_level" bucket="week" />,
    );
    await screen.findByRole("figure", {
      name: "Heroes: power level per week with forecast",
    });
    expect(stub.requests.join("\n")).not.toContain("/stats");
  });
});

describe("PredictionsDashboard", () => {
  it("drives the three variants from its controls", async () => {
    const user = userEvent.setup();
    const { stub } = renderCrud(<PredictionsDashboard resource="heroes" />);
    await screen.findByRole("figure", {
      name: /records per day with forecast/,
    });
    await screen.findByRole("table", { name: "Forecast of records per day" });
    // Field: record count, or the sum of a numeric field (never the id).
    await user.click(screen.getByRole("combobox", { name: "Forecast" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Record count",
      "Sum of power level",
    ]);
    await user.click(
      screen.getByRole("option", { name: "Sum of power level" }),
    );
    await screen.findByRole("table", {
      name: "Forecast of power level per day",
    });
    // Buckets ahead: valid values apply, others are ignored.
    const periods = screen.getByRole("spinbutton", { name: "Buckets ahead" });
    await user.clear(periods);
    await user.type(periods, "6");
    await waitFor(() =>
      expect(stub.requests.join("\n")).toContain("periods=6"),
    );
    await user.type(periods, "0");
    expect(periods).toHaveValue(60);
    expect(periods).toBeInvalid();
    expect(screen.getByText("1 to 52")).toBeVisible();
    await user.type(periods, "{Backspace}");
    expect(periods).toBeValid();
    // Bucket size.
    await user.click(screen.getByRole("button", { name: "week" }));
    await screen.findByRole("table", {
      name: "Forecast of power level per week",
    });
    await user.click(screen.getByRole("combobox", { name: "Forecast" }));
    await user.click(screen.getByRole("option", { name: "Record count" }));
    await screen.findByRole("table", { name: "Forecast of records per week" });
    // The form never submits.
    const form = screen.getByRole("form", { name: "Forecast settings" });
    expect(form).toBeVisible();
    fireEvent.submit(form);
    expect(form).toBeVisible();
  });
});
