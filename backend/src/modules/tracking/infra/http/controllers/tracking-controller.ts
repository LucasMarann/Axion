import type { RequestHandler } from "express";
import { z } from "zod";
import { IngestDriverLocation } from "../../../application/use-cases/ingest-driver-location.js";
import { GetLatestRouteLocation } from "../../../application/use-cases/get-latest-route-location.js";

const IngestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  capturedAt: z.string().datetime().optional(),
  speedKmh: z.number().nonnegative().optional(),
  headingDeg: z.number().min(0).max(360).optional(),
  accuracyM: z.number().nonnegative().optional(),
  source: z.string().min(1).optional(),
  meta: z.record(z.any()).optional(),
});

const LatestParamsSchema = z.object({
  routeId: z.string().uuid(),
});

export class TrackingController {
  ingestLocation: RequestHandler = async (req, res) => {
    const body = IngestSchema.parse(req.body);
    const auth = (req as any).auth;

    const useCase = new IngestDriverLocation();
    const result = await useCase.execute(body, auth);

    res.status(201).json(result);
  };

  latestRouteLocation: RequestHandler = async (req, res) => {
    const { routeId } = LatestParamsSchema.parse(req.params);
    const auth = (req as any).auth;

    const useCase = new GetLatestRouteLocation();
    const result = await useCase.execute({ routeId }, auth);

    res.json(result);
  };
}