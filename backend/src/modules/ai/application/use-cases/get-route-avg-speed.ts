import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";

export class GetRouteAvgSpeed {
  async execute(input: { routeId: string }, auth: AuthContext) {
    const supabase = createSupabaseUserClient(auth.accessToken);

    const { data, error } = await supabase
      .from("location_snapshots")
      .select("speed_kmh, captured_at")
      .eq("route_id", input.routeId)
      .order("captured_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    const speeds = (data ?? [])
      .map((r: any) => (r.speed_kmh == null ? null : Number(r.speed_kmh)))
      .filter((v: any) => typeof v === "number" && Number.isFinite(v) && v > 2);

    if (speeds.length === 0) return { avgSpeedKmh: null as number | null, sampleSize: 0 };

    const avgSpeedKmh = speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length;
    return { avgSpeedKmh, sampleSize: speeds.length };
  }
}