import { Router } from "express";
import { DeliveriesController } from "./controllers/deliveries-controller.js";
import { requireAuth } from "../../../middlewares/require-auth.js";
import { requireRole } from "../../../middlewares/require-role.js";

export function deliveriesRoutes() {
  const router = Router();
  const controller = new DeliveriesController();

  // POST /deliveries (OWNER)
  router.post("/", requireAuth(), requireRole(["OWNER"]), controller.create);

  // GET /deliveries/:trackingCode (CLIENT/OWNER) - isolamento forte vem do RLS
  router.get("/:trackingCode", requireAuth(), requireRole(["CLIENT", "OWNER"]), controller.getByTracking);

  // PATCH /deliveries/:id/status (OWNER/DRIVER)
  router.patch("/:id/status", requireAuth(), requireRole(["OWNER", "DRIVER"]), controller.updateStatus);

  return router;
}