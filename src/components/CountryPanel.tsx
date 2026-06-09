/* ESGMap — country detail panel + disclosure rows. */
import { useEffect, useState, type ReactNode } from "react";
import * as ESG from "../data/esg";
import type { CountryRecord, DisclosureStatus, MetricKey } from "../types";
import type { Scales } from "../data/esg";
import { Icon } from "../ui/Icon";
import { ScoreRing } from "../ui/ScoreRing";
import { MixBar } from "../ui/MixBar";
import { LineChart } from "../ui/LineChart";
import { Segmented } from "../ui/Segmented";
import { StatusDot } from "../ui/StatusDot";
import { statusStyle, regionFlagTone } from "../ui/tokens";

function StatTile({ label, value, unit, color, sub }: {
  label: string; value: ReactNode; unit?: string; color?: string; sub?: string;
}) {
  return (
    <div style={{ background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 13px" }}>
      <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 7 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span className="mono tnum" style={{ fontSize: 23, fontWeight: 600, color: color || "var(--text)", lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: "var(--text-3)" }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function DisclosureRow({ icon, label, status, detail }: {
  icon: string; label: string; status?: DisclosureStatus | null; detail?: string | null;
}) {
  const s = statusStyle(status);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--text-3)", flex: "0 0 auto" }}>
        <Icon name={icon} size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</div>
        {detail && <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{detail}</div>}
      </div>
      {status && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: "0 0 auto", paddingTop: 1 }}>
          <StatusDot status={status} />
          <span style={{ fontSize: 12, color: s.c, fontWeight: 500 }}>{s.label}</span>
        </div>
      )}
    </div>
  );
}

export function SectionLabel({ icon, text, noMargin }: { icon: string; text: string; noMargin?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: noMargin ? 0 : 12, color: "var(--text-2)" }}>
      <Icon name={icon} size={14} />
      <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".07em" }}>{text}</span>
    </div>
  );
}

