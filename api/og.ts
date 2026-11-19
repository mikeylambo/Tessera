// Share image (1200×630) for link unfurls: the run's spoiler-free ground silhouette in the locked palette.
import { ImageResponse } from "@vercel/og";
import { dailyDay, dailyIndex, runById, topRun, type RunMeta } from "./_shared.js";

export const config = { runtime: "edge" }; // @vercel/og pinned to 0.6.x: later versions reference node:module, which edge rejects

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown): El => ({ type, props: { style: { display: "flex", ...style }, children } });

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const r = url.searchParams.get("r");
  const d = url.searchParams.get("d");
  let run: RunMeta | null = null;
  let index: number | null = null;
  if (r) run = await runById(r);
  else if (d && /^\d{1,5}$/.test(d)) {
    index = Number(d);
    run = await topRun(dailyDay(index));
  }
  if (run) index = dailyIndex(run.day);
  const grid = (run?.grid ?? "010010/111111/011110/111011/110111/011110").split("/");
  const cell = Math.min(64, Math.floor(420 / grid.length));
  const tiles = h(
    "div",
    { flexDirection: "column", gap: 10 },
    grid.map((row) => h("div", { gap: 10 }, [...row].map((c) => h("div", { width: cell, height: cell, borderRadius: 4, background: c === "1" ? "#ffb347" : "#14161c", boxShadow: c === "1" ? "0 0 28px rgba(255,179,71,0.55)" : "none" }))))
  );
  const text = h("div", { flexDirection: "column", justifyContent: "center", gap: 18, marginLeft: 80 }, [
    h("div", { fontSize: 72, letterSpacing: 18, color: "#e9e3d8" }, "TESSERA"),
    h("div", { fontSize: 40, color: "#ffb347" }, index ? `Daily #${index} ✦` : "Every tile is earned."),
    ...(run ? [h("div", { fontSize: 32, color: "#8a93a3" }, `${run.name} · Depth ${run.depth} · ${run.score.toLocaleString("en-US")}`)] : [])
  ]);
  const root = h("div", { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 35% 50%, #10131a 0%, #050608 70%)" }, [tiles, text]);
  return new ImageResponse(root as never, { width: 1200, height: 630, headers: { "cache-control": "public, max-age=300, s-maxage=3600" } });
}
