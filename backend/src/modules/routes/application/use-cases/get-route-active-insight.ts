import { z } from "zod";
import { HttpError } from "../../../infra/http/errors/http-error.js";
import { createSupabaseUserClient } from "../../../config/supabase.js";
import type { AuthContext } from "../../../middlewares/require-auth.js";

const InputSchema = z.object({
  routeId: z.string().uuid(),
});

export type GetRouteActiveInsightInput = z.infer<typeof InputSchema>;

export class GetRouteActiveInsight {
  async execute(input: GetRouteActiveInsightInput, auth: AuthContext) {
    const parsed = InputSchema.parse(input);
    const supabase = createSupabaseUserClient(auth.accessToken);

    const { data, error } = await supabase
      .from("route_insights")
      .select("route_id, generated_at, insight, kind, features")
      .eq("route_id", parsed.routeId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new HttpError("Not found", 404, { code: "NOT_FOUND" });

    return { activeInsight: data };
  }
}