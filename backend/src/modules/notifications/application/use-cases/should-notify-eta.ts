import { HttpError } from "../../../infra/http/errors/http-error.js";

export function diffMinutes(aIso: string, bIso: string) {
  const a = new Date(aIso);
  const b = new Date(bIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    throw new HttpError("Invalid dates for diffMinutes", 400);
  }
  return Math.abs(a.getTime() - b.getTime()) / 1000 / 60;
}

export function shouldNotifyEta(input: { previousEtaAt: string | null; nextEtaAt: string; thresholdMinutes: number }) {
  if (!input.previousEtaAt) return true; // primeira previsão: vale notificar (owner; cliente depende do caller)
  const delta = diffMinutes(input.previousEtaAt, input.nextEtaAt);
  return delta >= input.thresholdMinutes;
}