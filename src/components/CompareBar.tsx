import type { CountryRecord } from "../types";
import { Icon } from "../ui/Icon";
import { regionFlagTone } from "../ui/tokens";

export function CompareBar({ pinned, onOpen, onClear }: {
  pinned: CountryRecord[];
  onOpen: () => void;
  onClear: () => void;
}) {
  if (!pinned.length) return null;
  return (
    <div className="fadein" style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(19,24,21,.95)", border: "1px solid var(--border-2)", borderRadius: 11, padding: "9px 9px 9px 15px", boxShadow: "var(--shadow)", backdropFilter: "blur(6px)" }}>
      <Icon name="compare" size={16} style={{ color: "var(--accent)" }} />
      <div style={{ display: "flex", gap: 7 }}>
        {pinned.map((c) => (
          <span key={c.match} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 9px" }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: regionFlagTone(c.region) }} />{c.name}
          </span>
        ))}
      </div>
      <button onClick={onOpen} disabled={pinned.length < 2} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "none", background: pinned.length < 2 ? "var(--elev)" : "var(--accent)", color: pinned.length < 2 ? "var(--text-3)" : "#08120c", fontSize: 12.5, fontWeight: 600 }}>Compare</button>
      <button aria-label="Clear comparison" onClick={onClear} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-3)", display: "grid", placeItems: "center" }}><Icon name="close" size={14} /></button>
    </div>
  );
}
