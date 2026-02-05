import type { RequestHandler } from "express";
import { z } from "zod";
import { GetRouteView } from "../../../routes/application/use-cases/get-route-view.js";
import { GetRouteActiveInsight } from "../../../routes/application/use-cases/get-route-active-insight.js";

const ParamsSchema = z.object({
  routeId: z.string().uuid(),
});

export class RoutesController {
  view: RequestHandler = async (req, res) => {
    const { routeId } = ParamsSchema.parse(req.params);
    const auth = (req as any).auth;

    const useCase = new GetRouteView();
    const result = await useCase.execute({ routeId }, auth);

    res.json(result);
  };

  activeInsight: RequestHandler = async (req, res) => {
    const { routeId } = ParamsSchema.parse(req.params);
    const auth = (req as any).auth;

    const useCase = new GetRouteActiveInsight();
    const result = await useCase.execute({ routeId }, auth);

    res.json(result);
  };
}