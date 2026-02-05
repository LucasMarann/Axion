import { Router } from "express";
import { requireAuth } from "../../../middlewares/require-auth.js";
import { NotificationsController } from "./controllers/notifications-controller.js";

export function notificationsRoutes() {
  const router = Router();
  const controller = new NotificationsController();

  router.post("/:id/open", requireAuth(), controller.open);

  return router;
}