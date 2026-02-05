import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/components/auth/auth-provider";
import type { UserRole } from "@/lib/roles";

export default function RequireRole({
  allow,
  children,
}: {
  allow: UserRole[];
  children: React.ReactNode;
}) {
  const { session, isLoading, profile } = useAuth();

  if (isLoading) return null;

  if (!session) return <Navigate to="/login" replace />;

  if (!profile?.role) return <Navigate to="/" replace />;

  if (!allow.includes(profile.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}