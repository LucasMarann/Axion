import { z } from "zod";
import { HttpError } from "../../../infra/http/errors/http-error.js";

export const DeliveryStatusSchema = z.enum(["COLLECTED", "IN_TRANSIT", "STOPPED", "DELIVERED"]);
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

const ORDER: DeliveryStatus[] = ["COLLECTED", "IN_TRANSIT", "STOPPED", "DELIVERED"];

export function isFinalStatus(status: DeliveryStatus) {
  return status === "DELIVERED";
}

export function assertValidStatusTransition(from: DeliveryStatus, to: DeliveryStatus) {
  if (from === to) return;

  if (isFinalStatus(from)) {
    throw new HttpError("Delivery already delivered", 409, { code: "STATUS_FINAL" });
  }

  const fromIdx = ORDER.indexOf(from);
  const toIdx = ORDER.indexOf(to);

  if (fromIdx < 0 || toIdx < 0) {
    throw new HttpError("Invalid status", 400, { code: "INVALID_STATUS" });
  }

  // Regra simples MVP: só permite avançar (nunca voltar).
  // Permite pular: COLLECTED -> IN_TRANSIT -> ... etc (útil caso falte um evento).
  if (toIdx < fromIdx) {
    throw new HttpError("Invalid status transition", 409, { code: "INVALID_STATUS_TRANSITION" });
  }
}