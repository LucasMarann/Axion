import { z } from "zod";
import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";
import { HttpError } from "../../../infra/http/errors/http-error.js";
import { computeEtaSeconds, toEtaAtFromNow } from "../../domain/eta.js";
import { GetRouteAvgSpeed } from "./get-route-avg-speed.js";
import { GetRouteHistoricalSpeedFactor } from "./get-route-historical-speed-factor.js";
import { GenerateRouteInsight } from "./generate-route-insight.js";

const InputSchema = z.object({
  routeId: z.string().uuid(),
  distanceRemainingKm: z.number().nonnegative(),
  avgSpeedKmh: z.number().positive().optional(),
  reason: z.enum(["MANUAL", "STATUS_CHANGE", "SIGNAL_RECOVERED", "STOP_PROLONGED", "PERIODIC"]).optional(),
});

export type RecalculateRouteEtaInput = z.infer<typeof InputSchema>;

const MIN_RECALC_INTERVAL_SECONDS = 10 * 60; // 10 min (evita processamento excessivo)

export class RecalculateRouteEta {
  async execute(input: RecalculateRouteEtaInput, auth: AuthContext) {
    if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
      throw new HttpError("Forbidden", 403, { code: "FORBIDDEN" });
    }

    const parsed = InputSchema.parse(input);
    const supabase = createSupabaseUserClient(auth.accessToken);

    const { data: lastInsight, error: lastError } = await supabase
      .from("ai_insights")
      .select("id, generated_at, eta_at, risk_level, summary")
      .eq("route_id", parsed.routeId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) throw lastError;

    if (lastInsight?.generated_at) {
      const lastAt = new Date(lastInsight.generated_at as string);
      const diff = (Date.now() - lastAt.getTime()) / 1000;
      if (diff < MIN_RECALC_INTERVAL_SECONDS && parsed.reason !== "MANUAL") {
        return {
          recalculated: false,
          reason: "THROTTLED",
          nextInSeconds: Math.ceil(MIN_RECALC_INTERVAL_SECONDS - diff),
          lastInsight,
        };
      }
    }

    let avgSpeedKmh = parsed.avgSpeedKmh ?? null;
    let avgSpeedSampleSize = 0;

    if (avgSpeedKmh == null) {
      const avg = await new GetRouteAvgSpeed().execute({ routeId: parsed.routeId }, auth);
      avgSpeedKmh = avg.avgSpeedKmh;
      avgSpeedSampleSize = avg.sampleSize;
    }

    if (avgSpeedKmh == null) {
      avgSpeedKmh = 5;
    }

    const historical = await new GetRouteHistoricalSpeedFactor().execute({ routeId: parsed.routeId }, auth);

    const etaSeconds = computeEtaSeconds({
      distanceRemainingKm: parsed.distanceRemainingKm,
      avgSpeedKmh,
      historicalSpeedFactor: historical.factor,
    });

    const etaAt = toEtaAtFromNow(etaSeconds);

    let risk_level: "normal" | "em_risco" | "atrasada" = "normal";
    if (avgSpeedKmh <= 10) risk_level = "em_risco";
    if (etaSeconds > 24 * 3600) risk_level = "em_risco";

    const summary =
      risk_level === "normal"
        ? "ETA recalculado com base na velocidade recente."
        : "Rota com velocidade baixa ou ETA alto; pode haver risco de atraso.";

    const features = {
      distanceRemainingKm: parsed.distanceRemainingKm,
      avgSpeedKmh,
      avgSpeedSampleSize,
      historicalSpeedFactor: historical.factor,
      historicalSampleSize: (historical as any).sampleSize ?? null,
      reason: parsed.reason ?? "PERIODIC",
      etaSeconds,
    };

    const { data: created, error: createError } = await supabase
      .from("ai_insights")
      .insert({
        route_id: parsed.routeId,
        delivery_id: null,
        eta_at: etaAt,
        risk_level,
        summary,
        features,
        model_version: "mvp-v1",
      })
      .select("id, route_id, generated_at, eta_at, risk_level, summary, features, model_version")
      .single();

    if (createError) throw createError;

    const { error: metricError } = await supabase.from("metric_events").insert({
      event_name: "ETA_RECALCULATED",
      occurred_at: new Date().toISOString(),
      user_id: auth.userId,
      route_id: parsed.routeId,
      delivery_id: null,
      properties: {
        risk_level,
        eta_at: etaAt,
        reason: parsed.reason ?? "PERIODIC",
      },
      source: "backend",
    });

    if (metricError) throw metricError;

    // Insight ativo (1 por rota)
    const insight = await new GenerateRouteInsight().execute({ routeId: parsed.routeId, reason: "ETA_RECALC" }, auth);

    return { recalculated: true, insight: created, activeInsight: insight.activeInsight };
  }
}