import type { RequestHandler } from "express";
import { z } from "zod";
import { EvaluateRouteRisk } from "../../../application/use-cases/evaluate-route-risk.js";

const Schema = z.object({
  routeId: z.string().uuid(),
  reason: z.enum(["LOCATION_INGEST", "STATUS_CHANGE", "MANUAL", "PERIODIC"]).optional(),
  limits: z
    .object({
      stopProlongedSeconds: z.number().int().positive().optional(),
      speedBelowHistoricalFactor: z.number().positive().optional(),
      minSpeedSampleSize: z.number().int().positive().optional(),
      etaOverdueGraceSeconds: z.number().int().nonnegative().optional(),
      atRiskMinConsecutiveHits: z.number().int().positive().optional(),
      delayedMinConsecutiveHits: z.number().int().positive().optional(),
    })
    .optional(),
});

export class RiskController {
  evaluate: RequestHandler = async (req, res) => {
    const body = Schema.parse(req.body);
    const auth = (req as any).auth;

    const useCase = new EvaluateRouteRisk();
    const result = await useCase.execute(body, auth);

    res.json(result);
  };
}