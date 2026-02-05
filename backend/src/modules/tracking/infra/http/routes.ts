import { Router } from "express";
import { TrackingController } from "./controllers/tracking-controller.js";
import { requireAuth } from "../../../middlewares/require-auth.js";
import { requireRole } from "../../../middlewares/require-role.js";

export function trackingRoutes() {
  const router = Router();
  const controller = new TrackingController();

  // Motorista envia localização
  router.post("/location", requireAuth(), requireRole(["DRIVER"]), controller.ingestLocation);

  // Owner/Client consultam última localização conforme visibilidade
  router.get(
    "/route/:routeId/latest",
    requireAuth(),
    requireRole(["OWNER", "CLIENT"]),
    controller.latestRouteLocation
  );

  return router;
}