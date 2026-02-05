import type { RequestHandler } from "express";
import { trackEventAsync } from "../../../metrics/application/track-event.js";

export class MetricsController {
  dashboardAccessed: RequestHandler = async (req, res) => {
    const auth = (req as any).auth;

    trackEventAsync(
      {
        eventName: "DASHBOARD_ACCESSED",
        userId: auth?.userId ?? null,
        properties: { role: auth?.role ?? null },
        source: "backend",
      },
      auth.accessToken,
      "metrics-controller"
    );

    res.json({ ok: true });
  };
}