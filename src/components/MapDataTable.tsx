/* ESGMap — screen-reader data-table fallback for the choropleth.
 * The SVG map is decorative to assistive tech; this off-screen table exposes the
 * same data so non-visual users can read every country's current-layer value.
 * (Interactive selection remains available via the keyboard-accessible search.) */
import * as ESG from "../data/esg";
import type { MetricKey } from "../types";

export function MapDataTable({ metric, year }: { metric: MetricKey; year: number }) {
  const M = ESG.METRICS[metric];
  const rows = ESG.all
    .map((c) => ({ c, v: ESG.valueAt(c, metric, year) }))
    .sort((a, b) => a.c.name.localeCompare(b.c.name));
  return (
    <div className="sr-only">
      <table>
        <caption>
          ESGMap data table — {M.label} ({M.unit}){M.hasHistory ? `, year ${year}` : ""}. {rows.length} territories.
          Observation vintage is included for each value; carried-forward values are labelled. Use the search box to open any country's full profile.
        </caption>
        <thead>
          <tr><th scope="col">Country</th><th scope="col">Region</th><th scope="col">{M.label} ({M.unit})</th></tr>
        </thead>
        <tbody>
          {rows.map(({ c, v }) => (
            <tr key={c.iso3}>
              <th scope="row">{c.name}</th>
              <td>{c.region}</td>
              <td>{v == null ? "no data" : `${M.fmt(v)} (${ESG.vintageAt(c, metric, year) ?? "vintage unavailable"})`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
