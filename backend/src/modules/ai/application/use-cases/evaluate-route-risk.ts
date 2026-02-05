import { z } from "zod";
import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";
import { HttpError } from "../../../infra/http/errors/http-error.js";
import { DEFAULT_LIMITS, assertValidLimits, proposeRiskLevel, type RiskLevel, type RiskLimits } from "../../domain/risk.js";
import { GetRouteAvgSpeed } from "./get-route-avg-speed.js";
import { GetRouteHistoricalSpeedFactor } from "./get-route-historical-speed-factor.js";
import { GenerateRouteInsight } from "./generate-route-insight.js";
import { CreateNotification } from "../../../notifications/application/use-cases/create-notification.js";

const InputSchema = z.object({
  routeId: z.string().uuid(),
  limits: z
    .object({
      stopProlongedSeconds: z.number().int().positive().optional(),
      speedBelowHistoricalFactor: z.number().positive().optional(),
      minSpeedSampleSize: z.number().int().positive().optional(),
      etaOverdueGraceSeconds: z.number().int().nonnegative().optional(),
      atRiskMinConsecutiveHits: z.number().int().positive().optional(),
      delayedMinConsecutiveHits: z.number().int().positive().optional(),
    })
    .optional(),
  reason: z.enum(["LOCATION_INGEST", "STATUS_CHANGE", "MANUAL", "PERIODIC"]).optional(),
});

export type EvaluateRouteRiskInput = z.infer<typeof InputSchema>;

const STOP_SPEED_KMH_THRESHOLD = 2;

function mergeLimits(partial?: EvaluateRouteRiskInput["limits"]): RiskLimits {
  const merged: RiskLimits = {
    ...DEFAULT_LIMITS,
    ...partial,
  } as RiskLimits;

  assertValidLimits(merged);
  return merged;
}

function normalizeAiRiskLevel(v: any): RiskLevel {
  if (v === "NORMAL" || v === "AT_RISK" || v === "DELAYED") return v;
  if (v === "normal") return "NORMAL";
  if (v === "em_risco") return "AT_RISK";
  if (v === "atrasada") return "DELAYED";
  return "NORMAL";
}

export class EvaluateRouteRisk {
  async execute(input: EvaluateRouteRiskInput, auth: AuthContext) {
    if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
      throw new HttpError("Forbidden", 403, { code: "FORBIDDEN" });
    }

    const parsed = InputSchema.parse(input);
    const limits = mergeLimits(parsed.limits);

    const supabase = createSupabaseUserClient(auth.accessToken);

    const { data: lastInsight, error: lastErr } = await supabase
      .from("ai_insights")
      .select("id, generated_at, eta_at, risk_level, summary, features, model_version")
      .eq("route_id", parsed.routeId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) throw lastErr;

    const prevRisk: RiskLevel = normalizeAiRiskLevel(lastInsight?.risk_level);
    const prevFeatures = (lastInsight?.features ?? {}) as any;

    let etaOverdue = false;
    if (lastInsight?.eta_at) {
      const etaAt = new Date(lastInsight.eta_at as string);
      etaOverdue = Date.now() > etaAt.getTime() + limits.etaOverdueGraceSeconds * 1000;
    }

    const since = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const { data: snaps, error: snapsErr } = await supabase
      .from("location_snapshots")
      .select("captured_at, speed_kmh")
      .eq("route_id", parsed.routeId)
      .gte("captured_at", since)
      .order("captured_at", { ascending: true })
      .limit(500);

    if (snapsErr) throw snapsErr;

    let stopProlonged = false;
    let stopDurationSeconds: number | null = null;

    const rows = (snaps ?? []) as any[];
    if (rows.length >= 2) {
      let endIdx = rows.length - 1;
      let i = endIdx;

      while (i >= 0) {
        const speed = rows[i]?.speed_kmh == null ? null : Number(rows[i].speed_kmh);
        const isStopped = speed != null && Number.isFinite(speed) && speed <= STOP_SPEED_KMH_THRESHOLD;
        if (!isStopped) break;
        i--;
      }

      const startIdx = i + 1;

      if (startIdx <= endIdx && startIdx < rows.length - 1) {
        const startAt = new Date(rows[startIdx].captured_at as string);
        const endAt = new Date(rows[endIdx].captured_at as string);
        const dur = (endAt.getTime() - startAt.getTime()) / 1000;
        stopDurationSeconds = Math.max(0, Math.round(dur));
        stopProlonged = stopDurationSeconds >= limits.stopProlongedSeconds;
      }
    }

    const avg = await new GetRouteAvgSpeed().execute({ routeId: parsed.routeId }, auth);
    const historical = await new GetRouteHistoricalSpeedFactor().execute({ routeId: parsed.routeId }, auth);

    let speedOutOfPattern = false;
    if (avg.avgSpeedKmh != null && (avg.sampleSize ?? 0) >= limits.minSpeedSampleSize) {
      const expected = 60 * (historical.factor ?? 1);
      speedOutOfPattern = avg.avgSpeedKmh < expected * limits.speedBelowHistoricalFactor;
    }

    const proposed = proposeRiskLevel({ stopProlonged, speedOutOfPattern, etaOverdue });

    const prevHits = {
      atRiskHits: Number(prevFeatures?.risk_hits?.atRiskHits ?? 0),
      delayedHits: Number(prevFeatures?.risk_hits?.delayedHits ?? 0),
    };

