import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Activity,
  Loader2,
  MapPin,
  Send,
  AlertOctagon,
  Eye,
  UserX,
} from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { OrderStatusBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchDashboardKPIs, approveOrderForFTP, getSystemHealthStatus, fetchEmailTriageStats } from '@/lib/ordersService';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { es, it } from 'date-fns/locale';
import type { OrderIntake, DLQOrder, DashboardKPIs } from '@/types';
import { toast } from 'sonner';

export default function Dashboard() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const dateLocale = language === 'es' ? es : it;

  const queryClient = useQueryClient();
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

  const { data: dashboardData, isLoading: loading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardKPIs,
  });
  const { data: healthStatus } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: getSystemHealthStatus,
  });
  const { data: triageData } = useQuery({
    queryKey: ['emailTriageStats'],
    queryFn: fetchEmailTriageStats,
  });

  const kpis = dashboardData?.kpis ?? {
    ordersToday: 0, ordersYesterday: 0, ordersWeek: 0, errorRate: 0, pendingDLQ: 0,
    avgProcessingTime: 0, avgProcessingTimeYesterday: 0, successRate: 100, pendingLocations: 0,
    ordersInValidation: 0, ordersProcessing: 0, ordersReceived: 0, ordersRejected: 0, ordersCompleted: 0,
  };
  const recentOrders = dashboardData?.recentOrders ?? [];
  const pendingDLQ = dashboardData?.pendingDLQ ?? [];
  const systemHealth = healthStatus ?? null;
  const triageStats = triageData ?? null;

  const refreshDashboard = async (showLoading = true) => {
    if (showLoading) {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['systemHealth'] });
      await queryClient.invalidateQueries({ queryKey: ['emailTriageStats'] });
    } else {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['systemHealth'] });
      queryClient.invalidateQueries({ queryKey: ['emailTriageStats'] });
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

  // Calculate real trends
  const ordersTrend = kpis.ordersYesterday > 0 
    ? ((kpis.ordersToday - kpis.ordersYesterday) / kpis.ordersYesterday) * 100 
    : (kpis.ordersToday > 0 ? 100 : 0);

  const timeTrend = kpis.avgProcessingTimeYesterday > 0 
    ? ((kpis.avgProcessingTime - kpis.avgProcessingTimeYesterday) / kpis.avgProcessingTimeYesterday) * 100 
    : 0;

  // Count items that need attention
  const needsAttentionCount = kpis.pendingLocations + kpis.pendingDLQ;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">{t.dashboard.title}</h1>
        <p className="page-description">{t.dashboard.subtitle}</p>
      </div>

      {/* System Health Banner (Actionable Insight) */}
      <div className={`flex items-start gap-4 rounded-lg border p-4 ${health.color}`}>
        <HealthIcon className="mt-1 h-5 w-5 shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold">{health.title}</h3>
          <p className="text-sm opacity-90">{health.message}</p>
        </div>
        {systemHealth && (
          <span className="text-xs opacity-60">
            {new Date(systemHealth.lastCheck).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* KPI Cards - Now with real trends */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t.dashboard.ordersToday}
          value={kpis.ordersToday}
          icon={FileText}
          subtitle={`${kpis.ordersWeek} ${t.dashboard.last7days}`}
          trend={kpis.ordersYesterday > 0 ? { 
            value: Math.abs(Math.round(ordersTrend)), 
            isPositive: ordersTrend >= 0 
          } : undefined}
        />
        <KPICard
          title="Pendientes Ubicación"
          value={kpis.pendingLocations}
          icon={MapPin}
          subtitle="Líneas sin dirección"
          iconClassName={kpis.pendingLocations > 0 ? 'bg-amber-100' : 'bg-success/10'}
        />
        <KPICard
          title={t.dashboard.avgTime}
          value={formatProcessingTime(kpis.avgProcessingTime)}
          icon={Clock}
          subtitle={t.dashboard.orderProcessing}
          trend={kpis.avgProcessingTimeYesterday > 0 ? {
            value: Math.abs(Math.round(timeTrend)),
            isPositive: timeTrend <= 0 // For time, lower is better
          } : undefined}
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

      {/* Triaje: % correos pedidos hoy */}
      {triageStats && triageStats.totalToday > 0 && (
        <Link to="/monitoring/emails" className="block">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center justify-between hover:bg-primary/10 transition-colors">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Clasificación de correos (triaje AI)</p>
                <p className="text-xs text-muted-foreground">
                  {triageStats.totalToday} clasificados hoy · {triageStats.orderEmailsToday} pedidos ({triageStats.percentOrdersToday}%) · Ver detalle
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </Link>
      )}

      {/* Status Distribution - Real data */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Estado del Pipeline
          </h2>
        </div>
        <div className="grid gap-4 p-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <Link to="/orders?status=RECEIVED" className="group rounded-lg border p-4 transition-colors hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Recibidos</span>
              <Badge variant="outline" className="bg-slate-50">
                {kpis.ordersReceived}
              </Badge>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div 
                className="h-full bg-slate-400 transition-all" 
                style={{ width: `${kpis.ordersWeek > 0 ? (kpis.ordersReceived / kpis.ordersWeek) * 100 : 0}%` }}
              />
            </div>
          </Link>
          
          <Link to="/orders?status=VALIDATING" className="group rounded-lg border p-4 transition-colors hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Validando</span>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                {kpis.ordersInValidation}
              </Badge>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-yellow-100">
              <div 
                className="h-full bg-yellow-400 transition-all" 
                style={{ width: `${kpis.ordersWeek > 0 ? (kpis.ordersInValidation / kpis.ordersWeek) * 100 : 0}%` }}
              />
            </div>
          </Link>
          
          <Link to="/orders?status=PROCESSING" className="group rounded-lg border p-4 transition-colors hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Procesando</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {kpis.ordersProcessing}
              </Badge>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-100">
              <div 
                className="h-full bg-blue-500 transition-all" 
                style={{ width: `${kpis.ordersWeek > 0 ? (kpis.ordersProcessing / kpis.ordersWeek) * 100 : 0}%` }}
              />
            </div>
          </Link>
          
          <Link to="/orders?status=COMPLETED" className="group rounded-lg border border-green-200 bg-green-50/30 p-4 transition-colors hover:bg-green-50/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-700">Completados</span>
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                {kpis.ordersCompleted}
              </Badge>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-green-100">
              <div 
                className="h-full bg-green-500 transition-all" 
                style={{ width: `${kpis.ordersWeek > 0 ? (kpis.ordersCompleted / kpis.ordersWeek) * 100 : 0}%` }}
              />
            </div>
          </Link>
          
          <Link to="/orders?status=REJECTED" className="group rounded-lg border border-red-200 bg-red-50/30 p-4 transition-colors hover:bg-red-50/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-700">Rechazados</span>
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                {kpis.ordersRejected}
              </Badge>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-red-100">
              <div 
                className="h-full bg-red-500 transition-all" 
                style={{ width: `${kpis.ordersWeek > 0 ? (kpis.ordersRejected / kpis.ordersWeek) * 100 : 0}%` }}
              />
            </div>
          </Link>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders - Now with Inline Actions */}
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {t.dashboard.recentOrders}
              {(() => {
                const ordersWithoutClient = recentOrders.filter((o) => !o.clientId || o.clientId === 'null');
                if (ordersWithoutClient.length === 0) return null;
                const target = ordersWithoutClient.length === 1
                  ? `/orders/${ordersWithoutClient[0].id}`
                  : '/monitoring/unknown-clients';
                return (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={target} className="gap-1 text-amber-600 hover:text-amber-700">
                      <UserX className="h-4 w-4" />
                      {ordersWithoutClient.length} sin cliente
                    </Link>
                  </Button>
                );
              })()}
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/orders" className="gap-1">
                {t.dashboard.viewAll}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">No hay pedidos recientes</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium shrink-0">{order.orderCode}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <OrderStatusBadge status={order.status} />
                        {(!order.clientId || order.clientId === 'null') && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs shrink-0">
                            Sin cliente
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {(!order.clientId || order.clientId === 'null')
                        ? `${order.linesCount} ${t.dashboard.lines}`
                        : `${order.clientName} • ${order.linesCount} ${t.dashboard.lines}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Button to assign client - when no client */}
                    {(!order.clientId || order.clientId === 'null') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 min-w-[44px] sm:h-7 sm:min-w-0 px-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/orders/${order.id}`);
                        }}
                      >
                        <span className="flex items-center gap-1 text-xs">
                          <UserX className="h-3 w-3" /> Asignar
                        </span>
                      </Button>
                    )}
                    {/* Quick Action Button - Visible on valid states */}
                    {(['VALIDATING', 'IN_REVIEW', 'RECEIVED'].includes(order.status || '')) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 min-w-[44px] sm:h-7 sm:min-w-0 px-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
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
          )}
        </div>

        {/* Requires Attention - Combined actionable panel */}
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${needsAttentionCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              Requieren Atención
              {needsAttentionCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {needsAttentionCount}
                </Badge>
              )}
            </h2>
          </div>
          
          {needsAttentionCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-success/50" />
              <p className="mt-3 font-medium">{t.dashboard.noPendingIssues}</p>
              <p className="text-sm text-muted-foreground">{t.dashboard.allOrdersProcessed}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Pending Locations */}
              {kpis.pendingLocations > 0 && (
                <Link
                  to="/orders?locationStatus=PENDING_LOCATION"
                  className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                      <MapPin className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">Direcciones de entrega pendientes</p>
                      <p className="text-sm text-muted-foreground">
                        {kpis.pendingLocations} {kpis.pendingLocations === 1 ? 'línea requiere' : 'líneas requieren'} asignación manual
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      {kpis.pendingLocations}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              )}
              
              {/* Pending DLQ */}
              {pendingDLQ.length > 0 && (
                <>
                  <div className="px-5 py-2 bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Errores en DLQ ({pendingDLQ.length})
                    </span>
                  </div>
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
                  <div className="px-5 py-3 bg-muted/20">
                    <Button variant="ghost" size="sm" asChild className="w-full justify-center">
                      <Link to="/dlq" className="gap-1">
                        Ver todos los errores DLQ
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
