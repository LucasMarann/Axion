import type { User } from "../../domain/entities/user.js";

export type UserRepository = {
  findById(id: string): Promise<User | null>;
};