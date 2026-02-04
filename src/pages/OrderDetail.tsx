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
  AlertTriangle,
  MoreHorizontal,
  Ban,
  Eye,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { LocationSelectorModal } from '@/components/shared/LocationSelectorModal';
import { 
  fetchOrders, 
  fetchOrdersLog, 
  fetchOrderLines, 
  approveOrderForFTP,
  markOrderCompleted,
  rejectOrder,
  moveOrderToReview,
  fetchClientWithDefaultLocation,
  type ClientWithDefaultLocation
} from '@/lib/ordersService';
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
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [order, setOrder] = useState<OrderIntake | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Location selector modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedLineForLocation, setSelectedLineForLocation] = useState<OrderLine | null>(null);
  // Status change dialogs
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  // Client info with default load location
  const [clientInfo, setClientInfo] = useState<ClientWithDefaultLocation | null>(null);

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

        // Fetch client info with default load location
        console.log('[OrderDetail] foundOrder.clientId:', foundOrder.clientId);
        if (foundOrder.clientId) {
          const clientData = await fetchClientWithDefaultLocation(foundOrder.clientId);
          console.log('[OrderDetail] clientData:', clientData);
          setClientInfo(clientData);
        } else {
          console.log('[OrderDetail] No clientId found on order');
        }

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

  // Handle marking order as completed
  const handleMarkCompleted = async () => {
    if (!order) return;
    
    setIsUpdatingStatus(true);
    try {
      const result = await markOrderCompleted(order.id);
      if (result.success) {
        toast.success('Pedido marcado como completado');
        setOrder(prev => prev ? ({ ...prev, status: 'COMPLETED' }) : null);
        setShowCompleteDialog(false);
        setTimeout(() => fetchOrderData(false), 1000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al marcar como completado');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle rejecting/canceling order
  const handleRejectOrder = async () => {
    if (!order || !rejectReason.trim()) {
      toast.error('Por favor, introduce un motivo para rechazar el pedido');
      return;
    }
    
    setIsUpdatingStatus(true);
    try {
      const result = await rejectOrder(order.id, rejectReason);
      if (result.success) {
        toast.success('Pedido rechazado');
        setOrder(prev => prev ? ({ ...prev, status: 'REJECTED' }) : null);
        setShowRejectDialog(false);
        setRejectReason('');
        setTimeout(() => fetchOrderData(false), 1000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al rechazar pedido');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle moving order back to review
  const handleMoveToReview = async () => {
    if (!order) return;
    
    setIsUpdatingStatus(true);
    try {
      const result = await moveOrderToReview(order.id);
      if (result.success) {
        toast.success('Pedido movido a revisión');
        setOrder(prev => prev ? ({ ...prev, status: 'IN_REVIEW' }) : null);
        setTimeout(() => fetchOrderData(false), 1000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al mover a revisión');
    } finally {
      setIsUpdatingStatus(false);
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
    status_change: Ban,
    completed: Check,
  };

  const eventLabels: Record<string, string> = {
    received: t.orderEvents.received,
    parsed: t.orderEvents.parsed,
    validated: t.orderEvents.validated,
    sent: t.orderEvents.sent,
    error: t.orderEvents.error,
    reprocessed: t.orderEvents.reprocessed,
    status_change: 'Cambio de estado',
    completed: 'Completado',
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
            {/* Client and Default Load Location */}
            {clientInfo && clientInfo.defaultLoadLocation && (
              <div className="flex items-center gap-2 mt-1 text-sm text-blue-600">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">Ubicación de Carga:</span>
                <span>{clientInfo.defaultLoadLocation.name}</span>
                <span className="text-muted-foreground">
                  ({clientInfo.defaultLoadLocation.city})
                </span>
              </div>
            )}
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

        {/* Menú de acciones adicionales */}
        {hasRole(['admin', 'ops']) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" disabled={isUpdatingStatus}>
                {isUpdatingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Mover a revisión - disponible si está en PROCESSING o ERROR */}
              {(order.status === 'PROCESSING' || order.status === 'ERROR') && (
                <DropdownMenuItem onClick={handleMoveToReview}>
                  <Eye className="mr-2 h-4 w-4" />
                  Mover a Revisión
                </DropdownMenuItem>
              )}
              
              {/* Marcar como completado - disponible si está en PROCESSING */}
              {order.status === 'PROCESSING' && (
                <DropdownMenuItem onClick={() => setShowCompleteDialog(true)}>
                  <Check className="mr-2 h-4 w-4 text-green-600" />
                  Marcar como Completado
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              
              {/* Rechazar/Anular - disponible si NO está completado o ya rechazado */}
              {order.status !== 'COMPLETED' && order.status !== 'REJECTED' && (
                <DropdownMenuItem 
                  onClick={() => setShowRejectDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Rechazar / Anular Pedido
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Dialog para confirmar completado */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Completado</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas marcar el pedido <strong>{order.orderCode}</strong> como completado?
              <br /><br />
              Esto indica que el pedido ha sido procesado y enviado correctamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleMarkCompleted}
              disabled={isUpdatingStatus}
              className="bg-green-600 hover:bg-green-700"
            >
              {isUpdatingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Confirmar Completado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para rechazar pedido */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar / Anular Pedido</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  ¿Estás seguro de que deseas rechazar el pedido <strong>{order.orderCode}</strong>?
                </p>
                <div>
                  <label className="text-sm font-medium">Motivo del rechazo:</label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Escribe el motivo por el que se rechaza este pedido..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRejectOrder}
              disabled={isUpdatingStatus || !rejectReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isUpdatingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-2 h-4 w-4" />
              )}
              Rechazar Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client and Load Location Info - Always visible */}
      <div className="section-card bg-gradient-to-r from-blue-50 to-slate-50 border-blue-200">
        <div className="p-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Client Info */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cliente</p>
                <p className="font-semibold text-lg">
                  {clientInfo?.name || order.clientName || 'Sin cliente'}
                </p>
                {clientInfo?.address && (
                  <p className="text-sm text-muted-foreground">{clientInfo.address}</p>
                )}
              </div>
            </div>

            {/* Default Load Location */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <MapPin className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Ubicación de Carga</p>
                  {clientInfo?.defaultLoadLocation && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                      Predeterminada
                    </Badge>
                  )}
                </div>
                {clientInfo?.defaultLoadLocation ? (
                  <>
                    <p className="font-semibold text-lg">{clientInfo.defaultLoadLocation.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {clientInfo.defaultLoadLocation.address}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {clientInfo.defaultLoadLocation.zipCode && `${clientInfo.defaultLoadLocation.zipCode} `}
                      {clientInfo.defaultLoadLocation.city}
                      {clientInfo.defaultLoadLocation.region && ` (${clientInfo.defaultLoadLocation.region})`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No configurada
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
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
                const isStatusChange = event.eventType === 'status_change';
                const isLast = index === events.length - 1;

                // Parse status change details
                let statusChangeInfo = null;
                if (isStatusChange && event.details) {
                  try {
                    const info = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
                    const statusLabels: Record<string, string> = {
                      'REJECTED': 'Rechazado',
                      'COMPLETED': 'Completado',
                      'IN_REVIEW': 'En revisión',
                      'APPROVED': 'Aprobado',
                      'PROCESSING': 'Procesando',
                    };
                    statusChangeInfo = {
                      status: statusLabels[info.new_status] || info.new_status,
                      reason: info.reason,
                    };
                  } catch {
                    statusChangeInfo = null;
                  }
                }

                return (
                  <div key={event.id} className="flex gap-3">
                    <div className="relative">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          isError || (isStatusChange && statusChangeInfo?.status === 'Rechazado')
                            ? 'bg-destructive/10' 
                            : 'bg-primary/10'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${
                          isError || (isStatusChange && statusChangeInfo?.status === 'Rechazado')
                            ? 'text-destructive' 
                            : 'text-primary'
                        }`} />
                      </div>
                      {!isLast && (
                        <div className="absolute left-1/2 top-8 h-full w-px -translate-x-1/2 bg-border" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      {isStatusChange && statusChangeInfo ? (
                        <>
                          <p className="font-medium">{statusChangeInfo.status}</p>
                          {statusChangeInfo.reason && (
                            <p className="text-sm text-muted-foreground italic">
                              "{statusChangeInfo.reason}"
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="font-medium">{eventLabels[event.eventType] || event.details}</p>
                      )}
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
