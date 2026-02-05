import type { RequestHandler } from "express";
import { HttpError } from "../infra/http/errors/http-error.js";
import { createSupabaseUserClient } from "../config/supabase.js";

type AuthContext = {
  userId: string;
  accessToken: string;
  role: "CLIENT" | "OWNER" | "DRIVER" | null;
  profile: { id: string; role: string | null; full_name: string | null } | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __authContext: never;
}

export function requireAuth(): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization;

    if (!header || !header.toLowerCase().startsWith("bearer ")) {
      return next(new HttpError("Unauthorized", 401, { code: "UNAUTHORIZED" }));
    }

    const accessToken = header.slice("bearer ".length).trim();
    if (!accessToken) {
      return next(new HttpError("Unauthorized", 401, { code: "UNAUTHORIZED" }));
    }

    const supabase = createSupabaseUserClient(accessToken);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user?.id) {
      return next(new HttpError("Unauthorized", 401, { code: "UNAUTHORIZED" }));
    }

    const userId = userData.user.id;

    // role vem do banco (profiles) para não depender de user_metadata (mais fácil de administrar e auditar)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) return next(profileError);

    let role: AuthContext["role"] = null;
    if (profile?.role === "client") role = "CLIENT";
    if (profile?.role === "owner") role = "OWNER";
    if (profile?.role === "driver") role = "DRIVER";

    (req as any).auth = {
      userId,
      accessToken,
      role,
      profile: profile ? { id: profile.id, role: profile.role ?? null, full_name: profile.full_name ?? null } : null,
    } satisfies AuthContext;

    return next();
  };
}

export type { AuthContext };