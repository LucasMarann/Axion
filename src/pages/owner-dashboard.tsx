import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import AppLayout from "@/components/layout/app-layout";
import { dashboardAccessed } from "@/lib/api/endpoints";

export default function OwnerDashboard() {
  const { profile } = useAuth();

  useEffect(() => {
    dashboardAccessed();
  }, []);

  return (
    <AppLayout title="Dashboard (Dono)">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard (Dono)</h1>
        <p className="text-sm text-muted-foreground">
          Bem-vindo{profile?.full_name ? `, ${profile.full_name}` : ""}. Aqui você controla o MVP.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Entregas & rotas</CardTitle>
            <CardDescription>Próximo módulo: criar entregas e acompanhar risco/ETA</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Vamos implementar em seguida: rotas ativas, rotas em risco e detalhes.
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}