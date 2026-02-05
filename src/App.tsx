import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Index from "@/pages/index";
import Login from "@/pages/login";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}