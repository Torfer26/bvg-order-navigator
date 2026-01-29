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
  BarChart3,
  Send,
  AlertOctagon,
  Check
} from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { OrderStatusBadge, DLQStatusBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { fetchDashboardKPIs, fetchOrders, fetchDLQOrders, getAutomationStats, fetchEmailStats, approveOrderForFTP, getSystemHealthStatus } from '@/lib/ordersService';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, formatDistanceToNow } from 'date-fns';
import { es, it } from 'date-fns/locale';
import type { OrderIntake, DLQOrder, DashboardKPIs } from '@/types';
import { toast } from 'sonner';

export default function Dashboard() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;

  const [kpis, setKpis] = useState<DashboardKPIs>({ ordersToday: 0, ordersWeek: 0, errorRate: 0, pendingDLQ: 0, avgProcessingTime: 0, successRate: 100 });
  const [allOrders, setAllOrders] = useState<OrderIntake[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderIntake[]>([]);
  const [pendingDLQ, setPendingDLQ] = useState<DLQOrder[]>([]);
  const [automationStats, setAutomationStats] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<{
    overall: 'healthy' | 'degraded' | 'down' | 'unknown';
    services: {
      n8n: { status: string; message: string; responseTime?: number };
      database: { status: string; message: string; responseTime?: number };
    };
    lastCheck: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        await refreshDashboard(false);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const refreshDashboard = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [kpisData, ordersData, dlqData, autoStats, healthStatus] = await Promise.all([
        fetchDashboardKPIs(),
        fetchOrders(),
        fetchDLQOrders(),
        getAutomationStats(),
        getSystemHealthStatus(),
      ]);
      setKpis(kpisData);
      setAllOrders(ordersData);
      setRecentOrders(ordersData.slice(0, 5));
      setPendingDLQ(dlqData.filter((o) => !o.resolved).slice(0, 5));
      setAutomationStats(autoStats);
      setSystemHealth(healthStatus);
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleQuickApprove = async (e: React.MouseEvent, order: OrderIntake) => {
    e.preventDefault(); // Prevent link navigation
    e.stopPropagation();

    if (approvingIds.has(order.id)) return;

    setApprovingIds(prev => new Set(prev).add(order.id));

    try {
      const result = await approveOrderForFTP(order.id);
      if (result.success) {
        toast.success(`Pedido ${order.orderCode} aprobado y enviado`);

        // Optimistic UI Update within Dashboard
        setRecentOrders(prev => prev.map(o =>
          o.id === order.id ? { ...o, status: 'PROCESSING' } : o
        ));

        // Background refresh to sync everything
        setTimeout(() => refreshDashboard(false), 2000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al aprobar el pedido');
    } finally {
      setApprovingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(order.id);
        return newSet;
      });
    }
  };

  const getSystemHealth = () => {
    // Check real system health first
    if (systemHealth) {
      if (systemHealth.overall === 'down') {
        const downServices = [];
        if (systemHealth.services.n8n.status === 'down') downServices.push('n8n');
        if (systemHealth.services.database.status === 'down') downServices.push('Base de datos');
        return {
          status: 'critical',
          title: 'Sistema No Disponible',
          message: `Servicios caídos: ${downServices.join(', ')}`,
          color: 'bg-destructive text-destructive-foreground border-destructive',
          icon: AlertOctagon
        };
      }
      if (systemHealth.overall === 'degraded') {
        return {
          status: 'warning',
          title: 'Sistema Degradado',
          message: systemHealth.services.n8n.message || 'Algunos servicios no responden correctamente.',
          color: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: AlertTriangle
        };
      }
    }

    // Then check business metrics
    if (kpis.pendingDLQ > 0 || kpis.errorRate > 10) {
      return {
        status: 'warning',
        title: t.common?.attentionRequired || 'Atención Requerida',
        message: `${kpis.pendingDLQ} pedidos en DLQ requieren revisión manual.`,
        color: 'bg-destructive/10 text-destructive border-destructive/20',
        icon: AlertOctagon
      };
    }
    if (kpis.ordersToday > kpis.ordersWeek / 7 * 1.5) {
      return {
        status: 'info',
        title: 'Alta Actividad',
        message: `El volumen hoy (${kpis.ordersToday}) es superior al promedio. Sistema estable.`,
        color: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: TrendingUp
      };
    }
    
    // Build healthy message with n8n status info
    const n8nStatus = systemHealth?.services.n8n.message || '';
    const dbTime = systemHealth?.services.database.responseTime;
    const dbInfo = dbTime ? ` BD: ${dbTime}ms.` : '';
    
    return {
      status: 'healthy',
      title: 'Sistema Operativo',
      message: n8nStatus ? `${n8nStatus}${dbInfo}` : `Todos los servicios funcionando.${dbInfo}`,
      color: 'bg-green-50 text-green-700 border-green-200',
      icon: CheckCircle2
    };
  };

  // Format processing time with proper decimals or N/A
  const formatProcessingTime = (minutes: number): string => {
    if (minutes === 0) return 'N/A';
    if (minutes < 1) return `${(minutes * 60).toFixed(0)}s`;
    if (minutes < 60) return `${minutes.toFixed(1)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const health = getSystemHealth();
  const HealthIcon = health.icon;

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

      {/* System Health Banner (Actionable Insight) */}
      <div className={`flex items-start gap-4 rounded-lg border p-4 ${health.color}`}>
        <HealthIcon className="mt-1 h-5 w-5 shrink-0" />
        <div>
          <h3 className="font-semibold">{health.title}</h3>
          <p className="text-sm opacity-90">{health.message}</p>
        </div>
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
          value={formatProcessingTime(kpis.avgProcessingTime)}
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
        {/* Recent Orders - Now with Inline Actions */}
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
                className="group flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/50"
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

                <div className="flex items-center gap-3">
                  {/* Quick Action Button - Visible on valid states */}
                  {(['VALIDATING', 'IN_REVIEW', 'RECEIVED'].includes(order.status || '')) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 opacity-0 transition-opacity group-hover:opacity-100 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
                      onClick={(e) => handleQuickApprove(e, order)}
                      disabled={approvingIds.has(order.id)}
                    >
                      {approvingIds.has(order.id) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-1 text-xs">
                          <Send className="h-3 w-3" /> Aprobar
                        </span>
                      )}
                    </Button>
                  )}

                  <span className="shrink-0 text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(order.receivedAt), { addSuffix: true, locale: dateLocale })}
                  </span>
                </div>
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
                    {formatDistanceToNow(new Date(dlq.createdAt), { addSuffix: true, locale: dateLocale })}
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
