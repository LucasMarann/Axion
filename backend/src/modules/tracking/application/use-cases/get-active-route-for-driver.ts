import { HttpError } from "../../../infra/http/errors/http-error.js";
import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";

const ACTIVE_STATUSES = new Set(["active", "in_progress", "started", "in_transit"]);

function isActiveStatus(status: unknown) {
  return typeof status === "string" && ACTIVE_STATUSES.has(status.toLowerCase());
}

export class GetActiveRouteForDriver {
  async execute(auth: AuthContext) {
    if (auth.role !== "DRIVER") {
      throw new HttpError("Forbidden", 403, { code: "FORBIDDEN" });
    }

    const supabase = createSupabaseUserClient(auth.accessToken);

    // Encontrar driver_id vinculado ao usuário
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, user_id")
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (driverError) throw driverError;
    if (!driver?.id) throw new HttpError("Driver not found", 404, { code: "DRIVER_NOT_FOUND" });

    // Rota ativa do driver
    const { data: routes, error: routeError } = await supabase
      .from("routes")
      .select("id, status, driver_id")
      .eq("driver_id", driver.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (routeError) throw routeError;

    const active = (routes ?? []).find((r) => isActiveStatus((r as any).status));
    if (!active?.id) throw new HttpError("No active route", 409, { code: "NO_ACTIVE_ROUTE" });

    return { routeId: active.id as string, driverId: driver.id as string };
  }
}