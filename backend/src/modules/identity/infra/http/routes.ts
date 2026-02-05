import { Router } from "express";
import { UsersController } from "./controllers/users-controller.js";

export function identityRoutes() {
  const router = Router();
  const usersController = new UsersController();

  router.get("/me", usersController.me);

  return router;
}