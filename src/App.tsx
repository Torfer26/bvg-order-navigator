import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import DLQ from "@/pages/DLQ";
import Analytics from "@/pages/Analytics";
import Users from "@/pages/Users";
import Clients from "@/pages/masters/Clients";
import CustomerEmails from "@/pages/masters/CustomerEmails";
import Remitentes from "@/pages/masters/Remitentes";
import Holidays from "@/pages/masters/Holidays";
import LocationAliases from "@/pages/masters/LocationAliases";
import EmailMonitoring from "@/pages/EmailMonitoring";
import UnknownClients from "@/pages/UnknownClients";
import LogsAndTraceability from "@/pages/LogsAndTraceability";
import ExtractionEvaluation from "@/pages/ExtractionEvaluation";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30s - reduce refetches on quick navigation
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
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
                <Route path="analytics" element={<Analytics />} />
                <Route path="monitoring/emails" element={<EmailMonitoring />} />
                <Route path="monitoring/unknown-clients" element={<UnknownClients />} />
                <Route path="monitoring/logs" element={<LogsAndTraceability />} />
                <Route path="monitoring/extraction-evaluation" element={<ExtractionEvaluation />} />
                <Route path="users" element={<Users />} />
                <Route path="masters/clients" element={<Clients />} />
                <Route path="masters/customer-emails" element={<CustomerEmails />} />
                <Route path="masters/remitentes" element={<Remitentes />} />
                <Route path="masters/holidays" element={<Holidays />} />
                <Route path="masters/aliases" element={<LocationAliases />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
