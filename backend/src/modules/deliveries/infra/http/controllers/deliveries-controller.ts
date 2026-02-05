import type { RequestHandler } from "express";
import { z } from "zod";
import { GetDeliveryByTracking } from "../../../application/use-cases/get-delivery-by-tracking.js";

const ParamsSchema = z.object({
  trackingCode: z.string().min(3),
});

export class DeliveriesController {
  getByTracking: RequestHandler = async (req, res) => {
    const { trackingCode } = ParamsSchema.parse(req.params);
    const auth = (req as any).auth;

    const useCase = new GetDeliveryByTracking();
    const result = await useCase.execute({ trackingCode }, auth);

    res.json(result);
  };
}