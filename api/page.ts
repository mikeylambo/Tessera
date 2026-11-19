// `/d/<n>` and `/r/<id>` (rewritten here by vercel.json): the game's index.html with Open Graph tags, so links unfurl
// as the share image in iMessage, Discord and X. The SPA then routes from location.pathname.
import { dailyDay, dailyIndex, runById } from "./_shared";

export const config = { runtime: "edge" };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = url.origin;
  const r = url.searchParams.get("r");
  const d = url.searchParams.get("d");
  let title = "TESSERA";
  let desc = "Mark. Detonate. Every kill becomes the ground you stand on.";
  let image = `${origin}/api/og`;
  let path = "/";
  if (r) {
    const run = await runById(r);
    path = `/r/${r}`;
    if (run) {
      title = `TESSERA Daily #${dailyIndex(run.day)} ✦ ${run.name}`;
      desc = `Depth ${run.depth} · ${run.score.toLocaleString("en-US")} — watch the run, then play today's Daily.`;
      image = `${origin}/api/og?r=${r}`;
    }
  } else if (d && /^\d{1,5}$/.test(d)) {
    path = `/d/${d}`;
    title = `TESSERA Daily #${d} ✦`;
    desc = `${dailyDay(Number(d))} · one board, everyone. How deep can you go?`;
    image = `${origin}/api/og?d=${d}`;
  }
  const page = await fetch(`${origin}/index.html`);
  let html = await page.text();
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="TESSERA">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(origin + path)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`
  ].join("");
  html = html.replace(/<meta property="og:[^>]*>/g, "").replace("</head>", `${tags}</head>`).replace("<head>", `<head><base href="/">`); // assets are "./"-relative
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60, s-maxage=300" } });
}
