import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import DLQ from "@/pages/DLQ";
import Users from "@/pages/Users";
import Clients from "@/pages/masters/Clients";
import Remitentes from "@/pages/masters/Remitentes";
import Holidays from "@/pages/masters/Holidays";
import LocationAliases from "@/pages/masters/LocationAliases";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:id" element={<OrderDetail />} />
              <Route path="dlq" element={<DLQ />} />
              <Route path="dlq/:id" element={<DLQ />} />
              <Route path="users" element={<Users />} />
              <Route path="masters/clients" element={<Clients />} />
              <Route path="masters/remitentes" element={<Remitentes />} />
              <Route path="masters/holidays" element={<Holidays />} />
              <Route path="masters/aliases" element={<LocationAliases />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
