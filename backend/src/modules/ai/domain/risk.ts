import { HttpError } from "../../../infra/http/errors/http-error.js";

export type RiskLevel = "NORMAL" | "AT_RISK" | "DELAYED";

export type RiskLimits = {
  // Parada prolongada: precisa ter uma parada contínua acima desse tempo
  stopProlongedSeconds: number;

  // Velocidade fora do padrão: velocidade recente abaixo de um fator do histórico
  speedBelowHistoricalFactor: number; // ex: 0.6 => 60% do histórico
  minSpeedSampleSize: number;

  // ETA estourado: quando o "agora" ultrapassa eta_at em X segundos
  etaOverdueGraceSeconds: number; // ex: 10 min

  // Evitar falso positivo: condição precisa persistir por X avaliações
  atRiskMinConsecutiveHits: number; // ex: 2
  delayedMinConsecutiveHits: number; // ex: 2
};

export const DEFAULT_LIMITS: RiskLimits = {
  stopProlongedSeconds: 20 * 60, // 20 min
  speedBelowHistoricalFactor: 0.6,
  minSpeedSampleSize: 8,
  etaOverdueGraceSeconds: 10 * 60, // 10 min
  atRiskMinConsecutiveHits: 2,
  delayedMinConsecutiveHits: 2,
};

export function assertValidLimits(l: RiskLimits) {
  if (l.stopProlongedSeconds < 60) throw new HttpError("Invalid stopProlongedSeconds", 400);
  if (l.speedBelowHistoricalFactor <= 0 || l.speedBelowHistoricalFactor >= 1)
    throw new HttpError("Invalid speedBelowHistoricalFactor", 400);
  if (l.minSpeedSampleSize < 3) throw new HttpError("Invalid minSpeedSampleSize", 400);
  if (l.etaOverdueGraceSeconds < 0) throw new HttpError("Invalid etaOverdueGraceSeconds", 400);
  if (l.atRiskMinConsecutiveHits < 1) throw new HttpError("Invalid atRiskMinConsecutiveHits", 400);
  if (l.delayedMinConsecutiveHits < 1) throw new HttpError("Invalid delayedMinConsecutiveHits", 400);
}

export type RiskSignals = {
  stopProlonged: boolean;
  speedOutOfPattern: boolean;
  etaOverdue: boolean;
};

export function deriveSignals(input: RiskSignals) {
  const any = input.stopProlonged || input.speedOutOfPattern || input.etaOverdue;
  return { any, ...input };
}

// Regra: DELAYED só acontece se houver "condição forte" (ETA estourado)
// OU combinação de sinais persistentes. Mas NUNCA pula NORMAL -> DELAYED.
export function proposeRiskLevel(signals: RiskSignals): RiskLevel {
  if (signals.etaOverdue) return "DELAYED";
  if (signals.stopProlonged || signals.speedOutOfPattern) return "AT_RISK";
  return "NORMAL";
}