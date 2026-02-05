import { HttpError } from "../../../infra/http/errors/http-error.js";

export type ViewerRole = "CLIENT" | "OWNER" | "DRIVER" | "MANAGER" | null;

export function getVisibilityConfig(role: ViewerRole) {
  // MVP: cliente vê com delay e precisão reduzida; owner quase real-time.
  if (role === "OWNER") {
    return { delaySeconds: 10, precisionDecimals: 6 }; // ~0.11m (praticamente exato)
  }
  if (role === "CLIENT") {
    return { delaySeconds: 180, precisionDecimals: 2 }; // ~1.1km (reduz bastante a precisão)
  }

  // Driver/manager não especificados no pedido; manter comportamento próximo do owner para operação interna.
  return { delaySeconds: 10, precisionDecimals: 6 };
}

export function roundCoord(value: number, decimals: number) {
  if (!Number.isFinite(value)) throw new HttpError("Invalid coordinates", 400, { code: "INVALID_COORDS" });
  const p = Math.pow(10, decimals);
  return Math.round(value * p) / p;
}