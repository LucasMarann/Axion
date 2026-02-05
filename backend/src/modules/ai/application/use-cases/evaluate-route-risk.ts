import { z } from "zod";
import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";
import { HttpError } from "../../../infra/http/errors/http-error.js";
import { DEFAULT_LIMITS, assertValidLimits, proposeRiskLevel, type RiskLevel, type RiskLimits } from "../../domain/risk.js";
import { GetRouteAvgSpeed } from "./get-route-avg-speed.js";
import { GetRouteHistoricalSpeedFactor } from "./get-route-historical-speed-factor.js";

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
  // compat: versões antigas que gravaram "normal/em_risco/atrasada"
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

    // 1) Busca último insight (se existir) para:
    // - eta_at (gatilho ETA estourado)
    // - risk atual
    // - counters anti-falso-positivo
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

    // 2) Sinal: ETA estourado
    let etaOverdue = false;
    if (lastInsight?.eta_at) {
      const etaAt = new Date(lastInsight.eta_at as string);
      etaOverdue = Date.now() > etaAt.getTime() + limits.etaOverdueGraceSeconds * 1000;
    }

    // 3) Sinal: parada prolongada (pela rota: snapshots recentes com speed baixa)
    // Estratégia simples: pega snapshots das últimas 2h e procura um bloco final contínuo parado.
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
      // percorre de trás pra frente pegando o bloco final "parado"
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

    // 4) Sinal: velocidade fora do padrão (média recente muito abaixo do histórico)
    const avg = await new GetRouteAvgSpeed().execute({ routeId: parsed.routeId }, auth);
    const historical = await new GetRouteHistoricalSpeedFactor().execute({ routeId: parsed.routeId }, auth);

    let speedOutOfPattern = false;
    if (avg.avgSpeedKmh != null && (avg.sampleSize ?? 0) >= limits.minSpeedSampleSize) {
      const expected = 60 * (historical.factor ?? 1); // baseline * fator
      speedOutOfPattern = avg.avgSpeedKmh < expected * limits.speedBelowHistoricalFactor;
    }

    // 5) Decide risco "proposto" pelo momento
    const proposed = proposeRiskLevel({ stopProlonged, speedOutOfPattern, etaOverdue });

    // 6) Anti-falso-positivo (histerese):
    // - AT_RISK: precisa bater N vezes seguidas antes de mudar de NORMAL
    // - DELAYED: precisa bater M vezes seguidas antes de mudar de AT_RISK
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
      atRiskHits = Math.max(atRiskHits, limits.atRiskMinConsecutiveHits); // garante antecedência
    } else {
      atRiskHits = 0;
      delayedHits = 0;
    }

    let nextRisk: RiskLevel = prevRisk;

    // Regras de transição:
    // NORMAL -> AT_RISK somente após hits suficientes
    if (prevRisk === "NORMAL" && proposed === "AT_RISK" && atRiskHits >= limits.atRiskMinConsecutiveHits) {
      nextRisk = "AT_RISK";
    }

    // NORMAL -> DELAYED: proibido (AT_RISK deve anteceder)
    if (prevRisk === "NORMAL" && proposed === "DELAYED") {
      // força o primeiro degrau
      if (atRiskHits >= limits.atRiskMinConsecutiveHits) nextRisk = "AT_RISK";
    }

    // AT_RISK -> DELAYED somente após hits suficientes
    if (prevRisk === "AT_RISK" && proposed === "DELAYED" && delayedHits >= limits.delayedMinConsecutiveHits) {
      nextRisk = "DELAYED";
    }

    // AT_RISK -> NORMAL: só se não há sinais (reseta)
    if (prevRisk === "AT_RISK" && proposed === "NORMAL") {
      nextRisk = "NORMAL";
    }

    // DELAYED -> AT_RISK/NORMAL: MVP: mantém DELAYED até resolver manualmente (ou até nova regra).
    // Para não “oscilar”, não vamos rebaixar automaticamente aqui.
    if (prevRisk === "DELAYED") {
      nextRisk = "DELAYED";
    }

    const riskChanged = nextRisk !== prevRisk;

    // 7) Persistir mudança: grava ai_insights novo apenas quando há mudança de risco
    // (mantém histórico de decisões)
    let createdInsight: any = null;

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

      // route_event
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

      // notificação (MVP): para o dono (recipient_user_id = auth.userId)
      // Se você tiver um “owner” diferente do usuário que executa, depois ajustamos para lookup do owner.
      const { error: notifErr } = await supabase.from("notifications").insert({
        recipient_user_id: auth.userId,
        delivery_id: null,
        route_id: parsed.routeId,
        type: "RISK_LEVEL_CHANGED",
        title: nextRisk === "AT_RISK" ? "Rota em risco" : nextRisk === "DELAYED" ? "Rota atrasada" : "Rota normalizada",
        message:
          nextRisk === "AT_RISK"
            ? "Detectamos sinais de risco de atraso (parada/velocidade/ETA)."
            : nextRisk === "DELAYED"
              ? "ETA estourado ou sinais persistentes: rota marcada como atrasada."
              : "Sinais de risco não persistiram; rota voltou ao normal.",
        status: "created",
        meta: {
          from: prevRisk,
          to: nextRisk,
          reason: parsed.reason ?? "PERIODIC",
        },
      });

      if (notifErr) throw notifErr;

      // métrica
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
    };
  }
}