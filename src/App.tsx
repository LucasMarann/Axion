import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Index from "@/pages/index";
import Login from "@/pages/login";
import OwnerDashboard from "@/pages/owner-dashboard";
import OwnerUsers from "@/pages/owner-users";
import RequireRole from "@/components/auth/require-role";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />

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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}