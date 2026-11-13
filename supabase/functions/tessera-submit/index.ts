// TESSERA leaderboard submit (DECISIONS #67). The client sends its input log; the server re-runs the real,
// deterministic sim and records only the score that the replay reproduces. Writes need the service role.
import { createClient } from "npm:@supabase/supabase-js@2";
import { resimulate } from "./sim.js";

const MAX_FRAMES = 60 * 60 * 45; // 45 min of play ≈ 0.5 s CPU to verify
const MAX_ENTRIES = 40000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME = /^[A-Za-z0-9 ._-]{2,16}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const utcDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  let b: { mode?: string; seed?: string; player?: string; name?: string; frames?: number; entries?: unknown };
  try {
    b = await req.json();
  } catch {
    return json(400, { error: "bad json" });
  }
  const { mode, seed, player, frames, entries } = b;
  const name = String(b.name ?? "").trim();
  if (!player || !UUID.test(player)) return json(400, { error: "bad player" });
  if (!NAME.test(name)) return json(400, { error: "bad name" });
  if (!Number.isInteger(frames) || frames! <= 0 || frames! > MAX_FRAMES) return json(400, { error: "bad frames" });
  if (!Array.isArray(entries) || entries.length > MAX_ENTRIES) return json(400, { error: "bad log" });
  for (const e of entries) if (!Array.isArray(e) || e.length !== 8 || !e.every((v) => Number.isInteger(v))) return json(400, { error: "bad log entry" });

  let board: string;
  let config: Record<string, unknown>;
  if (mode === "daily") {
    const day = String(seed ?? "").replace(/^DAILY-/, "");
    if (!DAY.test(day) || (day !== utcDay() && day !== utcDay(-1))) return json(400, { error: "daily closed" });
    board = `daily:${day}`;
    config = { mode: "daily", seed: `DAILY-${day}` };
  } else if (mode === "endless") {
    if (typeof seed !== "string" || !/^[A-Za-z0-9-]{1,32}$/.test(seed)) return json(400, { error: "bad seed" });
    board = "endless";
    config = { mode: "endless", seed, sector: 1, assist: false, unlockedAct: 5 };
  } else return json(400, { error: "bad mode" });

  // the verdict: replay the run
  const w = resimulate(config as never, entries as never, frames!);
  if (!w.ended) return json(422, { error: "run did not end" });
  const score = w.score.total as number;
  const depth = w.depthRow as number;

  const prev = await db.from("tessera_scores").select("score").eq("board", board).eq("player", player).maybeSingle();
  if (prev.error) return json(500, { error: "db" });
  // Daily: the first ranked attempt stands. Endless: best run stands.
  const write = !prev.data || (mode === "endless" && score > prev.data.score);
  if (write) {
    const up = await db.from("tessera_scores").upsert({ board, player, name, score, depth, frames: w.frame, updated_at: new Date().toISOString() });
    if (up.error) return json(500, { error: "db" });
  } else if (prev.data) await db.from("tessera_scores").update({ name }).eq("board", board).eq("player", player);
  const best = write ? score : prev.data!.score;
  const above = await db.from("tessera_scores").select("player", { count: "exact", head: true }).eq("board", board).gt("score", best);
  const total = await db.from("tessera_scores").select("player", { count: "exact", head: true }).eq("board", board);
  return json(200, { board, verified: true, score, depth, best, rank: (above.count ?? 0) + 1, of: total.count ?? 0, recorded: write });
});
