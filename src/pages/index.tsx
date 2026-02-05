import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import AppLayout from "@/components/layout/app-layout";

export default function Index() {
  const { session, profile, isLoading } = useAuth();

  return (
    <AppLayout title="Base do MVP">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Visibilidade Logística (MVP)</h1>
        <p className="text-sm text-muted-foreground">
          Base do projeto com React + TypeScript + Tailwind + Supabase.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Acesso</CardTitle>
            <CardDescription>Login simples (Supabase Auth)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link to="/login">{session ? "Conta" : "Ir para login"}</Link>
            </Button>

            {!isLoading && session && profile?.role === "owner" ? (
              <Button asChild variant="secondary">
                <Link to="/owner">Dashboard do Dono</Link>
              </Button>
            ) : null}

            <Button variant="secondary" asChild>
              <a href="#mvp">Ver módulos do MVP</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximo passo</CardTitle>
            <CardDescription>
              Implementar entregas, rastreio (cliente) e visões (dono/motorista)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              <li>Acesso & Perfis + controle de acesso</li>
              <li>Entregas & timeline</li>
              <li>Visibilidade (delay p/ cliente; quase real-time p/ dono)</li>
              <li>ETA simples + risco + 1 insight</li>
              <li>Métricas essenciais</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div id="mvp" className="mt-10 rounded-lg border bg-card p-4 text-card-foreground">
        <div className="text-sm font-medium">MVP</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Escopo baseado em MVP.md/PRD.md/Features.md (sem implementar fora do MVP).
        </div>
      </div>
    </AppLayout>
  );
}