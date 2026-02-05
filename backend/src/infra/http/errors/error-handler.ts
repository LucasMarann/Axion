import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "./http-error.js";

export function errorHandler(): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const requestId = req.headers["x-request-id"];

    if (err instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        requestId,
        details: err.flatten(),
      });
    }

    if (err instanceof HttpError) {
      return res.status(err.status).json({
        error: err.message,
        code: err.code ?? "HTTP_ERROR",
        requestId,
        details: err.details ?? null,
      });
    }

    // eslint-disable-next-line no-console
    console.error("[error-handler] unexpected error", { err, requestId });

    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      requestId,
    });
  };
}