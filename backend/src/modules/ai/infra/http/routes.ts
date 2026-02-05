import { Router } from "express";
import { requireAuth } from "../../../middlewares/require-auth.js";
import { requireRole } from "../../../middlewares/require-role.js";
import { AiController } from "./controllers/ai-controller.js";
import { RiskController } from "./controllers/risk-controller.js";

export function aiRoutes() {
  const router = Router();
  const controller = new AiController();
  const risk = new RiskController();

  // Endpoint interno para operação (OWNER)
  router.post("/eta/recalculate", requireAuth(), requireRole(["OWNER"]), controller.recalcEta);

  // Endpoint interno para avaliar risco (OWNER)
  router.post("/risk/evaluate", requireAuth(), requireRole(["OWNER"]), risk.evaluate);

  return router;
}