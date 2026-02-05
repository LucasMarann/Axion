import { HttpError } from "../../../infra/http/errors/http-error.js";

export function computeEtaSeconds(input: {
  distanceRemainingKm: number;
  avgSpeedKmh: number;
  historicalSpeedFactor?: number; // 0.8..1.2
}) {
  const distance = input.distanceRemainingKm;
  const speed = input.avgSpeedKmh;
  const factor = input.historicalSpeedFactor ?? 1;

  if (!Number.isFinite(distance) || distance < 0) {
    throw new HttpError("Invalid distanceRemainingKm", 400, { code: "INVALID_DISTANCE" });
  }

  // velocidade mínima para evitar divisão por zero e ETAs absurdos quando parado
  const safeSpeed = Number.isFinite(speed) ? Math.max(speed, 5) : 5;

  // ETA base (horas) = distância / velocidade
  const baseHours = distance / safeSpeed;

  // Ajuste histórico simples: se historicamente essa rota é mais lenta/rápida, ajusta.
  const adjustedHours = baseHours / Math.max(0.5, Math.min(factor, 1.5));

  const seconds = Math.round(adjustedHours * 3600);

  // Clamp: evita ETAs gigantes por dados ruins
  return Math.max(0, Math.min(seconds, 10 * 24 * 3600)); // até 10 dias
}

export function toEtaAtFromNow(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new HttpError("Invalid eta seconds", 400, { code: "INVALID_ETA" });
  }
  return new Date(Date.now() + seconds * 1000).toISOString();
}