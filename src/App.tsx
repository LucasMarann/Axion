import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Index from "@/pages/index";
import Login from "@/pages/login";
import OwnerDashboard from "@/pages/owner-dashboard";
import OwnerUsers from "@/pages/owner-users";
import OwnerRouteDetail from "@/pages/owner-route-detail";
import ClientTracking from "@/pages/client-tracking";
import RequireRole from "@/components/auth/require-role";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/client"
        element={
          <RequireRole allow={["client"]}>
            <ClientTracking />
          </RequireRole>
        }
      />

      <Route
        path="/owner"
        element={
          <RequireRole allow={["owner"]}>
            <OwnerDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/owner/users"
        element={
          <RequireRole allow={["owner"]}>
            <OwnerUsers />
          </RequireRole>
        }
      />
      <Route
        path="/owner/routes/:routeId"
        element={
          <RequireRole allow={["owner"]}>
            <OwnerRouteDetail />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}