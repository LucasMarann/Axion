import { HttpError } from "../../../infra/http/errors/http-error.js";

export type NotificationType =
  | "DELIVERY_STATUS_CHANGED"
  | "ETA_UPDATED"
  | "RISK_AT_RISK"
  | "RISK_DELAYED";

export type NotificationPriority = "LOW" | "NORMAL" | "CRITICAL";

export function getPriority(type: NotificationType): NotificationPriority {
  if (type === "RISK_DELAYED") return "CRITICAL";
  if (type === "RISK_AT_RISK") return "CRITICAL";
  if (type === "DELIVERY_STATUS_CHANGED") return "NORMAL";
  if (type === "ETA_UPDATED") return "LOW";
  return "NORMAL";
}

export type AntiSpamLimits = {
  // janela de dedupe por tipo/rota/entrega: evita repetição do mesmo alerta
  dedupeWindowSecondsOwner: number;
  dedupeWindowSecondsClient: number;

  // ETA: só notificar se mudar além de X minutos
  etaDeltaMinutesThresholdClient: number;
  etaDeltaMinutesThresholdOwner: number;

  // rate limit por rota (segurança extra)
  rateLimitPerRouteSecondsOwner: number;
  rateLimitPerRouteSecondsClient: number;
};

export const DEFAULT_LIMITS: AntiSpamLimits = {
  dedupeWindowSecondsOwner: 10 * 60,
  dedupeWindowSecondsClient: 60 * 60,

  etaDeltaMinutesThresholdClient: 30,
  etaDeltaMinutesThresholdOwner: 10,

  rateLimitPerRouteSecondsOwner: 60,
  rateLimitPerRouteSecondsClient: 10 * 60,
};

export function assertValidLimits(l: AntiSpamLimits) {
  if (l.dedupeWindowSecondsOwner < 10) throw new HttpError("Invalid dedupeWindowSecondsOwner", 400);
  if (l.dedupeWindowSecondsClient < 60) throw new HttpError("Invalid dedupeWindowSecondsClient", 400);
  if (l.etaDeltaMinutesThresholdClient < 5) throw new HttpError("Invalid etaDeltaMinutesThresholdClient", 400);
  if (l.etaDeltaMinutesThresholdOwner < 1) throw new HttpError("Invalid etaDeltaMinutesThresholdOwner", 400);
  if (l.rateLimitPerRouteSecondsOwner < 10) throw new HttpError("Invalid rateLimitPerRouteSecondsOwner", 400);
  if (l.rateLimitPerRouteSecondsClient < 60) throw new HttpError("Invalid rateLimitPerRouteSecondsClient", 400);
}