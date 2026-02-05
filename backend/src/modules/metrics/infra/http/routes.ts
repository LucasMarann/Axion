import { Router } from "express";
import { requireAuth } from "../../../middlewares/require-auth.js";
import { requireRole } from "../../../middlewares/require-role.js";
import { MetricsController } from "./controllers/metrics-controller.js";

export function metricsRoutes() {
  const router = Router();
  const controller = new MetricsController();

  // Dashboard: apenas OWNER (ou MANAGER se quiser depois)
  router.post("/dashboard-accessed", requireAuth(), requireRole(["OWNER"]), controller.dashboardAccessed);

  return router;
}