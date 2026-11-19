// Shared by the Vercel edge functions (OG unfurls). Public reads only — publishable key, RLS select policy.
export const SUPABASE = "https://iysvarvkltihgosbhtaa.supabase.co";
export const KEY = "sb_publishable_7Kxs-F6HGMgZmb86V1b9_A_qtyUerCh";
export const RUN_ID = /^[0-9abcdefghjkmnpqrstvwxyz]{10}$/;
const EPOCH = Date.parse("2026-11-13T00:00:00Z"); // Daily #1 (src/share/daily.ts)

export const dailyDay = (n: number): string => new Date(EPOCH + (n - 1) * 86_400_000).toISOString().slice(0, 10);
export const dailyIndex = (day: string): number => Math.floor((Date.parse(`${day}T00:00:00Z`) - EPOCH) / 86_400_000) + 1;

export interface RunMeta {
  id: string;
  day: string;
  name: string;
  score: number;
  depth: number;
  grid: string;
}

async function rest(q: string): Promise<RunMeta[]> {
  const r = await fetch(`${SUPABASE}/rest/v1/tessera_runs?${q}&select=id,day,name,score,depth,grid`, { headers: { apikey: KEY } });
  return r.ok ? ((await r.json()) as RunMeta[]) : [];
}
export const runById = async (id: string): Promise<RunMeta | null> => (RUN_ID.test(id) ? ((await rest(`id=eq.${id}`))[0] ?? null) : null);
export const topRun = async (day: string): Promise<RunMeta | null> => (await rest(`board=eq.daily:${day}&order=score.desc,created_at.asc&limit=1`))[0] ?? null;
