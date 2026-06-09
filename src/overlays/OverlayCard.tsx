import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";

export function OverlayCard({ title, subtitle, icon, onClose, width, children }: {
  title: string;
  subtitle?: string;
  icon: string;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  return (
    <div className="fadein" onMouseDown={onClose} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(6,9,7,.62)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 30 }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: width || 640, maxWidth: "100%", maxHeight: "86vh", background: "var(--panel)", border: "1px solid var(--border-2)", borderRadius: 14, boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--panel-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--accent)" }}><Icon name={icon} size={17} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: "var(--text-3)" }}>{subtitle}</div>}
          </div>
          <button aria-label={`Close ${title}`} onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel-2)", color: "var(--text-2)", display: "grid", placeItems: "center" }}><Icon name="close" size={16} /></button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