    let atRiskHits = prevHits.atRiskHits;
    let delayedHits = prevHits.delayedHits;

    if (proposed === "AT_RISK") {
      atRiskHits += 1;
      delayedHits = 0;
    } else if (proposed === "DELAYED") {
      delayedHits += 1;
      atRiskHits = Math.max(atRiskHits, limits.atRiskMinConsecutiveHits);
    } else {
      atRiskHits = 0;
      delayedHits = 0;
    }

    let nextRisk: RiskLevel = prevRisk;

    if (prevRisk === "NORMAL" && proposed === "AT_RISK" && atRiskHits >= limits.atRiskMinConsecutiveHits) {
      nextRisk = "AT_RISK";
    }

    if (prevRisk === "NORMAL" && proposed === "DELAYED") {
      if (atRiskHits >= limits.atRiskMinConsecutiveHits) nextRisk = "AT_RISK";
    }

    if (prevRisk === "AT_RISK" && proposed === "DELAYED" && delayedHits >= limits.delayedMinConsecutiveHits) {
      nextRisk = "DELAYED";
    }

    if (prevRisk === "AT_RISK" && proposed === "NORMAL") {
      nextRisk = "NORMAL";
    }

    if (prevRisk === "DELAYED") {
      nextRisk = "DELAYED";
    }

    const riskChanged = nextRisk !== prevRisk;

    let createdInsight: any = null;
    let activeInsight: any = null;

    if (riskChanged) {
      const summary =
        nextRisk === "NORMAL"
          ? "Risco normalizado: sinais de atraso não persistiram."
          : nextRisk === "AT_RISK"
            ? "Rota em risco: parada prolongada, velocidade baixa ou tendência de atraso."
            : "Rota atrasada: ETA estourado ou sinais persistentes de atraso.";

      const features = {
        ...prevFeatures,
        risk_hits: { atRiskHits, delayedHits },
        risk_signals: {
          stopProlonged,
          stopDurationSeconds,
          speedOutOfPattern,
          avgSpeedKmh: avg.avgSpeedKmh,
          avgSpeedSampleSize: avg.sampleSize,
          historicalFactor: (historical as any).factor ?? 1,
          etaOverdue,
          etaAt: lastInsight?.eta_at ?? null,
        },
        risk_limits: limits,
        risk_reason: parsed.reason ?? "PERIODIC",
        previousRisk: prevRisk,
        proposedRisk: proposed,
      };

      const { data: inserted, error: insErr } = await supabase
        .from("ai_insights")
        .insert({
          route_id: parsed.routeId,
          delivery_id: null,
          eta_at: lastInsight?.eta_at ?? null,
          risk_level: nextRisk,
          summary,
          features,
          model_version: "mvp-v1",
        })
        .select("id, route_id, generated_at, eta_at, risk_level, summary, features, model_version")
        .single();

      if (insErr) throw insErr;
      createdInsight = inserted;

      const { error: evErr } = await supabase.from("route_events").insert({
        route_id: parsed.routeId,
        event_type: "RISK_LEVEL_CHANGED",
        occurred_at: new Date().toISOString(),
        actor_user_id: auth.userId,
        payload: {
          from: prevRisk,
          to: nextRisk,
          signals: features.risk_signals,
          reason: parsed.reason ?? "PERIODIC",
          insight_id: inserted.id,
        },
      });

      if (evErr) throw evErr;

      // Notificações padronizadas (Owner): críticas
      if (nextRisk === "AT_RISK") {
        await new CreateNotification().execute(
          {
            recipientUserId: auth.userId,
            type: "RISK_AT_RISK",
            title: "Rota em risco",
            message: "Sinais de risco de atraso detectados; acompanhe a operação.",
            routeId: parsed.routeId,
            deliveryId: null,
            meta: { from: prevRisk, to: nextRisk, signals: features.risk_signals, reason: parsed.reason ?? "PERIODIC" },
          },
          auth,
          { viewer: "OWNER" }
        );
      }

      if (nextRisk === "DELAYED") {
        await new CreateNotification().execute(
          {
            recipientUserId: auth.userId,
            type: "RISK_DELAYED",
            title: "Atraso confirmado",
            message: "ETA estourado ou sinais persistentes: rota marcada como atrasada.",
            routeId: parsed.routeId,
            deliveryId: null,
            meta: { from: prevRisk, to: nextRisk, signals: features.risk_signals, reason: parsed.reason ?? "PERIODIC" },
            force: true,
          },
          auth,
          { viewer: "OWNER" }
        );
      }

      const { error: metricErr } = await supabase.from("metric_events").insert({
        event_name: "RISK_LEVEL_CHANGED",
        occurred_at: new Date().toISOString(),
        user_id: auth.userId,
        route_id: parsed.routeId,
        delivery_id: null,
        properties: { from: prevRisk, to: nextRisk, reason: parsed.reason ?? "PERIODIC" },
        source: "backend",
      });

      if (metricErr) throw metricErr;

      const generated = await new GenerateRouteInsight().execute({ routeId: parsed.routeId, reason: "RISK_CHANGE" }, auth);
      activeInsight = generated.activeInsight;
    }

    return {
      riskChanged,
      previous: prevRisk,
      proposed,
      current: nextRisk,
      signals: { stopProlonged, speedOutOfPattern, etaOverdue, stopDurationSeconds },
      counters: { atRiskHits, delayedHits },
      limits,
      insight: createdInsight,
      activeInsight,
    };
  }
}