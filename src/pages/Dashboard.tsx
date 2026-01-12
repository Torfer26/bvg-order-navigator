import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  ArrowRight,
  Activity
} from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { OrderStatusBadge, DLQStatusBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { getDashboardKPIs, mockOrders, mockDLQOrders } from '@/lib/mockData';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';

export default function Dashboard() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;
  
  const kpis = useMemo(() => getDashboardKPIs(), []);
  const recentOrders = mockOrders.slice(0, 5);
  const pendingDLQ = mockDLQOrders.filter((o) => !o.resolved).slice(0, 5);

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
              {mockOrders.filter((o) => o.status === 'pending').length}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t.dashboard.processing}</p>
            <p className="mt-1 text-2xl font-semibold">
              {mockOrders.filter((o) => o.status === 'processing').length}
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
