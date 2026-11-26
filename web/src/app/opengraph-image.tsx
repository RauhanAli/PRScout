import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OG, OgMark } from "@/components/brand/og-mark";
import { SITE_HOST } from "@/lib/site";

export const alt =
  "PRScout: will this repo actually merge your PR? Check before you contribute.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const regular = readFile(
  join(process.cwd(), "assets/fonts/JetBrainsMono-400.ttf"),
);
const bold = readFile(
  join(process.cwd(), "assets/fonts/JetBrainsMono-700.ttf"),
);

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: OG.line,
        padding: 3,
        fontFamily: "JetBrains Mono",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: OG.bg,
          padding: "56px 64px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 32,
          }}
        >
          <OgMark size={48} />
          <span style={{ color: OG.ink, fontWeight: 700, letterSpacing: -1 }}>
            PRScout
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 56,
            fontSize: 70,
            fontWeight: 700,
            letterSpacing: -4,
            lineHeight: 1.08,
            color: OG.ink,
          }}
        >
          <span>Will this repo</span>
          <span style={{ color: OG.blue }}>actually merge</span>
          <span style={{ color: OG.blue }}>your PR?</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            justifyContent: "space-between",
            fontSize: 26,
            color: OG.muted,
          }}
        >
          <span>Paste a repo, or swap hub for PRScout in any GitHub link.</span>
          <span style={{ color: OG.ink }}>{SITE_HOST}</span>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "JetBrains Mono",
          data: await regular,
          weight: 400,
          style: "normal",
        },
        {
          name: "JetBrains Mono",
          data: await bold,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
