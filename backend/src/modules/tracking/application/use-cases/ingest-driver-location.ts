import { z } from "zod";
import { HttpError } from "../../../infra/http/errors/http-error.js";
import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";
import { GetActiveRouteForDriver } from "./get-active-route-for-driver.js";

const InputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  capturedAt: z.string().datetime().optional(), // timestamp do device (se vier)
  speedKmh: z.number().nonnegative().optional(),
  headingDeg: z.number().min(0).max(360).optional(),
  accuracyM: z.number().nonnegative().optional(),
  source: z.string().min(1).optional(),
  meta: z.record(z.any()).optional(),
});

export type IngestDriverLocationInput = z.infer<typeof InputSchema>;

const MIN_INTERVAL_SECONDS = 20; // throttling (MVP): salva no máximo 1 a cada 20s por rota

export class IngestDriverLocation {
  async execute(input: IngestDriverLocationInput, auth: AuthContext) {
    if (auth.role !== "DRIVER") {
      throw new HttpError("Forbidden", 403, { code: "FORBIDDEN" });
    }

    const parsed = InputSchema.parse(input);

    const supabase = createSupabaseUserClient(auth.accessToken);

    const { routeId, driverId } = await new GetActiveRouteForDriver().execute(auth);

    // Throttling: busca último snapshot dessa rota e compara timestamps
    const { data: last, error: lastError } = await supabase
      .from("location_snapshots")
      .select("id, recorded_at")
      .eq("route_id", routeId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) throw lastError;

    const now = new Date();
    const lastRecordedAt = last?.recorded_at ? new Date(last.recorded_at as string) : null;

    if (lastRecordedAt) {
      const diffSeconds = (now.getTime() - lastRecordedAt.getTime()) / 1000;
      if (diffSeconds < MIN_INTERVAL_SECONDS) {
        return {
          accepted: true,
          stored: false,
          reason: "THROTTLED",
          nextInSeconds: Math.ceil(MIN_INTERVAL_SECONDS - diffSeconds),
          routeId,
        };
      }
    }

    const capturedAt = parsed.capturedAt ? new Date(parsed.capturedAt) : now;
    if (Number.isNaN(capturedAt.getTime())) {
      throw new HttpError("Invalid capturedAt", 400, { code: "INVALID_CAPTURED_AT" });
    }

    const { data: created, error: createError } = await supabase
      .from("location_snapshots")
      .insert({
        route_id: routeId,
        driver_id: driverId,
        vehicle_id: null,
        captured_at: capturedAt.toISOString(),
        lat: parsed.lat,
        lng: parsed.lng,
        speed_kmh: parsed.speedKmh ?? null,
        heading_deg: parsed.headingDeg ?? null,
        accuracy_m: parsed.accuracyM ?? null,
        source: parsed.source ?? "device",
        meta: parsed.meta ?? {},
      })
      .select("id, route_id, recorded_at, captured_at")
      .single();

    if (createError) throw createError;

    return { accepted: true, stored: true, snapshot: created };
  }
}