import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function InsightCard({
  title = "Insight",
  description,
  insight,
}: {
  title?: string;
  description?: string;
  insight: { generated_at: string; insight: string; kind?: string } | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {insight ? (
          <div className="text-sm">
            <div className="text-muted-foreground">
              Atualizado em: {new Date(insight.generated_at).toLocaleString("pt-BR")}
            </div>
            <div className="mt-2 font-medium">{insight.insight}</div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Sem insight ativo.</div>
        )}
      </CardContent>
    </Card>
  );
}