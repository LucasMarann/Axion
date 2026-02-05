import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";
import { HttpError } from "../../../infra/http/errors/http-error.js";

type RiskLevel = "NORMAL" | "AT_RISK" | "DELAYED";

function normalizeRisk(v: any): RiskLevel {
  if (v === "NORMAL" || v === "AT_RISK" || v === "DELAYED") return v;
  if (v === "normal") return "NORMAL";
  if (v === "em_risco") return "AT_RISK";
  if (v === "atrasada") return "DELAYED";
  return "NORMAL";
}

function buildInsight(input: {
  risk: RiskLevel;
  etaAt: string | null;
  signals?: {
    stopProlonged?: boolean;
    speedOutOfPattern?: boolean;
    etaOverdue?: boolean;
    stopDurationSeconds?: number | null;
  };
}) {
  const { risk, etaAt, signals } = input;

  if (risk === "DELAYED") {
    return "Rota atrasada: ETA estourou; verifique parada e replaneje.";
  }

  if (risk === "AT_RISK") {
    if (signals?.stopProlonged) return "Rota em risco: parada prolongada detectada; confirme o motivo.";
    if (signals?.speedOutOfPattern) return "Rota em risco: velocidade abaixo do padrão; ETA pode aumentar.";
    return "Rota em risco: sinais de atraso detectados; acompanhe a operação.";
  }

  // NORMAL
  if (etaAt) return "Rota normal: ETA atualizado e dentro do previsto.";
  return "Rota normal: sem sinais relevantes no momento.";
}

export class GenerateRouteInsight {
  async execute(input: { routeId: string; reason: "ETA_RECALC" | "RISK_CHANGE" | "STATUS_CHANGE" }, auth: AuthContext) {
    if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
      throw new HttpError("Forbidden", 403, { code: "FORBIDDEN" });
    }

    const supabase = createSupabaseUserClient(auth.accessToken);

    // Fonte de verdade: último ai_insights da rota (pode ter eta e/ou risco)
    const { data: last, error: lastErr } = await supabase
      .from("ai_insights")
      .select("id, generated_at, eta_at, risk_level, summary, features")
      .eq("route_id", input.routeId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) throw lastErr;

    const risk = normalizeRisk(last?.risk_level);
    const etaAt = (last?.eta_at as string | null) ?? null;

    const signals = (last?.features as any)?.risk_signals ?? undefined;

    const insight = buildInsight({ risk, etaAt, signals });

    const features = {
      source: "backend",
      reason: input.reason,
      last_ai_insight_id: last?.id ?? null,
      risk,
      eta_at: etaAt,
      signals: signals ?? null,
    };

    // 1 insight ativo por rota: UPSERT por PK(route_id)
    const { data: upserted, error: upsertErr } = await supabase
      .from("route_insights")
      .upsert(
        {
          route_id: input.routeId,
          generated_at: new Date().toISOString(),
          insight,
          kind: "mvp-v1",
          features,
        },
        { onConflict: "route_id" }
      )
      .select("route_id, generated_at, insight, kind, features")
      .single();

    if (upsertErr) throw upsertErr;

    return { activeInsight: upserted };
  }
}