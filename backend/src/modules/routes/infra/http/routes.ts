import { Router } from "express";
import { requireAuth } from "../../../middlewares/require-auth.js";
import { requireRole } from "../../../middlewares/require-role.js";
import { RoutesController } from "./controllers/routes-controller.js";

export function routesRoutes() {
  const router = Router();
  const controller = new RoutesController();

  // Visualização de rotas (mínimo: CLIENT e OWNER)
  router.get("/:routeId/view", requireAuth(), requireRole(["OWNER", "CLIENT"]), controller.view);

  return router;
}