import { Router } from "express";
import { AuthController } from "./controllers/auth-controller.js";
import { requireAuth } from "../../../middlewares/require-auth.js";

export function authRoutes() {
  const router = Router();
  const controller = new AuthController();

  router.post("/login", controller.login);
  router.get("/me", requireAuth(), controller.me);

  return router;
}