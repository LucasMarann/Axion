import { Router } from "express";
import { DeliveriesController } from "./controllers/deliveries-controller.js";
import { requireAuth } from "../../../middlewares/require-auth.js";
import { requireRole } from "../../../middlewares/require-role.js";

export function deliveriesRoutes() {
  const router = Router();
  const controller = new DeliveriesController();

  // CLIENT/OWNER podem consultar entrega por tracking (o isolamento real vem do RLS + vínculo)
  router.get(
    "/:trackingCode",
    requireAuth(),
    requireRole(["CLIENT", "OWNER"]),
    controller.getByTracking
  );

  return router;
}