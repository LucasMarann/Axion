import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import AppLayout from "@/components/layout/app-layout";
import { dashboardAccessed } from "@/lib/api/endpoints";
import StatusBadge from "@/components/status/status-badge";
import { riskLabel, riskVariant, type RiskLevel } from "@/lib/status/status";
import { toast } from "@/components/ui/use-toast";

function normalizeRisk(v: any): RiskLevel | null {
  if (v === "NORMAL" || v === "AT_RISK" || v === "DELAYED") return v;
  if (v === "normal") return "NORMAL";
  if (v === "em_risco") return "AT_RISK";
  if (v === "atrasada") return "DELAYED";
  return null;
}

export default function OwnerDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [routeId, setRouteId] = useState("");

  useEffect(() => {
    dashboardAccessed();
  }, []);

  const riskPreview = useMemo(() => {
    // Sem lista real de rotas, deixamos o dashboard pronto para destacar quando vierem dados.
    return null as RiskLevel | null;
  }, []);

  const onOpenRoute = (e: React.FormEvent) => {
    e.preventDefault();
    const id = routeId.trim();
    if (!id) return;
    // validação leve: UUID tem 36 chars (não é segurança, só UX)
    if (id.length < 30) {
      toast({
        title: "Route ID inválido",
        description: "Cole o UUID completo da rota.",
        variant: "destructive",
      });
      return;
    }
    navigate(`/owner/routes/${encodeURIComponent(id)}`);
  };

  return (
    <AppLayout title="Dashboard (Dono)">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard (Dono)</h1>
        <p className="text-sm text-muted-foreground">
          Bem-vindo{profile?.full_name ? `, ${profile.full_name}` : ""}. Visão rápida da operação.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Operação (MVP)</CardTitle>
            <CardDescription>Alertas críticos e acesso rápido ao detalhe.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label="Owner: visão sem delay (quase real-time)" variant="secondary" />
              {riskPreview ? <StatusBadge label={riskLabel(riskPreview)} variant={riskVariant(riskPreview)} /> : null}
            </div>

            <form onSubmit={onOpenRoute} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-2">
                <label className="text-sm font-medium">Abrir detalhe da rota</label>
                <input
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  placeholder="Cole o routeId (UUID)"
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                />
                <div className="text-xs text-muted-foreground">
                  Enquanto não há lista de rotas ativas, você pode abrir o detalhe por ID.
                </div>
              </div>
              <Button type="submit" disabled={!routeId.trim()}>
                Abrir
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usuários internos</CardTitle>
            <CardDescription>Criar Motoristas e Operadores (manager)</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <Button asChild>
              <Link to="/owner/users">Criar usuário interno</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rotas ativas</CardTitle>
            <CardDescription>Pronto para plugar quando houver endpoint de lista.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Próximo passo: endpoint backend para listar rotas ativas e em risco em 1 tela.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas visuais</CardTitle>
            <CardDescription>Críticos: em risco / atrasada</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            As notificações críticas (RISK_AT_RISK / RISK_DELAYED) já ficam no histórico e podem ser exibidas aqui.
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}