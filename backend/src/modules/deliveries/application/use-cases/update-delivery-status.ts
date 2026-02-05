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
import { EvaluateRouteRisk } from "../../../ai/application/use-cases/evaluate-route-risk.js";
import { CreateNotification } from "../../../notifications/application/use-cases/create-notification.js";

const InputSchema = z.object({
  id: z.string().uuid(),
  status: DeliveryStatusSchema,
  distanceRemainingKm: z.number().nonnegative().optional(),
  avgSpeedKmh: z.number().positive().optional(),
});

export type UpdateDeliveryStatusInput = z.infer<typeof InputSchema>;

function statusLabel(s: string) {
  if (s === "COLLECTED") return "Coletado";
  if (s === "IN_TRANSIT") return "Em trânsito";
  if (s === "STOPPED") return "Parada";
  if (s === "DELIVERED") return "Entregue";
  return s;
}

export class UpdateDeliveryStatus {
  async execute(input: UpdateDeliveryStatusInput, auth: AuthContext) {
    const parsed = InputSchema.parse(input);

    if (auth.role !== "OWNER" && auth.role !== "DRIVER") {
      throw new HttpError("Forbidden", 403, { code: "FORBIDDEN" });
    }

    const supabase = createSupabaseUserClient(auth.accessToken);

    const { data: current, error: currentError } = await supabase
      .from("deliveries")
      .select("id, status, route_id, delivered_at, tracking_code")
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
      .select("id, status, route_id, delivered_at, updated_at, tracking_code")
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

    // Notificação (Owner): mudança de status (histórico obrigatório + anti-spam)
    if (auth.role === "OWNER") {
      await new CreateNotification().execute(
        {
          recipientUserId: auth.userId,
          type: "DELIVERY_STATUS_CHANGED",
          title: "Mudança de status",
          message: `Entrega ${updated.tracking_code}: ${statusLabel(from)} → ${statusLabel(to)}.`,
          routeId: updated.route_id as string,
          deliveryId: updated.id as string,
          meta: { from, to, tracking_code: updated.tracking_code },
        },
        auth,
        { viewer: "OWNER" }
      );
    }

    const shouldRecalcEta = to === "IN_TRANSIT" || to === "STOPPED";
    if (shouldRecalcEta && auth.role === "OWNER" && parsed.distanceRemainingKm != null) {
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

    if ((to === "IN_TRANSIT" || to === "STOPPED") && auth.role === "OWNER") {
      await new EvaluateRouteRisk().execute({ routeId: updated.route_id as string, reason: "STATUS_CHANGE" }, auth);
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