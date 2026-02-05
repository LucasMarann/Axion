export type UserRole = "owner" | "client" | "manager" | "driver";

export function isInternalRole(role: UserRole | null | undefined) {
  return role === "owner" || role === "manager" || role === "driver";
}