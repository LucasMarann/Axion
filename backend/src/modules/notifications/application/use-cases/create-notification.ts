import { z } from "zod";
import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";
import { HttpError } from "../../../infra/http/errors/http-error.js";
import {
  DEFAULT_LIMITS,
  assertValidLimits,
  getPriority,
  type AntiSpamLimits,
  type NotificationType,
} from "../../domain/notification.js";
import { trackEventAsync } from "../../../metrics/application/track-event.js";

const InputSchema = z.object({
  recipientUserId: z.string().uuid(),
  type: z.enum(["DELIVERY_STATUS_CHANGED", "ETA_UPDATED", "RISK_AT_RISK", "RISK_DELAYED"]),
  title: z.string().min(2),
  message: z.string().min(2),
  routeId: z.string().uuid().nullable().optional(),
  deliveryId: z.string().uuid().nullable().optional(),
  meta: z.record(z.any()).optional(),
  // Se true, ignora rate limit/dedupe (usar apenas para eventos críticos)
  force: z.boolean().optional(),
});

export type CreateNotificationInput = z.infer<typeof InputSchema>;

function mergeLimits(partial?: Partial<AntiSpamLimits>): AntiSpamLimits {
  const merged: AntiSpamLimits = { ...DEFAULT_LIMITS, ...(partial ?? {}) };
  assertValidLimits(merged);
  return merged;
}

function nowIso() {
  return new Date().toISOString();
}

export class CreateNotification {
  async execute(
    input: CreateNotificationInput,
    auth: AuthContext,
    opts?: { viewer: "OWNER" | "CLIENT"; limits?: Partial<AntiSpamLimits> }
  ) {
    if (!auth.userId) throw new HttpError("Unauthorized", 401, { code: "UNAUTHORIZED" });

    const parsed = InputSchema.parse(input);
    const supabase = createSupabaseUserClient(auth.accessToken);

    const viewer = opts?.viewer ?? "OWNER";
    const limits = mergeLimits(opts?.limits);

    const priority = getPriority(parsed.type as NotificationType);
    const dedupeWindowSeconds =
      viewer === "CLIENT" ? limits.dedupeWindowSecondsClient : limits.dedupeWindowSecondsOwner;
    const rateLimitSeconds =
      viewer === "CLIENT" ? limits.rateLimitPerRouteSecondsClient : limits.rateLimitPerRouteSecondsOwner;

    const force = parsed.force === true || priority === "CRITICAL";

    if (!force && parsed.routeId) {
      const cutoff = new Date(Date.now() - rateLimitSeconds * 1000).toISOString();
      const { data: recentByRoute, error } = await supabase
        .from("notifications")
        .select("id, created_at")
        .eq("recipient_user_id", parsed.recipientUserId)
        .eq("route_id", parsed.routeId)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      if ((recentByRoute ?? []).length > 0) {
        return { created: false as const, reason: "RATE_LIMIT_ROUTE" as const };
      }
    }

    if (!force) {
      const cutoff = new Date(Date.now() - dedupeWindowSeconds * 1000).toISOString();

      let q = supabase
        .from("notifications")
        .select("id, created_at")
        .eq("recipient_user_id", parsed.recipientUserId)
        .eq("type", parsed.type)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1);

      if (parsed.routeId) q = q.eq("route_id", parsed.routeId);
      if (parsed.deliveryId) q = q.eq("delivery_id", parsed.deliveryId);

      const { data: recentSame, error: recentErr } = await q;
      if (recentErr) throw recentErr;

      if ((recentSame ?? []).length > 0) {
        return { created: false as const, reason: "DEDUPED" as const };
      }
    }

    const meta = {
      ...(parsed.meta ?? {}),
      priority,
      viewer,
    };

    const { data: created, error: insertErr } = await supabase
      .from("notifications")
      .insert({
        recipient_user_id: parsed.recipientUserId,
        delivery_id: parsed.deliveryId ?? null,
        route_id: parsed.routeId ?? null,
        type: parsed.type,
        title: parsed.title,
        message: parsed.message,
        status: "created",
        created_at: nowIso(),
        meta,
      })
      .select("id, type, title, message, status, created_at, route_id, delivery_id, meta")
      .single();

    if (insertErr) throw insertErr;

    trackEventAsync(
      {
        eventName: "NOTIFICATION_SENT",
        userId: auth.userId,
        routeId: (created as any)?.route_id ?? parsed.routeId ?? null,
        deliveryId: (created as any)?.delivery_id ?? parsed.deliveryId ?? null,
        properties: {
          notification_id: (created as any)?.id ?? null,
          recipient_user_id: parsed.recipientUserId,
          type: parsed.type,
          priority,
          viewer,
        },
        source: "backend",
      },
      auth.accessToken,
      "create-notification"
    );

    return { created: true as const, notification: created };
  }
}