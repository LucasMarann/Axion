export type Role = "CLIENT" | "OWNER" | "DRIVER";

export function isRole(value: unknown): value is Role {
  return value === "CLIENT" || value === "OWNER" || value === "DRIVER";
}