import type { RequestHandler } from "express";
import { z } from "zod";
import { RecalculateRouteEta } from "../../../application/use-cases/recalculate-route-eta.js";

const RecalcSchema = z.object({
  routeId: z.string().uuid(),
  distanceRemainingKm: z.number().nonnegative(),
  avgSpeedKmh: z.number().positive().optional(),
  reason: z.enum(["MANUAL", "STATUS_CHANGE", "SIGNAL_RECOVERED", "STOP_PROLONGED", "PERIODIC"]).optional(),
});

export class AiController {
  recalcEta: RequestHandler = async (req, res) => {
    const body = RecalcSchema.parse(req.body);
    const auth = (req as any).auth;

    const useCase = new RecalculateRouteEta();
    const result = await useCase.execute(body, auth);

    res.json(result);
  };
}