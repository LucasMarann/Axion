import type { RequestHandler } from "express";
import { z } from "zod";
import { LoginWithPassword } from "../../../application/use-cases/login-with-password.js";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export class AuthController {
  login: RequestHandler = async (req, res) => {
    const body = LoginSchema.parse(req.body);

    const useCase = new LoginWithPassword();
    const result = await useCase.execute(body);

    res.json(result);
  };

  me: RequestHandler = async (req, res) => {
    const auth = (req as any).auth as
      | {
          userId: string;
          role: string | null;
        }
      | undefined;

    res.json({
      userId: auth?.userId ?? null,
      role: auth?.role ?? null,
    });
  };
}