import type { RequestHandler } from "express";
import { HttpError } from "../infra/http/errors/http-error.js";
import type { AuthContext } from "./require-auth.js";
import type { Role } from "../modules/auth/domain/roles.js";

export function requireRole(allow: Role[]): RequestHandler {
  return (req, _res, next) => {
    const auth = (req as any).auth as AuthContext | undefined;
    if (!auth?.userId) return next(new HttpError("Unauthorized", 401, { code: "UNAUTHORIZED" }));
    if (!auth.role) return next(new HttpError("Forbidden", 403, { code: "FORBIDDEN" }));
    if (!allow.includes(auth.role)) return next(new HttpError("Forbidden", 403, { code: "FORBIDDEN" }));
    return next();
  };
}