import { createHttpServer } from "./infra/http/express.js";

export function createApp() {
  return createHttpServer().app;
}