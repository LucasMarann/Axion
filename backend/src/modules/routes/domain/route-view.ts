import { getVisibilityConfig, roundCoord, type ViewerRole } from "../../tracking/domain/visibility.js";

export type RoutePlannedView = {
  routeId: string;
  code: string;
  originName: string;
  destinationName: string;
  plannedStartAt: string | null;
};

export type RouteExecutedPoint = {
  capturedAt: string;
  lat: number;
  lng: number;
};

export type RouteStopView = {
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  lat: number;
  lng: number;
};

export type RouteView = {
  planned: RoutePlannedView;
  executed: {
    delaySecondsApplied: number;
    points: RouteExecutedPoint[];
  };
  stops: {
    delaySecondsApplied: number;
    items: RouteStopView[];
  };
};

export function sanitizeExecutedPoints(points: RouteExecutedPoint[], role: ViewerRole) {
  const { precisionDecimals } = getVisibilityConfig(role);
  return points.map((p) => ({
    ...p,
    lat: roundCoord(p.lat, precisionDecimals),
    lng: roundCoord(p.lng, precisionDecimals),
  }));
}

export function sanitizeStops(stops: RouteStopView[], role: ViewerRole) {
  const { precisionDecimals } = getVisibilityConfig(role);
  return stops.map((s) => ({
    ...s,
    lat: roundCoord(s.lat, precisionDecimals),
    lng: roundCoord(s.lng, precisionDecimals),
  }));
}