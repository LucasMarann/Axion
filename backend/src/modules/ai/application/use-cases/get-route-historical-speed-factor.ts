import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";

// MVP: histórico básico = compara velocidade média recente vs um baseline simples da rota.
// Sem tabela histórica dedicada, usamos snapshots antigos como proxy (últimos 7 dias).
export class GetRouteHistoricalSpeedFactor {
  async execute(input: { routeId: string }, auth: AuthContext) {
    const supabase = createSupabaseUserClient(auth.accessToken);

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const { data, error } = await supabase
      .from("location_snapshots")
      .select("speed_kmh, captured_at")
      .eq("route_id", input.routeId)
      .gte("captured_at", since)
      .order("captured_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const speeds = (data ?? [])
      .map((r: any) => (r.speed_kmh == null ? null : Number(r.speed_kmh)))
      .filter((v: any) => typeof v === "number" && Number.isFinite(v) && v > 2);

    if (speeds.length < 10) {
      // Sem histórico suficiente: neutro
      return { factor: 1 };
    }

    const avg = speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length;

    // baseline simples (MVP): 60 km/h
    const baseline = 60;

    // fator >1 significa “mais rápido que o baseline”, <1 mais lento
    const raw = avg / baseline;

    // clamp para não distorcer demais
    const factor = Math.max(0.8, Math.min(raw, 1.2));

    return { factor, sampleSize: speeds.length, avgSpeedKmh: avg };
  }
}