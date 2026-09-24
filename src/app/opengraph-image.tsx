import { ImageResponse } from "next/og";

// Social share card for the landing page, generated at build time.
export const alt = "ScopeVanta — Build clearer scopes and more profitable agreements";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#0E1312",
          color: "#E4EAE6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 10,
              background: "#4e8770",
              color: "#002116",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            SV
          </div>
          <div style={{ fontSize: 40 }}>ScopeVanta</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 72, lineHeight: 1.1 }}>Build clearer scopes and</div>
          <div style={{ fontSize: 72, lineHeight: 1.1, color: "#5FA489", fontStyle: "italic" }}>
            more profitable agreements.
          </div>
        </div>
        <div style={{ fontSize: 28, color: "#8A9E96" }}>Scoping, pricing &amp; proposal approval for service businesses</div>
      </div>
    ),
    size
  );
}
