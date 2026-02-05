import type { RequestHandler } from "express";
import crypto from "crypto";

export function requestId(): RequestHandler {
  return (req, res, next) => {
    const existing = req.headers["x-request-id"];
    const id =
      typeof existing === "string" && existing.trim().length > 0
        ? existing.trim()
        : crypto.randomUUID();

    res.setHeader("x-request-id", id);
    (req as any).requestId = id;

    next();
  };
}