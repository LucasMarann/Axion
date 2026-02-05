import { z } from "zod";
import type { AuthContext } from "../../../middlewares/require-auth.js";
import { HttpError } from "../../../infra/http/errors/http-error.js";
import { createSupabaseUserClient } from "../../../config/supabase.js";
import {
  assertValidStatusTransition,
  DeliveryStatusSchema,
  type DeliveryStatus,
  isFinalStatus,
} from "../../domain/delivery-status.js";
import { RecalculateRouteEta } from "../../../ai/application/use-cases/recalculate-route-eta.js";
import { RecordEtaErrorOnDeliveryDelivered } from "../../../ai/application/use-cases/record-eta_error_on_delivery_delivered.js";

const InputSchema = z.object({
  id: z.string().uuid(),
  status: DeliveryStatusSchema,
  // opcional: permite disparar ETA com info operacional quando status muda
  distanceRemainingKm: z.number().nonnegative().optional(),
  avgSpeedKmh: z.number().positive().optional(),
});

export type UpdateDeliveryStatusInput = z.infer<typeof InputSchema>;

export class UpdateDeliveryStatus {
  async execute(input: UpdateDeliveryStatusInput, auth: AuthContext) {
    const parsed = InputSchema.parse(input);

    if (auth.role !== "OWNER" && auth.role !== "DRIVER") {
      throw new HttpError("Forbidden", 403, { code: "FORBIDDEN" });
    }

    const supabase = createSupabaseUserClient(auth.accessToken);

    const { data: current, error: currentError } = await supabase
      .from("deliveries")
      .select("id, status, route_id, delivered_at")
      .eq("id", parsed.id)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) throw new HttpError("Not found", 404, { code: "NOT_FOUND" });

    const from = current.status as DeliveryStatus;
    const to = parsed.status as DeliveryStatus;

    assertValidStatusTransition(from, to);

    const deliveredAt = to === "DELIVERED" ? new Date().toISOString() : current.delivered_at;

    const { data: updated, error: updateError } = await supabase
      .from("deliveries")
      .update({
        status: to,
        delivered_at: deliveredAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.id)
      .select("id, status, route_id, delivered_at, updated_at")
      .single();

    if (updateError) throw updateError;

    if (!updated?.route_id) {
      return { delivery: updated, routeEventCreated: false };
    }

    const { error: eventError } = await supabase.from("route_events").insert({
      route_id: updated.route_id,
      event_type: "DELIVERY_STATUS_CHANGED",
      occurred_at: new Date().toISOString(),
      actor_user_id: auth.userId,
      payload: {
        delivery_id: updated.id,
        from_status: from,
        to_status: to,
        delivered_at: isFinalStatus(to) ? updated.delivered_at : null,
      },
    });

    if (eventError) throw eventError;

    const shouldRecalc = to === "IN_TRANSIT" || to === "STOPPED";
    if (shouldRecalc && auth.role === "OWNER" && parsed.distanceRemainingKm != null) {
      await new RecalculateRouteEta().execute(
        {
          routeId: updated.route_id as string,
          distanceRemainingKm: parsed.distanceRemainingKm,
          avgSpeedKmh: parsed.avgSpeedKmh,
          reason: "STATUS_CHANGE",
        },
        auth
      );
    }

    if (to === "DELIVERED" && auth.role === "OWNER" && updated.delivered_at) {
      await new RecordEtaErrorOnDeliveryDelivered().execute(
        {
          routeId: updated.route_id as string,
          deliveryId: updated.id as string,
          deliveredAt: updated.delivered_at as string,
        },
        auth
      );
    }

    return { delivery: updated, routeEventCreated: true };
  }
}