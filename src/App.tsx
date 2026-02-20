import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";

// Critical path: eager load
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";

// Lazy load: secondary pages (Analytics, masters, monitoring)
const DLQ = lazy(() => import("@/pages/DLQ"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Users = lazy(() => import("@/pages/Users"));
const Clients = lazy(() => import("@/pages/masters/Clients"));
const CustomerEmails = lazy(() => import("@/pages/masters/CustomerEmails"));
const Remitentes = lazy(() => import("@/pages/masters/Remitentes"));
const Holidays = lazy(() => import("@/pages/masters/Holidays"));
const LocationAliases = lazy(() => import("@/pages/masters/LocationAliases"));
const EmailMonitoring = lazy(() => import("@/pages/EmailMonitoring"));
const UnknownClients = lazy(() => import("@/pages/UnknownClients"));
const LogsAndTraceability = lazy(() => import("@/pages/LogsAndTraceability"));
const ExtractionEvaluation = lazy(() => import("@/pages/ExtractionEvaluation"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const PageFallback = () => (
  <div className="flex min-h-[200px] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

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
                <Route path="dlq" element={<Suspense fallback={<PageFallback />}><DLQ /></Suspense>} />
                <Route path="dlq/:id" element={<Suspense fallback={<PageFallback />}><DLQ /></Suspense>} />
                <Route path="analytics" element={<Suspense fallback={<PageFallback />}><Analytics /></Suspense>} />
                <Route path="monitoring/emails" element={<Suspense fallback={<PageFallback />}><EmailMonitoring /></Suspense>} />
                <Route path="monitoring/unknown-clients" element={<Suspense fallback={<PageFallback />}><UnknownClients /></Suspense>} />
                <Route path="monitoring/logs" element={<Suspense fallback={<PageFallback />}><LogsAndTraceability /></Suspense>} />
                <Route path="monitoring/extraction-evaluation" element={<Suspense fallback={<PageFallback />}><ExtractionEvaluation /></Suspense>} />
                <Route path="users" element={<Suspense fallback={<PageFallback />}><Users /></Suspense>} />
                <Route path="masters/clients" element={<Suspense fallback={<PageFallback />}><Clients /></Suspense>} />
                <Route path="masters/customer-emails" element={<Suspense fallback={<PageFallback />}><CustomerEmails /></Suspense>} />
                <Route path="masters/remitentes" element={<Suspense fallback={<PageFallback />}><Remitentes /></Suspense>} />
                <Route path="masters/holidays" element={<Suspense fallback={<PageFallback />}><Holidays /></Suspense>} />
                <Route path="masters/aliases" element={<Suspense fallback={<PageFallback />}><LocationAliases /></Suspense>} />
              </Route>
              <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
