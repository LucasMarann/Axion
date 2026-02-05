import { z } from "zod";
import { HttpError } from "../../../infra/http/errors/http-error.js";
import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";
import { getVisibilityConfig, type ViewerRole } from "../../tracking/domain/visibility.js";
import {
  sanitizeExecutedPoints,
  sanitizeStops,
  type RouteExecutedPoint,
  type RouteStopView,
  type RouteView,
} from "../../routes/domain/route-view.js";

const InputSchema = z.object({
  routeId: z.string().uuid(),
});

export type GetRouteViewInput = z.infer<typeof InputSchema>;

const MAX_EXECUTED_POINTS_OWNER = 200;
const MAX_EXECUTED_POINTS_CLIENT = 50;

// Parada relevante (MVP): >= 10 minutos com speed ~ 0
const STOP_SPEED_KMH_THRESHOLD = 2;
const STOP_MIN_DURATION_SECONDS = 10 * 60;

function toViewerRole(authRole: AuthContext["role"]): ViewerRole {
  if (authRole === "OWNER") return "OWNER";
  if (authRole === "CLIENT") return "CLIENT";
  if (authRole === "DRIVER") return "DRIVER";
  return null;
}

function downsample<T>(items: T[], max: number) {
  if (items.length <= max) return items;
  const step = Math.ceil(items.length / max);
  const out: T[] = [];
  for (let i = 0; i < items.length; i += step) out.push(items[i]);
  return out;
}

export class GetRouteView {
  async execute(input: GetRouteViewInput, auth: AuthContext): Promise<RouteView> {
    const parsed = InputSchema.parse(input);
    const supabase = createSupabaseUserClient(auth.accessToken);

    const viewerRole = toViewerRole(auth.role);
    const { delaySeconds } = getVisibilityConfig(viewerRole);
    const cutoff = new Date(Date.now() - delaySeconds * 1000).toISOString();

    // 1) Rota planejada (mínimo viável com schema atual)
    const { data: route, error: routeError } = await supabase
      .from("routes")
      .select("id, code, origin_name, destination_name, planned_start_at")
      .eq("id", parsed.routeId)
      .maybeSingle();

    if (routeError) throw routeError;
    if (!route) throw new HttpError("Not found", 404, { code: "NOT_FOUND" });

    // 2) Rota executada: snapshots até cutoff
    // Owner/Driver: pega mais pontos; Client: menos
    const maxPoints = viewerRole === "CLIENT" ? MAX_EXECUTED_POINTS_CLIENT : MAX_EXECUTED_POINTS_OWNER;

    // Pegamos uma janela maior e fazemos downsample (simples e previsível)
    const { data: snapshots, error: snapshotsError } = await supabase
      .from("location_snapshots")
      .select("captured_at, lat, lng, speed_kmh")
      .eq("route_id", parsed.routeId)
      .lte("captured_at", cutoff)
      .order("captured_at", { ascending: true })
      .limit(1500);

    if (snapshotsError) throw snapshotsError;

    const pointsAll: RouteExecutedPoint[] = (snapshots ?? []).map((s: any) => ({
      capturedAt: s.captured_at as string,
      lat: Number(s.lat),
      lng: Number(s.lng),
    }));

    const points = downsample(pointsAll, maxPoints);

    // 3) Paradas relevantes (derivadas)
    // Estratégia: detectar blocos contínuos de speed baixa; pega centro aproximado (média) do bloco.
    const stopsAll: RouteStopView[] = [];
    let current: { startIdx: number; endIdx: number } | null = null;

    const rows = (snapshots ?? []) as any[];
    for (let i = 0; i < rows.length; i++) {
      const speed = rows[i]?.speed_kmh == null ? null : Number(rows[i].speed_kmh);
      const isStopped = speed != null && speed <= STOP_SPEED_KMH_THRESHOLD;

      if (isStopped && !current) current = { startIdx: i, endIdx: i };
      if (isStopped && current) current.endIdx = i;

      if (!isStopped && current) {
        const startAt = new Date(rows[current.startIdx].captured_at);
        const endAt = new Date(rows[current.endIdx].captured_at);
        const dur = (endAt.getTime() - startAt.getTime()) / 1000;

        if (dur >= STOP_MIN_DURATION_SECONDS) {
          let sumLat = 0;
          let sumLng = 0;
          let count = 0;
          for (let j = current.startIdx; j <= current.endIdx; j++) {
            sumLat += Number(rows[j].lat);
            sumLng += Number(rows[j].lng);
            count++;
          }
          const lat = count ? sumLat / count : Number(rows[current.startIdx].lat);
          const lng = count ? sumLng / count : Number(rows[current.startIdx].lng);

          stopsAll.push({
            startedAt: startAt.toISOString(),
            endedAt: endAt.toISOString(),
            durationSeconds: Math.round(dur),
            lat,
            lng,
          });
        }

        current = null;
      }
    }

    // Fecha bloco no final
    if (current) {
      const startAt = new Date(rows[current.startIdx].captured_at);
      const endAt = new Date(rows[current.endIdx].captured_at);
      const dur = (endAt.getTime() - startAt.getTime()) / 1000;

      if (dur >= STOP_MIN_DURATION_SECONDS) {
        let sumLat = 0;
        let sumLng = 0;
        let count = 0;
        for (let j = current.startIdx; j <= current.endIdx; j++) {
          sumLat += Number(rows[j].lat);
          sumLng += Number(rows[j].lng);
          count++;
        }
        const lat = count ? sumLat / count : Number(rows[current.startIdx].lat);
        const lng = count ? sumLng / count : Number(rows[current.startIdx].lng);

        stopsAll.push({
          startedAt: startAt.toISOString(),
          endedAt: endAt.toISOString(),
          durationSeconds: Math.round(dur),
          lat,
          lng,
        });
      }
    }

    return {
      planned: {
        routeId: route.id as string,
        code: route.code as string,
        originName: route.origin_name as string,
        destinationName: route.destination_name as string,
        plannedStartAt: (route.planned_start_at as string | null) ?? null,
      },
      executed: {
        delaySecondsApplied: delaySeconds,
        points: sanitizeExecutedPoints(points, viewerRole),
      },
      stops: {
        delaySecondsApplied: delaySeconds,
        items: sanitizeStops(stopsAll, viewerRole),
      },
    };
  }
}