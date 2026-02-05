import React, { useMemo, useState } from "react";
import AppLayout from "@/components/layout/app-layout";
import PageHeader from "@/components/common/page-header";
import LoadingBlock from "@/components/common/loading-block";
import EmptyState from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/status/status-badge";
import {
  deliveryStatusLabel,
  deliveryStatusVariant,
  riskLabel,
  riskVariant,
  type RiskLevel,
} from "@/lib/status/status";
import { getDeliveryByTracking, getRouteInsight, getRouteView, type ActiveInsight, type Delivery, type RouteView } from "@/lib/api/endpoints";
import SimplifiedRouteMap from "@/components/tracking/simplified-route-map";
import InsightCard from "@/components/ai/insight-card";
import { toast } from "@/components/ui/use-toast";

function normalizeRisk(v: any): RiskLevel | null {
  if (v === "NORMAL" || v === "AT_RISK" || v === "DELAYED") return v;
  if (v === "normal") return "NORMAL";
  if (v === "em_risco") return "AT_RISK";
  if (v === "atrasada") return "DELAYED";
  return null;
}

export default function ClientTracking() {
  const [trackingCode, setTrackingCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [routeView, setRouteView] = useState<RouteView | null>(null);
  const [activeInsight, setActiveInsight] = useState<ActiveInsight | null>(null);

  const etaText = useMemo(() => {
    const etaAt = (activeInsight as any)?.features?.eta_at ?? (activeInsight as any)?.features?.etaAt ?? null;
    if (!etaAt || typeof etaAt !== "string") return null;
    const d = new Date(etaAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("pt-BR");
  }, [activeInsight]);

  const riskFromInsight = useMemo(() => {
    const r = (activeInsight as any)?.features?.risk ?? (activeInsight as any)?.features?.risk_level ?? null;
    return normalizeRisk(r);
  }, [activeInsight]);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = trackingCode.trim();
    if (code.length < 3) return;

    setIsLoading(true);
    setDelivery(null);
    setRouteView(null);
    setActiveInsight(null);

    try {
      const { delivery } = await getDeliveryByTracking(code);
      setDelivery(delivery);

      if (delivery.route_id) {
        const [view, insight] = await Promise.all([getRouteView(delivery.route_id), getRouteInsight(delivery.route_id)]);
        setRouteView(view);
        setActiveInsight(insight.activeInsight);
      }
    } catch (err: any) {
      toast({
        title: "Não foi possível consultar",
        description: err?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout title="Cliente • Rastreamento">
      <PageHeader
        title="Rastrear entrega"
        description="Digite seu código para ver status, previsão e um mapa simplificado (sem dados sensíveis)."
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Consulta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-sm font-medium">Código de rastreio</label>
              <input
                className="h-10 rounded-md border bg-background px-3 text-sm"
                placeholder="Ex.: ABC123"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                No MVP atual, a consulta exige cliente logado (vamos liberar consulta sem login na próxima etapa).
              </div>
            </div>

            <Button type="submit" disabled={trackingCode.trim().length < 3 || isLoading}>
              {isLoading ? "Buscando..." : "Consultar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="mt-6">
          <LoadingBlock label="Carregando rastreio..." />
        </div>
      ) : null}

      {!isLoading && !delivery ? (
        <div className="mt-6">
          <EmptyState
            title="Nenhuma entrega carregada"
            description="Faça uma consulta pelo código de rastreio."
          />
        </div>
      ) : null}

      {!isLoading && delivery ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={deliveryStatusLabel(delivery.status)}
                  variant={deliveryStatusVariant(delivery.status)}
                />
                {riskFromInsight ? (
                  <StatusBadge label={riskLabel(riskFromInsight)} variant={riskVariant(riskFromInsight)} />
                ) : null}
              </div>

              <div className="text-sm text-muted-foreground">
                Origem: <span className="text-foreground">{delivery.origin_name}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Destino: <span className="text-foreground">{delivery.destination_name}</span>
              </div>

              <div className="mt-2 rounded-md border bg-background p-3">
                <div className="text-xs text-muted-foreground">ETA</div>
                <div className="text-sm font-medium">{etaText ? etaText : "Indisponível no momento"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  A previsão é calculada pela operação e pode atualizar com atraso de segurança.
                </div>
              </div>
            </CardContent>
          </Card>

          <InsightCard
            title="Resumo"
            description="1 insight simples (MVP) para reduzir ansiedade e chamadas."
            insight={activeInsight ? { generated_at: activeInsight.generated_at, insight: activeInsight.insight } : null}
          />

          <div className="lg:col-span-2">
            {routeView ? (
              <SimplifiedRouteMap
                planned={{ originName: routeView.planned.originName, destinationName: routeView.planned.destinationName }}
                executedPoints={routeView.executed.points}
                stops={routeView.stops.items}
              />
            ) : (
              <EmptyState
                title="Mapa indisponível"
                description="Esta entrega ainda não está associada a uma rota com pontos de rastreio."
              />
            )}
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}