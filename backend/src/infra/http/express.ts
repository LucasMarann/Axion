import express from "express";
import cors from "cors";
import helmet from "helmet";
import { requestId } from "../../middlewares/request-id.js";
import { errorHandler } from "./errors/error-handler.js";
import { registerRoutes } from "../../routes/index.js";

export function createHttpServer() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestId());

  registerRoutes(app);

  app.use(errorHandler());

  return { app };
}