import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

type Point = { lat: number; lng: number; capturedAt: string };
type Stop = { lat: number; lng: number; startedAt: string; endedAt: string; durationSeconds: number };

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function normalize(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dx = Math.max(1e-9, maxX - minX);
  const dy = Math.max(1e-9, maxY - minY);

  return points.map((p) => ({
    x: clamp01((p.x - minX) / dx),
    y: clamp01((p.y - minY) / dy),
  }));
}

function toXY(lat: number, lng: number) {
  // Projeção simples (não-geográfica) para visualização “map-like”
  return { x: lng, y: -lat };
}

export default function SimplifiedRouteMap({
  planned,
  executedPoints,
  stops,
  className,
}: {
  planned: { originName: string; destinationName: string };
  executedPoints: Point[];
  stops: Stop[];
  className?: string;
}) {
  const { polyline, stopDots } = useMemo(() => {
    if (!executedPoints.length) return { polyline: "", stopDots: [] as { cx: number; cy: number }[] };

    const raw = executedPoints.map((p) => toXY(p.lat, p.lng));
    const norm = normalize(raw);

    const pad = 14;
    const w = 360;
    const h = 180;

    const toSvg = (p: { x: number; y: number }) => ({
      x: pad + p.x * (w - pad * 2),
      y: pad + p.y * (h - pad * 2),
    });

    const pts = norm.map(toSvg);
    const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    const stopRaw = stops.map((s) => toXY(s.lat, s.lng));
    const stopNorm = stopRaw.length ? normalize(stopRaw) : [];
    const stopDots = stopNorm.map((p) => {
      const sp = toSvg(p);
      return { cx: sp.x, cy: sp.y };
    });

    return { polyline: poly, stopDots };
  }, [executedPoints, stops]);

  return (
    <div className={cn("rounded-lg border bg-card p-4 text-card-foreground", className)}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium">Mapa simplificado</div>
        <div className="text-xs text-muted-foreground">
          {planned.originName} → {planned.destinationName}
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border bg-background">
        <svg viewBox="0 0 360 180" className="h-[180px] w-full">
          <rect x="0" y="0" width="360" height="180" fill="transparent" />

          {polyline ? (
            <polyline points={polyline} fill="none" stroke="rgb(59,130,246)" strokeWidth="2.5" />
          ) : (
            <text x="14" y="24" fill="rgb(107,114,128)" fontSize="12">
              Sem pontos suficientes para exibir.
            </text>
          )}

          {stopDots.map((d, idx) => (
            <circle key={idx} cx={d.cx} cy={d.cy} r="4" fill="rgb(239,68,68)" opacity="0.9" />
          ))}
        </svg>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Visualização aproximada (sem mapa real). Para o cliente, o backend já aplica delay e redução de precisão.
      </div>
    </div>
  );
}