import { createSupabaseUserClient } from "../../config/supabase.js";

type TrackEventInput = {
  eventName: string;
  occurredAt?: string;
  userId?: string | null;
  routeId?: string | null;
  deliveryId?: string | null;
  sessionId?: string | null;
  properties?: Record<string, any>;
  source?: "backend" | "frontend";
};

export function trackEventAsync(input: TrackEventInput, accessToken: string, loggerTag: string) {
  const supabase = createSupabaseUserClient(accessToken);

  // Fire-and-forget: não aguardamos
  Promise.resolve()
    .then(async () => {
      const occurred_at = input.occurredAt ?? new Date().toISOString();

      const { error } = await supabase.from("metric_events").insert({
        event_name: input.eventName,
        occurred_at,
        user_id: input.userId ?? null,
        route_id: input.routeId ?? null,
        delivery_id: input.deliveryId ?? null,
        session_id: input.sessionId ?? null,
        properties: input.properties ?? {},
        source: input.source ?? "backend",
      });

      if (error) {
        // Loga apenas — nunca quebra o fluxo principal
        // eslint-disable-next-line no-console
        console.error(`[${loggerTag}] failed to track metric event`, { error, eventName: input.eventName });
      }
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[${loggerTag}] unexpected metric tracking error`, { err, eventName: input.eventName });
    });
}