import type { RequestHandler } from "express";
import { z } from "zod";
import { GetDeliveryByTracking } from "../../../application/use-cases/get-delivery-by-tracking.js";
import { CreateDelivery } from "../../../application/use-cases/create-delivery.js";
import { UpdateDeliveryStatus } from "../../../application/use-cases/update-delivery-status.js";
import { DeliveryStatusSchema } from "../../../domain/delivery-status.js";

const TrackingParamsSchema = z.object({
  trackingCode: z.string().min(3),
});

const CreateSchema = z.object({
  trackingCode: z.string().min(3),
  originName: z.string().min(2),
  destinationName: z.string().min(2),
  recipientName: z.string().min(2),
  recipientDocument: z.string().min(3),
  routeId: z.string().uuid().nullable().optional(),
  status: DeliveryStatusSchema.optional(),
});

const StatusParamsSchema = z.object({
  id: z.string().uuid(),
});

const StatusBodySchema = z.object({
  status: DeliveryStatusSchema,
});

export class DeliveriesController {
  create: RequestHandler = async (req, res) => {
    const body = CreateSchema.parse(req.body);
    const auth = (req as any).auth;

    const useCase = new CreateDelivery();
    const result = await useCase.execute(body, auth);

    res.status(201).json(result);
  };

  getByTracking: RequestHandler = async (req, res) => {
    const { trackingCode } = TrackingParamsSchema.parse(req.params);
    const auth = (req as any).auth;

    const useCase = new GetDeliveryByTracking();
    const result = await useCase.execute({ trackingCode }, auth);

    res.json(result);
  };

  updateStatus: RequestHandler = async (req, res) => {
    const { id } = StatusParamsSchema.parse(req.params);
    const body = StatusBodySchema.parse(req.body);
    const auth = (req as any).auth;

    const useCase = new UpdateDeliveryStatus();
    const result = await useCase.execute({ id, status: body.status }, auth);

    res.json(result);
  };
}