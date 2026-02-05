import { z } from "zod";
import type { AuthContext } from "../../../middlewares/require-auth.js";
import { HttpError } from "../../../infra/http/errors/http-error.js";
import { createSupabaseUserClient } from "../../../config/supabase.js";
import { DeliveryStatusSchema } from "../../domain/delivery-status.js";

const InputSchema = z.object({
  trackingCode: z.string().min(3),
  originName: z.string().min(2),
  destinationName: z.string().min(2),
  recipientName: z.string().min(2),
  recipientDocument: z.string().min(3),
  routeId: z.string().uuid().nullable().optional(),
  status: DeliveryStatusSchema.optional().default("COLLECTED"),
});

export type CreateDeliveryInput = z.infer<typeof InputSchema>;

export class CreateDelivery {
  async execute(input: CreateDeliveryInput, auth: AuthContext) {
    if (auth.role !== "OWNER") {
      throw new HttpError("Forbidden", 403, { code: "FORBIDDEN" });
    }

    const parsed = InputSchema.parse(input);
    const supabase = createSupabaseUserClient(auth.accessToken);

    const { data: created, error: createError } = await supabase
      .from("deliveries")
      .insert({
        tracking_code: parsed.trackingCode,
        origin_name: parsed.originName,
        destination_name: parsed.destinationName,
        recipient_name: parsed.recipientName,
        recipient_document: parsed.recipientDocument,
        route_id: parsed.routeId ?? null,
        status: parsed.status,
      })
      .select("id, tracking_code, status, route_id, created_at")
      .single();

    if (createError) throw createError;
    if (!created) throw new HttpError("Failed to create delivery", 500);

    // Se tiver rota, registramos evento de auditoria. (MVP: "toda mudança gera RouteEvent")
    if (created.route_id) {
      const { error: eventError } = await supabase.from("route_events").insert({
        route_id: created.route_id,
        event_type: "DELIVERY_CREATED",
        occurred_at: new Date().toISOString(),
        actor_user_id: auth.userId,
        payload: {
          delivery_id: created.id,
          tracking_code: created.tracking_code,
          status: created.status,
        },
      });

      if (eventError) throw eventError;
    }

    return { delivery: created };
  }
}