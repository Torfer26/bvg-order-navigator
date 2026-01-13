import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  ArrowRight,
  Activity,
  Loader2,
  Mail,
  Zap,
  GitBranch,
  BarChart3
} from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { OrderStatusBadge, DLQStatusBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { fetchDashboardKPIs, fetchOrders, fetchDLQOrders, getAutomationStats, fetchEmailStats } from '@/lib/ordersService';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import type { OrderIntake, DLQOrder, DashboardKPIs } from '@/types';

export default function Dashboard() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;
  
  const [kpis, setKpis] = useState<DashboardKPIs>({ ordersToday: 0, ordersWeek: 0, errorRate: 0, pendingDLQ: 0, avgProcessingTime: 0, successRate: 100 });
  const [allOrders, setAllOrders] = useState<OrderIntake[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderIntake[]>([]);
  const [pendingDLQ, setPendingDLQ] = useState<DLQOrder[]>([]);
  const [automationStats, setAutomationStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [kpisData, ordersData, dlqData, autoStats] = await Promise.all([
          fetchDashboardKPIs(),
          fetchOrders(),
          fetchDLQOrders(),
          getAutomationStats(),
        ]);
        setKpis(kpisData);
        setAllOrders(ordersData);
        setRecentOrders(ordersData.slice(0, 5));
        setPendingDLQ(dlqData.filter((o) => !o.resolved).slice(0, 5));
        setAutomationStats(autoStats);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">{t.dashboard.title}</h1>
        <p className="page-description">{t.dashboard.subtitle}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t.dashboard.ordersToday}
          value={kpis.ordersToday}
          icon={FileText}
          subtitle={`${kpis.ordersWeek} ${t.dashboard.last7days}`}
        />
        <KPICard
          title={t.dashboard.successRate}
          value={`${kpis.successRate.toFixed(1)}%`}
          icon={CheckCircle2}
          trend={{ value: 2.5, isPositive: true }}
          iconClassName="bg-success/10"
        />
        <KPICard
          title={t.dashboard.avgTime}
          value={`${kpis.avgProcessingTime}m`}
          icon={Clock}
          subtitle={t.dashboard.orderProcessing}
          iconClassName="bg-info/10"
        />
        <KPICard
          title={t.dashboard.pendingDLQ}
          value={kpis.pendingDLQ}
          icon={AlertTriangle}
          subtitle={t.dashboard.toResolve}
          iconClassName={kpis.pendingDLQ > 0 ? 'bg-destructive/10' : 'bg-success/10'}
        />
      </div>

      {/* Automation Monitoring Section */}
      {automationStats && (
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title flex items-center gap-2">
              <Zap className="h-5 w-5 text-warning" />
              Monitorización de Automatización
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 p-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                Emails Procesados
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{automationStats.emailsProcessedToday}</span>
                <span className="text-sm text-muted-foreground">hoy</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {automationStats.orderEmailsToday} pedidos, {automationStats.nonOrderEmailsToday} otros
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitBranch className="h-4 w-4" />
                Pasos de Automatización
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{automationStats.automationStepsToday}</span>
                <span className="text-sm text-muted-foreground">pasos</span>
              </div>
              <div className="text-xs text-success">
                {automationStats.successfulSteps} exitosos
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                Tasa de Éxito
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold">
                  {automationStats.automationSuccessRate.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {automationStats.errorSteps} errores, {automationStats.warnSteps} advertencias
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" />
                Eventos del Sistema
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{automationStats.eventsToday}</span>
                <span className="text-sm text-muted-foreground">eventos</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Actividad del sistema
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {t.dashboard.recentOrders}
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/orders" className="gap-1">
                {t.dashboard.viewAll}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{order.orderCode}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {order.clientName} • {order.linesCount} {t.dashboard.lines}
                  </p>
                </div>
                <span className="ml-4 shrink-0 text-sm text-muted-foreground">
                  {format(new Date(order.receivedAt), 'HH:mm', { locale: dateLocale })}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Pending DLQ */}
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t.dashboard.dlqToResolve}
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dlq" className="gap-1">
                {t.dashboard.viewAll}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          {pendingDLQ.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-success/50" />
              <p className="mt-3 font-medium">{t.dashboard.noPendingIssues}</p>
              <p className="text-sm text-muted-foreground">{t.dashboard.allOrdersProcessed}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingDLQ.map((dlq) => (
                <Link
                  key={dlq.id}
                  to={`/dlq/${dlq.id}`}
                  className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{dlq.orderCode}</span>
                      <StatusBadge status="error" label={dlq.errorCode} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {dlq.clientName} • {dlq.retryCount} {t.dashboard.attempts}
                    </p>
                  </div>
                  <span className="ml-4 shrink-0 text-sm text-muted-foreground">
                    {format(new Date(dlq.createdAt), 'dd/MM HH:mm', { locale: dateLocale })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t.dashboard.quickStats}
          </h2>
        </div>
        <div className="grid gap-6 p-5 sm:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t.dashboard.pendingOrders}</p>
            <p className="mt-1 text-2xl font-semibold">
              {allOrders.filter((o) => o.status === 'pending').length}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t.dashboard.processing}</p>
            <p className="mt-1 text-2xl font-semibold">
              {allOrders.filter((o) => o.status === 'processing').length}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t.dashboard.errorRate7d}</p>
            <p className="mt-1 text-2xl font-semibold">
              {kpis.errorRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
