import { Router } from "express";
import { requireAuth } from "../../../middlewares/require-auth.js";
import { requireRole } from "../../../middlewares/require-role.js";
import { RoutesController } from "./controllers/routes-controller.js";

export function routesRoutes() {
  const router = Router();
  const controller = new RoutesController();

  router.get("/:routeId/view", requireAuth(), requireRole(["OWNER", "CLIENT"]), controller.view);

  // Insight ativo (CLIENT/OWNER) – o RLS deve controlar acesso por rota
  router.get("/:routeId/insight", requireAuth(), requireRole(["OWNER", "CLIENT"]), controller.activeInsight);

  return router;
}