export type DeliveryStatus = "COLLECTED" | "IN_TRANSIT" | "STOPPED" | "DELIVERED";
export type RiskLevel = "NORMAL" | "AT_RISK" | "DELAYED";

export type StatusVariant = "default" | "secondary" | "destructive" | "outline";

export function deliveryStatusLabel(s: DeliveryStatus) {
  if (s === "COLLECTED") return "Coletado";
  if (s === "IN_TRANSIT") return "Em trânsito";
  if (s === "STOPPED") return "Parada";
  if (s === "DELIVERED") return "Entregue";
  return s;
}

export function deliveryStatusVariant(s: DeliveryStatus): StatusVariant {
  if (s === "DELIVERED") return "secondary";
  if (s === "STOPPED") return "destructive";
  if (s === "IN_TRANSIT") return "default";
  return "outline";
}

export function riskLabel(r: RiskLevel) {
  if (r === "NORMAL") return "Normal";
  if (r === "AT_RISK") return "Em risco";
  if (r === "DELAYED") return "Atrasada";
  return r;
}

export function riskVariant(r: RiskLevel): StatusVariant {
  if (r === "DELAYED") return "destructive";
  if (r === "AT_RISK") return "default";
  return "secondary";
}