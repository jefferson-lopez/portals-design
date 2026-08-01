import { IconSpiral } from "@tabler/icons-react";

export function OpenGraphCard({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        color: "#09090b",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        height: "100%",
        justifyContent: "space-between",
        padding: "68px 76px",
        width: "100%",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
        <div
          style={{
            alignItems: "center",
            background: "#09090b",
            borderRadius: 18,
            color: "#ffffff",
            display: "flex",
            height: 62,
            justifyContent: "center",
            width: 62,
          }}
        >
          <IconSpiral color="currentColor" size={38} stroke={1.7} />
        </div>
        <span style={{ fontSize: 28, fontWeight: 650, letterSpacing: -1 }}>
          Portals Design
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: -3.6,
            lineHeight: 1.02,
            maxWidth: 1040,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: "#52525b",
            fontSize: 29,
            lineHeight: 1.35,
            maxWidth: 960,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}