export function CountryPanel({ rec, metric, scales, onClose, onPin, isPinned }: {
  rec: CountryRecord;
  metric: MetricKey;
  scales: Scales;
  onClose: () => void;
  onPin: (rec: CountryRecord) => void;
  isPinned: boolean;
}) {
  const [chartMetric, setChartMetric] = useState<"renewable" | "carbon">("renewable");
  useEffect(() => { setChartMetric(metric === "carbon" ? "carbon" : "renewable"); }, [rec, metric]);

  const tone = regionFlagTone(rec.region);
  const renColor = rec.renewable != null ? scales.renewable(rec.renewable) : "var(--text)";
  const carbColor = rec.carbon != null ? scales.carbon(rec.carbon) : "var(--text)";
  const scoreColor = rec.score != null ? scales.score(rec.score) : "var(--text)";
  const isRich = rec.tier === "rich";

  const cm = ESG.METRICS[chartMetric];
  const hist = rec.history;
  const histColor = chartMetric === "renewable" ? renColor : carbColor;
  const arr = hist ? hist[chartMetric] : null;
  const defined = arr ? arr.filter((v): v is number => v != null) : [];
  // trend delta over the last 10 years of available points
  const tenAgoIdx = hist ? Math.max(0, hist.years.length - 11) : 0;
  const lastV = arr ? lastNonNull(arr) : null;
  const baseV = arr ? firstNonNullFrom(arr, tenAgoIdx) : null;
  const delta = lastV != null && baseV != null ? Math.round((lastV - baseV) * 10) / 10 : null;
  const deltaGood = delta == null ? true : chartMetric === "renewable" ? delta >= 0 : delta <= 0;
  const fromYear = hist ? hist.years[tenAgoIdx] : null;
  const toYear = hist ? hist.years[hist.years.length - 1] : null;

  return (
    <div className="slidein" style={{
      position: "absolute", top: 0, right: 0, bottom: 0, width: 392, zIndex: 20,
      background: "var(--panel)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow)",
      display: "flex", flexDirection: "column",
    }}>
      {/* header */}
      <div style={{ position: "relative", padding: "20px 22px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: tone }} />
        <button aria-label={`Close ${rec.name} panel`} onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 30, height: 30, borderRadius: 7, border: "1px solid var(--border)", background: "var(--panel-2)", color: "var(--text-2)", display: "grid", placeItems: "center" }}>
          <Icon name="close" size={15} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: tone }} />
          <span style={{ fontSize: 11.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{rec.region}</span>
          {!isRich && <span style={{ fontSize: 10.5, color: "var(--text-3)", border: "1px solid var(--border)", borderRadius: 5, padding: "1px 6px" }}>limited coverage</span>}
        </div>
        <div style={{ fontSize: 25, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.1 }}>{rec.name}</div>
        {rec.capital && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4 }}>Capital · {rec.capital}</div>}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* live (near-real-time) banner */}
        {rec.live && (
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 22px", background: "rgba(95,191,127,.07)", borderBottom: "1px solid var(--border)" }}>
            <span style={{ position: "relative", width: 8, height: 8, flex: "0 0 auto" }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: 99, background: "var(--accent)" }} />
              <span className="live-pulse" style={{ position: "absolute", inset: 0, borderRadius: 99, background: "var(--accent)" }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".09em", color: "var(--accent)" }}>LIVE</span>
                {rec.live.renewable != null && (
                  <span><span className="mono tnum" style={{ fontSize: 15, fontWeight: 600, color: scales.renewable(rec.live.renewable) }}>{Math.round(rec.live.renewable)}%</span><span style={{ fontSize: 11, color: "var(--text-3)" }}> renewables now</span></span>
                )}
                {rec.live.carbon != null && (
                  <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>· <span className="mono tnum" style={{ color: scales.carbon(rec.live.carbon) }}>{rec.live.carbonEstimated ? "~" : ""}{Math.round(rec.live.carbon)}</span> gCO₂/kWh{rec.live.carbonEstimated ? " est." : ""}</span>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rec.live.source} · {fmtLiveTime(rec.live.at)}</div>
            </div>
          </div>
        )}

        {/* score + headline */}
        <div style={{ padding: "18px 22px", display: "flex", gap: 18, alignItems: "center", borderBottom: "1px solid var(--border)" }}>
          <ScoreRing value={rec.score} color={scoreColor} size={78} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>Sustainability score</div>
            <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 4, lineHeight: 1.45 }}>
              Composite of clean-power share, grid carbon intensity, per-capita emissions & disclosure readiness.
            </div>
          </div>
        </div>

        {/* stat tiles */}
        <div style={{ padding: "16px 22px 6px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatTile label="Renewable power" value={rec.renewable != null ? Math.round(rec.renewable) : "—"} unit="%" color={renColor} sub="of electricity" />
          <StatTile label="Grid carbon" value={rec.carbon != null ? rec.carbon : "—"} unit="g" color={carbColor} sub="CO₂/kWh" />
          <StatTile label="Emissions" value={rec.co2pc != null ? rec.co2pc : "—"} unit={rec.co2pc != null ? "t" : ""} color={rec.co2pc != null ? scales.co2pc(rec.co2pc) : "var(--text)"} sub="CO₂ per capita" />
          <StatTile label="Net-zero target" value={rec.netZero || (isRich ? "—" : "n/a")} color={rec.netZero ? "var(--accent)" : "var(--text-3)"} sub={rec.netZero ? "pledged year" : "no national pledge"} />
        </div>

        {/* environment & energy tiles */}
        <div style={{ padding: "10px 22px 16px" }}>
          <SectionLabel icon="leaf" text="Environment & energy" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <StatTile label="Air quality" value={rec.pm25 != null ? Math.round(rec.pm25) : "—"} unit="µg/m³" color={rec.pm25 != null ? scales.pm25(rec.pm25) : "var(--text)"} sub="PM2.5 annual mean" />
            <StatTile label="Forest cover" value={rec.forest != null ? Math.round(rec.forest) : "—"} unit="%" color={rec.forest != null ? scales.forest(rec.forest) : "var(--text)"} sub="of land area" />
            <StatTile label="Electricity use" value={rec.energy != null ? (rec.energy >= 1000 ? (rec.energy / 1000).toFixed(1) + "k" : rec.energy) : "—"} unit="kWh" color="var(--text)" sub="per capita / yr" />
            <StatTile label="Climate risk" value={rec.climate != null ? Math.round(rec.climate) : "—"} unit="/100" color={rec.climate != null ? scales.climate(rec.climate) : "var(--text)"} sub="exposure & readiness" />
          </div>
          {rec.ev != null && (
            <div style={{ marginTop: 10, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                  <Icon name="bolt" size={13} /> EV adoption
                </span>
                <span><span className="mono tnum" style={{ fontSize: 17, fontWeight: 600, color: renColor }}>{rec.ev}</span><span style={{ fontSize: 11, color: "var(--text-3)" }}>% of new cars</span></span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: "#0c100e", overflow: "hidden", border: "1px solid var(--border)" }}>
                <div style={{ height: "100%", width: Math.min(100, rec.ev) + "%", background: `linear-gradient(90deg, var(--accent-2), ${renColor})` }} />
              </div>
            </div>
          )}
        </div>

        {/* energy mix */}
        {rec.mix && (
          <div style={{ padding: "14px 22px 18px" }}>
            <SectionLabel icon="bolt" text="Electricity mix" />
            <MixBar mix={rec.mix} />
          </div>
        )}

        {/* history chart */}
        {hist && defined.length > 1 && (
          <div style={{ padding: "6px 22px 20px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 12px" }}>
              <SectionLabel icon="rank" text={`History · ${cm.short}`} noMargin />
              <Segmented size="sm" value={chartMetric} onChange={setChartMetric}
                options={[{ value: "renewable", label: "Renewables" }, { value: "carbon", label: "Carbon" }]} />
            </div>
            <LineChart series={[{ years: hist.years, values: hist[chartMetric], color: histColor, label: cm.short }]}
              yMax={chartMetric === "renewable" ? 100 : Math.max(200, Math.ceil(Math.max(...carbonVals(hist.carbon)) / 100) * 100)} />
            {delta != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: "var(--text-3)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: deltaGood ? "var(--accent)" : "var(--bad)" }}>
                  <Icon name={delta >= 0 ? "arrowUp" : "arrowDown"} size={13} />
                  <span className="mono tnum">{delta >= 0 ? "+" : ""}{delta}{cm.unit === "%" ? "pp" : ""}</span>
                </span>
                over {fromYear}–{toYear} · {cm.unit !== "%" ? cm.unit : ""}
              </div>
            )}
          </div>
        )}

        {/* disclosure */}
        <div style={{ padding: "4px 22px 10px", borderTop: "1px solid var(--border)" }}>
          <div style={{ margin: "16px 0 4px" }}><SectionLabel icon="doc" text="Policy & disclosure" noMargin /></div>
          {isRich ? (
            <div>
              <DisclosureRow icon="target" label="Paris Agreement" status={rec.paris} detail={rec.parisYear ? `Ratified ${rec.parisYear}` : (rec.paris === "signed" ? "Signed, not ratified" : "")} />
              <DisclosureRow icon="leaf" label="2030 NDC target" detail={rec.ndc} />
              <DisclosureRow icon="cloud" label="Net-zero pledge" status={rec.netZero ? "ratified" : "none"} detail={rec.netZero ? `Target year ${rec.netZero}` : "No national net-zero date"} />
              <DisclosureRow icon="doc" label="IFRS S1 (sustainability)" status={rec.ifrsS1} detail={rec.esg} />
              <DisclosureRow icon="bolt" label="IFRS S2 (climate)" status={rec.ifrsS2} detail="ISSB-aligned climate disclosure" />
            </div>
          ) : (
            <div style={{ padding: "14px 0 16px", color: "var(--text-3)", fontSize: 12.5, lineHeight: 1.5 }}>
              Detailed policy &amp; disclosure indicators (Paris status, NDC, IFRS S1/S2 adoption) are curated for major
              economies. {rec.name} currently shows headline energy &amp; environment metrics only.
            </div>
          )}
        </div>
      </div>

      {/* footer */}
      <div style={{ padding: "12px 22px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
        <button onClick={() => onPin(rec)} style={{
          flex: 1, height: 40, borderRadius: 9, border: "1px solid " + (isPinned ? "var(--accent-2)" : "var(--border-2)"),
          background: isPinned ? "rgba(95,191,127,.12)" : "var(--panel-2)", color: isPinned ? "var(--accent)" : "var(--text)",
          fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}>
          <Icon name={isPinned ? "check" : "compare"} size={15} />
          {isPinned ? "Added to compare" : "Add to compare"}
        </button>
      </div>
    </div>
  );
}

function lastNonNull(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
}
function firstNonNullFrom(arr: (number | null)[], start: number): number | null {
  for (let i = start; i < arr.length; i++) if (arr[i] != null) return arr[i];
  return lastNonNull(arr);
}
function carbonVals(arr: (number | null)[]): number[] {
  const v = arr.filter((x): x is number => x != null);
  return v.length ? v : [200];
}
function fmtLiveTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `as of ${hh}:${mm} UTC`;
}
