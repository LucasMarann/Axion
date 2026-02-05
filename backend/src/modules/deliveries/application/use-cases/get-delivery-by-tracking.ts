import { z } from "zod";
import type { AuthContext } from "../../../middlewares/require-auth.js";
import { HttpError } from "../../../infra/http/errors/http-error.js";
import { createSupabaseUserClient } from "../../../config/supabase.js";

const InputSchema = z.object({
  trackingCode: z.string().min(3),
});

export type GetDeliveryByTrackingInput = z.infer<typeof InputSchema>;

export class GetDeliveryByTracking {
  async execute(input: GetDeliveryByTrackingInput, auth: AuthContext) {
    const parsed = InputSchema.parse(input);

    // Isolamento forte: query usando o JWT do usuário (RLS do Supabase).
    const supabase = createSupabaseUserClient(auth.accessToken);

    // OWNER pode buscar qualquer entrega (desde que policies permitam).
    // CLIENT só pode ver o que está vinculado a ele (policies devem refletir isso).
    // Aqui a aplicação só reforça o comportamento; o banco garante via RLS.
    const { data, error } = await supabase
      .from("deliveries")
      .select("id, tracking_code, status, origin_name, destination_name, recipient_name, created_at, delivered_at, route_id")
      .eq("tracking_code", parsed.trackingCode)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new HttpError("Not found", 404, { code: "NOT_FOUND" });

    // Reforço adicional (defesa em profundidade) quando necessário.
    if (auth.role === "CLIENT") {
      // Para ficar 100% correto, precisamos de um vínculo (ex: deliveries.client_user_id)
      // ou tabela de relacionamento. Hoje não está no schema exibido, então o banco (RLS)
      // é quem deve negar o SELECT. Se chegou aqui, retornamos normalmente.
    }

    return { delivery: data };
  }
}