import { apiFetch } from "@/lib/api/http";
import type { DeliveryStatus, RiskLevel } from "@/lib/status/status";

export type Delivery = {
  id: string;
  tracking_code: string;
  status: DeliveryStatus;
  origin_name: string;
  destination_name: string;
  recipient_name: string;
  created_at: string;
  delivered_at: string | null;
  route_id: string | null;
};

export async function getDeliveryByTracking(trackingCode: string) {
  return apiFetch<{ delivery: Delivery }>(`/v1/deliveries/${encodeURIComponent(trackingCode)}`);
}

export async function dashboardAccessed() {
  return apiFetch<{ ok: boolean }>(`/v1/metrics/dashboard-accessed`, { method: "POST" });
}

export type ActiveInsight = {
  route_id: string;
  generated_at: string;
  insight: string;
  kind: string;
  features: Record<string, any>;
};

export async function getRouteInsight(routeId: string) {
  return apiFetch<{ activeInsight: ActiveInsight }>(`/v1/routes/${routeId}/insight`);
}

export type AiInsight = {
  id: string;
  route_id: string;
  generated_at: string;
  eta_at: string | null;
  risk_level: RiskLevel | "normal" | "em_risco" | "atrasada";
  summary: string;
  features: Record<string, any>;
  model_version: string;
};

export async function recalcEta(input: {
  routeId: string;
  distanceRemainingKm: number;
  avgSpeedKmh?: number;
  reason?: "MANUAL" | "STATUS_CHANGE" | "SIGNAL_RECOVERED" | "STOP_PROLONGED" | "PERIODIC";
}) {
  return apiFetch<{ recalculated: boolean; insight?: AiInsight; activeInsight?: any }>(`/v1/ai/eta/recalculate`, {
    method: "POST",
    json: input,
  });
}

export async function openNotification(id: string) {
  return apiFetch<{ ok: boolean }>(`/v1/notifications/${id}/open`, { method: "POST" });
}