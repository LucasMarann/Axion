import { z } from "zod";
import { createSupabaseAnonClient } from "../../../config/supabase.js";
import { HttpError } from "../../../infra/http/errors/http-error.js";

const InputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginWithPasswordInput = z.infer<typeof InputSchema>;

export class LoginWithPassword {
  async execute(input: LoginWithPasswordInput) {
    const parsed = InputSchema.parse(input);

    const supabase = createSupabaseAnonClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (error) {
      throw new HttpError("Invalid credentials", 401, { code: "INVALID_CREDENTIALS" });
    }

    if (!data.session) {
      throw new HttpError("Invalid credentials", 401, { code: "INVALID_CREDENTIALS" });
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      tokenType: "bearer",
      user: {
        id: data.user?.id ?? null,
        email: data.user?.email ?? null,
      },
    };
  }
}