import { Router } from "express";
import { requireAuth } from "../../../middlewares/require-auth.js";
import { requireRole } from "../../../middlewares/require-role.js";
import { AiController } from "./controllers/ai-controller.js";

export function aiRoutes() {
  const router = Router();
  const controller = new AiController();

  // Endpoint interno para operação (OWNER/MANAGER)
  router.post("/eta/recalculate", requireAuth(), requireRole(["OWNER"]), controller.recalcEta);

  return router;
}