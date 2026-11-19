import type { Profile } from "./profile";

/**
 * Online boards (DECISIONS #67). Reads are public (Supabase REST, publishable key); writes go through the
 * `tessera-submit` edge function, which re-simulates the input log and records only the score the replay reproduces.
 * Offline-first: runs queue in the profile and flush whenever the network allows.
 */
const URL_BASE = "https://iysvarvkltihgosbhtaa.supabase.co";
const KEY = "sb_publishable_7Kxs-F6HGMgZmb86V1b9_A_qtyUerCh";
const HEADERS = { apikey: KEY, "Content-Type": "application/json" };
const TIMEOUT_MS = 8000;

export type Submission = Profile["pendingSubmissions"][number];
export interface SubmitResult {
  board: string;
  score: number;
  best: number;
  rank: number;
  of: number;
  recorded: boolean;
  /** Daily: public replay id (`/r/<id>`) of the validated run. */
  run?: string | null;
}

/** A validated, publicly readable Daily run (brief §3.2). */
export interface RunRow {
  id: string;
  board: string;
  day: string;
  name: string;
  seed: string;
  frames: number;
  entries: Array<[number, number, number, number, number, number, number, number]>;
  score: number;
  depth: number;
  perfect: number;
  hash: string;
  grid: string;
}
export interface BoardRow {
  rank: number;
  name: string;
  score: number;
  depth: number;
  me: boolean;
}

/** Handles are composed from curated words (◂ ▸ pickers, no free text → nothing to moderate). */
export const NAME_A = ["AMBER", "ASH", "COLD", "DUSK", "EMBER", "GLASS", "HOLLOW", "IRON", "LONE", "NULL", "OBSIDIAN", "PALE", "QUIET", "STILL", "STONE", "VIOLET", "VOID", "WARM"] as const;
export const NAME_B = ["CAIRN", "CUBE", "EDGE", "GLYPH", "LATTICE", "LEDGE", "MASON", "MONOLITH", "OBELISK", "PILLAR", "RUNE", "SHARD", "SLAB", "TESSERA", "TILE", "WARDEN"] as const;

export function composeName(a: number, b: number): string {
  return `${NAME_A[a] ?? NAME_A[0]}-${NAME_B[b] ?? NAME_B[0]}`.slice(0, 16);
}

export function newIdentity(): { playerId: string; nameA: number; nameB: number } {
  const id = crypto.randomUUID?.() ?? "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))).toString(16));
  const r = crypto.getRandomValues(new Uint8Array(2));
  return { playerId: id, nameA: r[0]! % NAME_A.length, nameB: r[1]! % NAME_B.length };
}

async function fetchT(input: string, init?: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Submit one run. `null` = network/server trouble (keep queued); `"rejected"` = permanent (drop). */
export async function submit(s: Submission, playerId: string, name: string): Promise<SubmitResult | "rejected" | null> {
  try {
    const r = await fetchT(`${URL_BASE}/functions/v1/tessera-submit`, {
      method: "POST",
      headers: { ...HEADERS, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ mode: s.mode, seed: s.seed, player: playerId, name, frames: s.frames, entries: s.entries })
    });
    if (r.ok) return (await r.json()) as SubmitResult;
    return r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429 ? "rejected" : null;
  } catch {
    return null;
  }
}

export async function fetchBoard(board: string, playerId: string, limit = 10): Promise<{ rows: BoardRow[]; mine: BoardRow | null } | null> {
  try {
    const q = `${URL_BASE}/rest/v1/tessera_scores?board=eq.${encodeURIComponent(board)}&select=player,name,score,depth&order=score.desc,updated_at.asc&limit=${limit}`;
    const r = await fetchT(q, { headers: HEADERS });
    if (!r.ok) return null;
    const data = (await r.json()) as Array<{ player: string; name: string; score: number; depth: number }>;
    const rows = data.map((d, i) => ({ rank: i + 1, name: d.name, score: d.score, depth: d.depth, me: d.player === playerId }));
    let mine = rows.find((x) => x.me) ?? null;
    if (!mine) {
      const m = await fetchT(`${URL_BASE}/rest/v1/tessera_scores?board=eq.${encodeURIComponent(board)}&player=eq.${playerId}&select=name,score,depth`, { headers: HEADERS });
      const md = m.ok ? ((await m.json()) as Array<{ name: string; score: number; depth: number }>) : [];
      if (md[0]) {
        const above = await fetchT(`${URL_BASE}/rest/v1/tessera_scores?board=eq.${encodeURIComponent(board)}&score=gt.${md[0].score}&select=player`, { headers: { ...HEADERS, Prefer: "count=exact", Range: "0-0" } });
        const total = Number(above.headers.get("content-range")?.split("/")[1] ?? "0");
        mine = { rank: total + 1, name: md[0].name, score: md[0].score, depth: md[0].depth, me: true };
      }
    }
    return { rows, mine };
  } catch {
    return null;
  }
}

const RUN_COLS = "id,board,day,name,seed,frames,entries,score,depth,perfect,hash,grid";

/** Public read of one validated run by id. `null` = not found / offline. */
export async function fetchRun(id: string): Promise<RunRow | null> {
  try {
    const r = await fetchT(`${URL_BASE}/rest/v1/tessera_runs?id=eq.${encodeURIComponent(id)}&select=${RUN_COLS}`, { headers: HEADERS });
    if (!r.ok) return null;
    const d = (await r.json()) as RunRow[];
    return d[0] ?? null;
  } catch {
    return null;
  }
}

/** The day's #1 validated run (ghost source). */
export async function fetchTopRun(day: string): Promise<RunRow | null> {
  try {
    const r = await fetchT(`${URL_BASE}/rest/v1/tessera_runs?board=eq.daily:${day}&select=${RUN_COLS}&order=score.desc,created_at.asc&limit=1`, { headers: HEADERS });
    if (!r.ok) return null;
    const d = (await r.json()) as RunRow[];
    return d[0] ?? null;
  } catch {
    return null;
  }
}
