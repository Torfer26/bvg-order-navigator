import React, { useMemo, useState, useEffect } from 'react';
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
  Loader2,
  Send,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { LocationSelectorModal } from '@/components/shared/LocationSelectorModal';
import { fetchOrders, fetchOrdersLog, fetchOrderLines, approveOrderForFTP } from '@/lib/ordersService';
import { useLanguage } from '@/contexts/LanguageContext';
import type { OrderIntake, OrderLine, OrderEvent, Location } from '@/types';
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
  const [isApproving, setIsApproving] = useState(false);
  const [order, setOrder] = useState<OrderIntake | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Location selector modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedLineForLocation, setSelectedLineForLocation] = useState<OrderLine | null>(null);

  // Fetch order data from API
  // Function to load order data (can be called for refresh)
  const fetchOrderData = async (showLoading = true) => {
    if (!id) return;

    if (showLoading) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const orders = await fetchOrders();
      const foundOrder = orders.find((o) => o.id === id);

      if (foundOrder) {
        setOrder(foundOrder);

        // Fetch order lines from ordenes_intake_lineas
        const orderLines = await fetchOrderLines(id);
        const mappedLines: OrderLine[] = orderLines.map((line: any) => ({
          id: line.id,
          orderIntakeId: id,
          lineNumber: line.lineNumber,
          customer: line.customer,
          destination: line.destination,
          destinationId: line.destinationId,
          // Full delivery address details
          destinationAddress: line.destinationAddress,
          destinationCity: line.destinationCity,
          destinationProvince: line.destinationProvince,
          destinationZipCode: line.destinationZipCode,
          notes: line.notes,
          pallets: line.pallets,
          deliveryDate: line.deliveryDate,
          observations: line.observations,
          unit: line.unit || 'PLT',
          // Campos para sugerencias de ubicación
          locationStatus: line.locationStatus,
          locationSuggestions: line.locationSuggestions,
          rawDestinationText: line.rawDestinationText,
          rawCustomerText: line.rawCustomerText,
          locationSetBy: line.locationSetBy,
          locationSetAt: line.locationSetAt,
        }));
        setLines(mappedLines);

        // Fetch order logs/events
        if (foundOrder.messageId) {
          const logs = await fetchOrdersLog(foundOrder.messageId);
          const mappedEvents: OrderEvent[] = logs.map((log: any) => ({
            id: log.id,
            orderCode: foundOrder.orderCode,
            eventType: log.step || 'unknown',
            timestamp: log.createdAt,
            details: log.info ? JSON.stringify(log.info) : log.status,
          }));
          
          // Deduplicar eventos: mantener solo el primero de cada tipo (step)
          const seenSteps = new Set<string>();
          const uniqueEvents = mappedEvents.filter((event) => {
            if (seenSteps.has(event.eventType)) {
              return false; // Ya vimos este step, ignorar duplicado
            }
            seenSteps.add(event.eventType);
            return true;
          });
          
          setEvents(uniqueEvents);
        }
      } else {
        setError('Order not found');
      }
    } catch (err) {
      console.error('Error loading order:', err);
      setError('Failed to load order');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchOrderData(true);
  }, [id]);

  // Lines now fetched from API in useEffect above

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{t.common?.loading || 'Cargando...'}</p>
      </div>
    );
  }

  // Error or not found state
  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">{t.orders.orderNotFound}</h2>
        <p className="text-muted-foreground">{error || t.orders.orderNotFound}</p>
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

  const handleApproveForFTP = async () => {
    if (!order) return;

    setIsApproving(true);
    try {
      const result = await approveOrderForFTP(order.id);
      if (result.success) {
        toast.success(t.orders?.approveSuccess || 'Pedido autorizado y enviado correctamente');

        // Optimistic UI Update: Change status immediately without reload
        setOrder(prev => prev ? ({ ...prev, status: 'PROCESSING' }) : null);

        // Background revalidation: Refresh events/logs carefully
        // Giving a small delay to allow n8n to process at least the first event
        setTimeout(() => fetchOrderData(false), 2000);

      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(t.orders?.approveError || 'Error al autorizar pedido');
    } finally {
      setIsApproving(false);
    }
  };

  // Check if a line needs location selection
  const needsLocationSelection = (line: OrderLine) => {
    return !line.destinationId || line.locationStatus === 'PENDING_LOCATION';
  };

  // Handle location selection for a line
  const handleOpenLocationModal = (line: OrderLine) => {
    setSelectedLineForLocation(line);
    setIsLocationModalOpen(true);
  };

  // Handle when location is successfully set
  const handleLocationSet = (lineId: string, location: Location) => {
    setLines((prevLines) =>
      prevLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              destinationId: location.id,
              destination: location.name,
              locationStatus: 'MANUALLY_SET',
            }
          : line
      )
    );
  };

  // Count of lines needing location
  const pendingLocationCount = lines.filter(needsLocationSelection).length;

  const lineColumns: Column<OrderLine>[] = [
    { key: 'lineNumber', header: '#', cell: (row) => row.lineNumber, className: 'w-12' },
    { 
      key: 'customer', 
      header: t.orders?.consignee || 'Consignatario', 
      cell: (row) => (
        <div className="space-y-0.5">
          <span className="font-medium">{row.customer}</span>
          {row.rawDestinationText && (
            <p className="text-xs text-muted-foreground">
              📍 {row.rawDestinationText}
            </p>
          )}
        </div>
      )
    },
    { 
      key: 'destination', 
      header: t.orders?.deliveryAddress || 'Dirección de Entrega', 
      cell: (row) => {
        const isPending = needsLocationSelection(row);
        
        // Build full address string
        const buildFullAddress = () => {
          const parts = [];
          if (row.destinationAddress) parts.push(row.destinationAddress);
          if (row.destinationZipCode) parts.push(row.destinationZipCode);
          if (row.destinationCity) parts.push(row.destinationCity);
          if (row.destinationProvince && row.destinationProvince !== row.destinationCity) {
            parts.push(`(${row.destinationProvince})`);
          }
          return parts.length > 0 ? parts.join(', ') : null;
        };
        
        const fullAddress = buildFullAddress();
        
        return (
          <div 
            className={`${isPending ? 'cursor-pointer' : ''}`}
            onClick={isPending ? () => handleOpenLocationModal(row) : undefined}
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs hover:bg-amber-100 transition-colors">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {t.orders?.assignAddress || 'Asignar dirección'}
                </Badge>
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{row.destination}</span>
                  {row.locationStatus === 'MANUALLY_SET' && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      {t.orders?.manuallyAssigned || 'Asignada'}
                    </Badge>
                  )}
                  {row.locationStatus === 'AUTO' && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                      ✓ Auto
                    </Badge>
                  )}
                </div>
                {fullAddress && (
                  <p className="text-xs text-muted-foreground">
                    {fullAddress}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      }
    },
    { key: 'notes', header: t.orders?.lineNotes || 'Nota', cell: (row) => row.notes || '-', className: 'text-muted-foreground max-w-[200px] truncate' },
    { key: 'pallets', header: t.orders?.pallets || 'Palets', cell: (row) => row.pallets, className: 'text-right w-20' },
    {
      key: 'deliveryDate',
      header: t.orders?.deliveryDate || 'Fecha Entrega',
      cell: (row) => row.deliveryDate
        ? format(new Date(row.deliveryDate), 'dd/MM/yyyy', { locale: dateLocale })
        : '-',
      className: 'w-28'
    },
    // Action column for editing location
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleOpenLocationModal(row)}
          className="h-8 px-2"
          title={t.orders?.editDeliveryAddress || 'Editar dirección de entrega'}
        >
          <MapPin className="h-4 w-4" />
        </Button>
      ),
      className: 'w-12'
    },
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

        {/* Botón Autorizar y Enviar FTP */}
        {hasRole(['admin', 'ops']) &&
          (order.status === 'VALIDATED' ||
            order.status === 'VALIDATING' ||
            order.status === 'IN_REVIEW' ||
            order.status === 'RECEIVED') && (
            <Button
              onClick={handleApproveForFTP}
              disabled={isApproving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isApproving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isApproving
                ? (t.orders?.approving || 'Autorizando...')
                : (t.orders?.approveAndSend || 'Autorizar y Enviar')}
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
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${isError ? 'bg-destructive/10' : 'bg-primary/10'
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t.orders.orderLines} ({lines.length})</h2>
          {pendingLocationCount > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {pendingLocationCount} {pendingLocationCount === 1 
                ? (t.orders?.pendingDeliveryAddressSingular || 'dirección de entrega pendiente') 
                : (t.orders?.pendingDeliveryAddressPlural || 'direcciones de entrega pendientes')}
            </Badge>
          )}
        </div>

        {/* Alert for pending delivery addresses */}
        {pendingLocationCount > 0 && (
          <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800">
                {pendingLocationCount} {pendingLocationCount === 1 
                  ? (t.orders?.lineWithoutDeliveryAddressSingular || 'línea sin dirección de entrega asignada')
                  : (t.orders?.lineWithoutDeliveryAddressPlural || 'líneas sin dirección de entrega asignada')}
              </p>
              <p className="text-xs text-amber-700">
                {t.orders?.assignDeliveryAddressHelp || 'Haz clic en "Asignar dirección" para buscar y vincular la dirección de entrega del consignatario en nuestra base de datos.'}
              </p>
            </div>
          </div>
        )}

        <DataTable
          columns={lineColumns}
          data={lines}
          keyExtractor={(row) => row.id}
        />
      </div>

      {/* Location Selector Modal */}
      <LocationSelectorModal
        isOpen={isLocationModalOpen}
        onClose={() => {
          setIsLocationModalOpen(false);
          setSelectedLineForLocation(null);
        }}
        line={selectedLineForLocation}
        onLocationSet={handleLocationSet}
      />
    </div>
  );
}
