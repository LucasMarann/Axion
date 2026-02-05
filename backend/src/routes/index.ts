import type { Express } from "express";
import { healthRoutes } from "./health.routes.js";
import { identityRoutes } from "../modules/identity/infra/http/routes.js";
import { authRoutes } from "../modules/auth/infra/http/routes.js";
import { deliveriesRoutes } from "../modules/deliveries/infra/http/routes.js";
import { trackingRoutes } from "../modules/tracking/infra/http/routes.js";

export function registerRoutes(app: Express) {
  app.use("/health", healthRoutes());
  app.use("/v1/auth", authRoutes());
  app.use("/v1/identity", identityRoutes());
  app.use("/v1/deliveries", deliveriesRoutes());
  app.use("/v1/tracking", trackingRoutes());
}