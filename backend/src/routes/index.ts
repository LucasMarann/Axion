import type { Express } from "express";
import { healthRoutes } from "./health.routes.js";
import { identityRoutes } from "../modules/identity/infra/http/routes.js";

export function registerRoutes(app: Express) {
  app.use("/health", healthRoutes());
  app.use("/v1/identity", identityRoutes());
}