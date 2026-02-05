import type { RequestHandler } from "express";
import { GetMe } from "../../../application/use-cases/get-me.js";

export class UsersController {
  me: RequestHandler = async (_req, res) => {
    const useCase = new GetMe();
    const result = await useCase.execute();

    res.json(result);
  };
}