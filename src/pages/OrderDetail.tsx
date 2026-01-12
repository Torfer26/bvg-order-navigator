import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  RefreshCw, 
  Mail, 
  Clock, 
  User, 
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { mockOrders, getOrderLines, getOrderEvents } from '@/lib/mockData';
import { useLanguage } from '@/contexts/LanguageContext';
import type { OrderLine, OrderEvent } from '@/types';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;
  const [isReprocessing, setIsReprocessing] = useState(false);

  const order = useMemo(() => mockOrders.find((o) => o.id === id), [id]);
  const lines = useMemo(() => (order ? getOrderLines(order.id) : []), [order]);
  const events = useMemo(() => (order ? getOrderEvents(order.orderCode) : []), [order]);

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">{t.orders.orderNotFound}</h2>
        <p className="text-muted-foreground">{t.orders.orderNotFound}</p>
        <Button asChild className="mt-4">
          <Link to="/orders">{t.orders.backToOrders}</Link>
        </Button>
      </div>
    );
  }

  const handleReprocess = async () => {
    setIsReprocessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsReprocessing(false);
    toast.success(t.orders.reprocessSent);
  };

  const lineColumns: Column<OrderLine>[] = [
    { key: 'lineNumber', header: '#', cell: (row) => row.lineNumber, className: 'w-12' },
    { key: 'productCode', header: t.orders.productCode, cell: (row) => <span className="font-mono text-sm">{row.productCode}</span> },
    { key: 'productName', header: t.orders.product, cell: (row) => row.productName },
    { key: 'quantity', header: t.orders.quantity, cell: (row) => row.quantity, className: 'text-right' },
    { key: 'unit', header: t.orders.unit, cell: (row) => row.unit, className: 'w-16' },
    { key: 'notes', header: t.orders.notes, cell: (row) => row.notes || '-', className: 'text-muted-foreground' },
  ];

  const eventTypeIcons: Record<string, React.ElementType> = {
    received: Mail,
    parsed: FileText,
    validated: CheckCircle2,
    sent: CheckCircle2,
    error: AlertCircle,
    reprocessed: RefreshCw,
  };

  const eventLabels: Record<string, string> = {
    received: t.orderEvents.received,
    parsed: t.orderEvents.parsed,
    validated: t.orderEvents.validated,
    sent: t.orderEvents.sent,
    error: t.orderEvents.error,
    reprocessed: t.orderEvents.reprocessed,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{order.orderCode}</h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-muted-foreground">{order.clientName}</p>
          </div>
        </div>

        {hasRole(['admin', 'ops']) && (order.status === 'error' || order.status === 'pending') && (
          <Button onClick={handleReprocess} disabled={isReprocessing}>
            {isReprocessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isReprocessing ? t.orders.reprocessing : t.orders.reprocess}
          </Button>
        )}
      </div>

      {/* Order Info */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="section-card lg:col-span-2">
          <div className="section-header">
            <h2 className="section-title">{t.orders.orderDetail}</h2>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t.orders.messageId}</p>
              <p className="mt-1 break-all font-mono text-sm">{order.messageId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t.orders.sender}</p>
              <p className="mt-1">{order.senderAddress}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">{t.orders.subject}</p>
              <p className="mt-1">{order.subject}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t.orders.received}</p>
              <p className="mt-1">{format(new Date(order.receivedAt), 'dd MMMM yyyy, HH:mm:ss', { locale: dateLocale })}</p>
            </div>
            {order.processedAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t.orders.processed}</p>
                <p className="mt-1">{format(new Date(order.processedAt), 'dd MMMM yyyy, HH:mm:ss', { locale: dateLocale })}</p>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title">{t.orders.timeline}</h2>
          </div>
          <div className="p-5">
            <div className="relative space-y-4">
              {events.map((event, index) => {
                const Icon = eventTypeIcons[event.eventType] || Clock;
                const isError = event.eventType === 'error';
                const isLast = index === events.length - 1;

                return (
                  <div key={event.id} className="flex gap-3">
                    <div className="relative">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          isError ? 'bg-destructive/10' : 'bg-primary/10'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isError ? 'text-destructive' : 'text-primary'}`} />
                      </div>
                      {!isLast && (
                        <div className="absolute left-1/2 top-8 h-full w-px -translate-x-1/2 bg-border" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium">{eventLabels[event.eventType] || event.details}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(event.timestamp), 'HH:mm:ss', { locale: dateLocale })}
                      </p>
                      {event.actorEmail && (
                        <p className="text-sm text-muted-foreground">
                          <User className="mr-1 inline h-3 w-3" />
                          {event.actorEmail}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Order Lines */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">{t.orders.orderLines} ({lines.length})</h2>
        <DataTable
          columns={lineColumns}
          data={lines}
          keyExtractor={(row) => row.id}
        />
      </div>
    </div>
  );
}
