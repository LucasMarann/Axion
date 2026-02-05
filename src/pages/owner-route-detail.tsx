import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "@/components/layout/app-layout";
import PageHeader from "@/components/common/page-header";
import LoadingBlock from "@/components/common/loading-block";
import EmptyState from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRouteInsight, getRouteView, type ActiveInsight, type RouteView } from "@/lib/api/endpoints";
import SimplifiedRouteMap from "@/components/tracking/simplified-route-map";
import InsightCard from "@/components/ai/insight-card";
import StatusBadge from "@/components/status/status-badge";
import { toast } from "@/components/ui/use-toast";

export default function OwnerRouteDetail() {
  const params = useParams();
  const routeId = params.routeId ?? "";

  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<RouteView | null>(null);
  const [insight, setInsight] = useState<ActiveInsight | null>(null);

  const stopsSorted = useMemo(() => {
    const items = view?.stops?.items ?? [];
    return [...items].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [view]);

  useEffect(() => {
    let alive = true;

    Promise.resolve()
      .then(async () => {
        setIsLoading(true);
        const [v, i] = await Promise.all([getRouteView(routeId), getRouteInsight(routeId)]);
        if (!alive) return;
        setView(v);
        setInsight(i.activeInsight);
      })
      .catch((err: any) => {
        if (!alive) return;
        toast({
          title: "Não foi possível carregar a rota",
          description: err?.message ?? "Tente novamente.",
          variant: "destructive",
        });
        setView(null);
        setInsight(null);
      })
      .finally(() => {
        if (!alive) return;
        setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [routeId]);

  return (
    <AppLayout
      title="Owner • Detalhe da rota"
      rightSlot={
        <Button asChild size="sm" variant="secondary">
          <Link to="/owner">Voltar</Link>
        </Button>
      }
    >
      <PageHeader
        title="Detalhe da rota"
        description="Visão operacional com pontos executados, paradas relevantes e insight do MVP."
      />

      {isLoading ? (
        <div className="mt-6">
          <LoadingBlock label="Carregando rota..." />
        </div>
      ) : null}

      {!isLoading && !view ? (
        <div className="mt-6">
          <EmptyState title="Rota não encontrada" description="Verifique o routeId e tente novamente." />
        </div>
      ) : null}

      {!isLoading && view ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={`Código: ${view.planned.code}`} variant="outline" />
                <StatusBadge label={`Delay aplicado: ${view.executed.delaySecondsApplied}s`} variant="secondary" />
              </div>

              <div className="text-sm text-muted-foreground">
                Origem: <span className="text-foreground">{view.planned.originName}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Destino: <span className="text-foreground">{view.planned.destinationName}</span>
              </div>
            </CardContent>
          </Card>

          <InsightCard
            title="Insight ativo"
            description="1 insight por rota (MVP) — acionável e simples."
            insight={insight ? { generated_at: insight.generated_at, insight: insight.insight } : null}
          />

          <div className="lg:col-span-3">
            <SimplifiedRouteMap
              planned={{ originName: view.planned.originName, destinationName: view.planned.destinationName }}
              executedPoints={view.executed.points}
              stops={view.stops.items}
            />
          </div>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Paradas relevantes</CardTitle>
            </CardHeader>
            <CardContent>
              {stopsSorted.length ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {stopsSorted.map((s, idx) => (
                    <div key={idx} className="rounded-md border bg-background p-3">
                      <div className="text-sm font-medium">
                        {Math.round(s.durationSeconds / 60)} min parado
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Início: {new Date(s.startedAt).toLocaleString("pt-BR")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Fim: {new Date(s.endedAt).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Nenhuma parada relevante detectada.</div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AppLayout>
  );
}