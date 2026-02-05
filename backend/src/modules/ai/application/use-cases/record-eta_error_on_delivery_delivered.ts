import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";

export class RecordEtaErrorOnDeliveryDelivered {
  async execute(input: { routeId: string; deliveredAt: string; deliveryId: string }, auth: AuthContext) {
    const supabase = createSupabaseUserClient(auth.accessToken);

    const { data: lastInsight, error: insightError } = await supabase
      .from("ai_insights")
      .select("id, eta_at, generated_at")
      .eq("route_id", input.routeId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (insightError) throw insightError;

    if (!lastInsight?.eta_at) {
      // Sem ETA previsto, não grava erro.
      return { recorded: false, reason: "NO_ETA_PREDICTED" as const };
    }

    const etaAt = new Date(lastInsight.eta_at as string);
    const deliveredAt = new Date(input.deliveredAt);

    const errorSeconds = Math.round((deliveredAt.getTime() - etaAt.getTime()) / 1000);

    const { error: metricError } = await supabase.from("metric_events").insert({
      event_name: "ETA_ERROR_RECORDED",
      occurred_at: new Date().toISOString(),
      user_id: auth.userId,
      route_id: input.routeId,
      delivery_id: input.deliveryId,
      properties: {
        eta_at: lastInsight.eta_at,
        delivered_at: input.deliveredAt,
        error_seconds: errorSeconds,
        error_minutes: Math.round(errorSeconds / 60),
        insight_id: lastInsight.id,
      },
      source: "backend",
    });

    if (metricError) throw metricError;

    return { recorded: true, errorSeconds };
  }
}