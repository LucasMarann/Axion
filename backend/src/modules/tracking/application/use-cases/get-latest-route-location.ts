import { z } from "zod";
import { HttpError } from "../../../infra/http/errors/http-error.js";
import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";
import { getVisibilityConfig, roundCoord } from "../../domain/visibility.js";

const InputSchema = z.object({
  routeId: z.string().uuid(),
});

export type GetLatestRouteLocationInput = z.infer<typeof InputSchema>;

export class GetLatestRouteLocation {
  async execute(input: GetLatestRouteLocationInput, auth: AuthContext) {
    const parsed = InputSchema.parse(input);

    // Para isolar corretamente, o RLS deve restringir o que CLIENT pode ver.
    // Aqui aplicamos delay e redução de precisão (defesa em profundidade).
    const supabase = createSupabaseUserClient(auth.accessToken);

    const { delaySeconds, precisionDecimals } = getVisibilityConfig(auth.role);

    const cutoff = new Date(Date.now() - delaySeconds * 1000).toISOString();

    const { data, error } = await supabase
      .from("location_snapshots")
      .select("id, route_id, recorded_at, captured_at, lat, lng, speed_kmh, heading_deg")
      .eq("route_id", parsed.routeId)
      .lte("captured_at", cutoff)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new HttpError("No location available", 404, { code: "NO_LOCATION" });

    const safeLat = roundCoord(Number((data as any).lat), precisionDecimals);
    const safeLng = roundCoord(Number((data as any).lng), precisionDecimals);

    return {
      routeId: parsed.routeId,
      delaySecondsApplied: delaySeconds,
      location: {
        id: (data as any).id as string,
        capturedAt: (data as any).captured_at as string,
        recordedAt: (data as any).recorded_at as string,
        lat: safeLat,
        lng: safeLng,
        speedKmh: (data as any).speed_kmh ?? null,
        headingDeg: (data as any).heading_deg ?? null,
      },
    };
  }
}