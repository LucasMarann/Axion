import type { RequestHandler } from "express";
import { z } from "zod";
import { createSupabaseUserClient } from "../../../../config/supabase.js";
import { HttpError } from "../../../../infra/http/errors/http-error.js";
import { trackEventAsync } from "../../../../metrics/application/track-event.js";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

export class NotificationsController {
  open: RequestHandler = async (req, res) => {
    const { id } = ParamsSchema.parse(req.params);
    const auth = (req as any).auth;

    const supabase = createSupabaseUserClient(auth.accessToken);

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("notifications")
      .update({ opened_at: now, status: "opened" })
      .eq("id", id)
      .select("id, route_id, delivery_id, opened_at, recipient_user_id, type")
      .single();

    if (error) throw error;
    if (!data) throw new HttpError("Not found", 404, { code: "NOT_FOUND" });

    trackEventAsync(
      {
        eventName: "NOTIFICATION_OPENED",
        userId: auth.userId,
        routeId: (data as any)?.route_id ?? null,
        deliveryId: (data as any)?.delivery_id ?? null,
        properties: { notification_id: id, type: (data as any)?.type ?? null },
        source: "backend",
      },
      auth.accessToken,
      "notifications-controller"
    );

    res.json({ ok: true, notification: data });
  };
}