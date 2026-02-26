import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Check,
  UserPlus,
  Pencil,
  XCircle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { LocationSelectorModal } from '@/components/shared/LocationSelectorModal';
import { LocationSearchSelect } from '@/components/shared/LocationSearchSelect';
import { ClientSearchBox } from '@/components/shared/ClientSearchBox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  fetchOrderDetailData, 
  fetchOrdersLog, 
  fetchOrderLines, 
  approveOrderForFTP,
  markOrderCompleted,
  rejectOrder,
  moveOrderToReview,
  fetchClientWithDefaultLocation,
  assignClientToOrder,
  fetchSenderFallbackForOrder,
  fetchEmailTriageReason,
  saveCustomerDefaultLoadLocation,
  clearCustomerDefaultLoadLocation,
  cancelOrderLine,
  type ClientWithDefaultLocation,
  type OrderDetailData
} from '@/lib/ordersService';
import { useLanguage } from '@/contexts/LanguageContext';
import type { OrderIntake, OrderLine, OrderEvent, Location } from '@/types';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// Helper: Format event details for display
// ============================================================================
function formatEventDetails(
  step: string | undefined,
  info: Record<string, unknown> | undefined,
  status: string | undefined
): string {
  if (!info) {
    return status || step || 'Evento';
  }

  // Handle COMPLETED events (order approved and sent)
  if (step === 'COMPLETED' || info.action === 'order_approved_and_sent') {
    const approvedBy = info.approved_by as string;
    if (approvedBy) {
      // Extract name from email if possible
      const name = approvedBy.includes('@') 
        ? approvedBy.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : approvedBy;
      return `Aprobado y enviado por ${name}`;
    }
    return 'Pedido aprobado y enviado';
  }

  // Handle status changes
  if (step === 'status_change' || info.new_status) {
    const statusLabels: Record<string, string> = {
      'REJECTED': 'Rechazado',
      'COMPLETED': 'Completado',
      'IN_REVIEW': 'En revisión',
      'APPROVED': 'Aprobado',
      'PROCESSING': 'Procesando',
      'RECEIVED': 'Recibido',
      'PARSING': 'Analizando',
      'VALIDATING': 'Validando',
    };
    const newStatus = statusLabels[info.new_status as string] || info.new_status;
    const changedBy = (info.changed_by || info.updated_by) as string;
    
    if (changedBy) {
      const name = changedBy.includes('@')
        ? changedBy.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : changedBy;
      return `${newStatus} por ${name}`;
    }
    return String(newStatus);
  }

  // Handle other known actions
  if (info.action) {
    const actionLabels: Record<string, string> = {
      'email_received': 'Email recibido',
      'pdf_extracted': 'PDF extraído',
      'excel_parsed': 'Excel extraído',
      'body_extracted': 'Contenido extraído',
      'lines_created': 'Líneas creadas',
      'location_resolved': 'Ubicación resuelta',
      'validation_passed': 'Validación correcta',
      'validation_failed': 'Error de validación',
    };
    return actionLabels[info.action as string] || String(info.action);
  }

  // Fallback: return status or step
  return status || step || 'Evento';
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  // Location selector modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedLineForLocation, setSelectedLineForLocation] = useState<OrderLine | null>(null);
  // Status change dialogs
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  // Assign client modal (inline, no navigation)
  const [assignClientModalOpen, setAssignClientModalOpen] = useState(false);
  const [selectedClientForAssign, setSelectedClientForAssign] = useState('');
  const [selectedClientForAssignName, setSelectedClientForAssignName] = useState<string>('');
  const [savingAssign, setSavingAssign] = useState(false);
  // Fallback sender when ordenes_intake.sender_address is empty (e.g. from order_events)
  const [senderFallback, setSenderFallback] = useState<{ senderAddress: string; subject: string } | null>(null);
  // Edit default load location (cliente) from order
  const [showEditDefaultLocationModal, setShowEditDefaultLocationModal] = useState(false);
  const [editDefaultLocationValue, setEditDefaultLocationValue] = useState<Location | null>(null);
  const [savingDefaultLocation, setSavingDefaultLocation] = useState(false);
  // Anular línea
  const [lineToCancel, setLineToCancel] = useState<OrderLine | null>(null);
  const [isCancellingLine, setIsCancellingLine] = useState(false);

  const { data: detailData, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['orderDetail', id],
    queryFn: () => fetchOrderDetailData(id!),
    enabled: !!id,
  });

  const order = detailData?.order ?? null;
  const clientInfo = detailData?.clientInfo ?? null;
  const lines = (detailData?.lines ?? []) as OrderLine[];
  const emailSummary = detailData?.emailSummary ?? null;
  const error = queryError ? (queryError as Error).message : (id && detailData === null ? 'Order not found' : null);
  const rawLogs = detailData?.events ?? [];

  const events = useMemo(() => {
    return rawLogs.map((log: any) => ({
      id: log.id,
      orderCode: order?.orderCode ?? '',
      eventType: log.step || 'unknown',
      timestamp: log.createdAt,
      details: formatEventDetails(log.step, log.info, log.status),
      actorEmail: log.info?.approved_by || log.info?.changed_by || log.info?.updated_by || undefined,
      rawInfo: log.info,
    }));
  }, [rawLogs, order?.orderCode]);

  const invalidateOrderDetail = () => {
    queryClient.invalidateQueries({ queryKey: ['orderDetail', id] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  // Fallback: fetch sender from order_events when ordenes_intake.sender_address is empty
  useEffect(() => {
    if (order && !order.senderAddress && (order.messageId || order.conversationId)) {
      fetchSenderFallbackForOrder(order.messageId, order.conversationId).then((fb) => {
        if (fb.senderAddress || fb.subject) setSenderFallback(fb);
      });
    } else {
      setSenderFallback(null);
    }
  }, [order?.id, order?.senderAddress, order?.messageId, order?.conversationId]);

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
      // Pass current user email for audit trail
      // Fallback to name or a readable identifier if email not available
      const approvedBy = user?.email || user?.name || 'Usuario no identificado';
      const result = await approveOrderForFTP(order.id, approvedBy);
      if (result.success) {
        toast.success(t.orders?.approveSuccess || 'Pedido autorizado, enviado y completado correctamente');

        // Optimistic UI Update: Change status to COMPLETED
        queryClient.setQueryData<OrderDetailData>(['orderDetail', id], (prev) =>
          prev ? { ...prev, order: { ...prev.order, status: 'COMPLETED' } } : prev
        );
        setTimeout(() => invalidateOrderDetail(), 2000);

      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(t.orders?.approveError || 'Error al autorizar pedido');
    } finally {
      setIsApproving(false);
    }
  };

  const handleOpenAssignClient = async () => {
    setAssignClientModalOpen(true);
    setSelectedClientForAssign('');
    setSelectedClientForAssignName('');
    try {
      const fallback = (!order?.senderAddress && (order?.messageId || order?.conversationId))
        ? await fetchSenderFallbackForOrder(order.messageId, order.conversationId)
        : { senderAddress: '', subject: '' };
      if (fallback.senderAddress || fallback.subject) setSenderFallback(fallback);
    } catch (err) {
      console.error('Error loading assign client data:', err);
      toast.error('Error al cargar datos');
    }
  };

  const handleOpenEditDefaultLocation = () => {
    if (clientInfo?.defaultLoadLocation) {
      setEditDefaultLocationValue({
        id: Number(clientInfo.defaultLoadLocation.id),
        name: clientInfo.defaultLoadLocation.name,
        address: clientInfo.defaultLoadLocation.address,
        city: clientInfo.defaultLoadLocation.city,
        province: clientInfo.defaultLoadLocation.region,
        zipCode: clientInfo.defaultLoadLocation.zipCode,
      });
    } else {
      setEditDefaultLocationValue(null);
    }
    setShowEditDefaultLocationModal(true);
  };

  const handleSaveDefaultLocation = async () => {
    if (!order?.clientId) return;
    setSavingDefaultLocation(true);
    try {
      if (editDefaultLocationValue) {
        const result = await saveCustomerDefaultLoadLocation(order.clientId, editDefaultLocationValue.id);
        if (result.success) {
          toast.success(result.message);
          setShowEditDefaultLocationModal(false);
          const updated = await fetchClientWithDefaultLocation(order.clientId);
          queryClient.setQueryData<OrderDetailData>(['orderDetail', id], (prev) =>
            prev ? { ...prev, clientInfo: updated } : prev
          );
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await clearCustomerDefaultLoadLocation(order.clientId);
        if (result.success) {
          toast.success(result.message);
          setShowEditDefaultLocationModal(false);
          const updated = await fetchClientWithDefaultLocation(order.clientId);
          queryClient.setQueryData<OrderDetailData>(['orderDetail', id], (prev) =>
            prev ? { ...prev, clientInfo: updated } : prev
          );
        } else {
          toast.error(result.message);
        }
      }
    } catch (err) {
      toast.error('Error al guardar ubicación de carga');
    } finally {
      setSavingDefaultLocation(false);
    }
  };

  const handleAssignClient = async () => {
    if (!order || !selectedClientForAssign) return;
    setSavingAssign(true);
    try {
      const result = await assignClientToOrder(order.id, selectedClientForAssign);
      if (result.success) {
        toast.success(result.message);
        setAssignClientModalOpen(false);
        invalidateOrderDetail();
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error('Error al asignar cliente');
    } finally {
      setSavingAssign(false);
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
        queryClient.setQueryData<OrderDetailData>(['orderDetail', id], (prev) =>
          prev ? { ...prev, order: { ...prev.order, status: 'COMPLETED' } } : prev
        );
        setShowCompleteDialog(false);
        setTimeout(invalidateOrderDetail, 1000);
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
        queryClient.setQueryData<OrderDetailData>(['orderDetail', id], (prev) =>
          prev ? { ...prev, order: { ...prev.order, status: 'REJECTED' } } : prev
        );
        setShowRejectDialog(false);
        setRejectReason('');
        setTimeout(invalidateOrderDetail, 1000);
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
        queryClient.setQueryData<OrderDetailData>(['orderDetail', id], (prev) =>
          prev ? { ...prev, order: { ...prev.order, status: 'IN_REVIEW' } } : prev
        );
        setTimeout(invalidateOrderDetail, 1000);
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

  // Anular línea
  const handleConfirmCancelLine = async () => {
    if (!lineToCancel) return;
    setIsCancellingLine(true);
    try {
      const res = await cancelOrderLine(lineToCancel.id, user?.email || 'frontend_user');
      if (res.success) {
        queryClient.setQueryData<OrderDetailData>(['orderDetail', id], (prev) =>
          prev
            ? {
                ...prev,
                lines: prev.lines.map((l: any) =>
                  l.id === lineToCancel.id
                    ? { ...l, anulada: true, anuladaAt: new Date().toISOString(), anuladaPor: user?.email || 'frontend_user' }
                    : l
                ),
              }
            : prev
        );
        toast.success(res.message);
        setLineToCancel(null);
        invalidateOrderDetail();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Error al anular la línea');
    } finally {
      setIsCancellingLine(false);
    }
  };

  // Handle when location is successfully set
  const handleLocationSet = (lineId: string, location: Location) => {
    queryClient.setQueryData<OrderDetailData>(['orderDetail', id], (prev) =>
      prev
        ? {
            ...prev,
            lines: prev.lines.map((l: any) =>
              l.id === lineId
                ? { ...l, destinationId: location.id, destination: location.name, locationStatus: 'MANUALLY_SET' }
                : l
            ),
          }
        : prev
    );
  };

  // Count of lines needing location (excluye anuladas)
  const pendingLocationCount = lines.filter((l) => !l.anulada && needsLocationSelection(l)).length;

  const lineColumns: Column<OrderLine>[] = [
    { key: 'lineNumber', header: '#', cell: (row) => row.lineNumber, className: 'w-12' },
    { 
      key: 'customer', 
      header: t.orders?.consignee || 'Consignatario', 
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className={cn('font-medium', row.anulada && 'line-through text-muted-foreground')}>{row.customer}</span>
            {row.anulada && (
              <Badge variant="secondary" className="text-xs">
                Anulada
              </Badge>
            )}
          </div>
          {row.rawDestinationText && (
            <p className="text-xs text-muted-foreground">
              📍 {row.rawDestinationText}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'loadPoint',
      header: 'Ubicación de carga',
      cell: (row) => {
        const display = row.loadPointId && row.loadPoint
          ? (
              <div className="space-y-0.5">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">{row.loadPoint}</span>
                {row.loadPointAddress && (
                  <p className="text-xs text-muted-foreground">{row.loadPointAddress}</p>
                )}
              </div>
            )
          : row.rawLoadPoint
            ? <span className="text-muted-foreground">{row.rawLoadPoint}</span>
            : <span className="text-muted-foreground">-</span>;
        return <div>{display}</div>;
      }
    },
    { 
      key: 'destination', 
      header: t.orders?.deliveryAddress || 'Dirección de Entrega', 
      cell: (row) => {
        const isPending = !row.anulada && needsLocationSelection(row);
        const isClickable = !row.anulada;
        
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
            className={cn(isClickable && 'cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1')}
            onClick={isClickable ? () => handleOpenLocationModal(row) : undefined}
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
    // Action column: edit location, anular línea
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {!row.anulada && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenLocationModal(row)}
                className="h-8 px-2"
                title={t.orders?.editDeliveryAddress || 'Editar dirección de entrega'}
              >
                <MapPin className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLineToCancel(row)}
                className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Anular línea"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
      className: 'w-24'
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
    status_change: t.orderEvents.status_change,
    completed: t.orderEvents.completed,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
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
            {clientInfo && (clientInfo.defaultLoadLocation || (hasRole(['admin', 'ops']) && order?.clientId)) && (
              <div className="flex items-center gap-2 mt-1 text-sm text-blue-600">
                <MapPin className="h-4 w-4 shrink-0" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">Ubicación de Carga:</span>
                  {clientInfo.defaultLoadLocation ? (
                    <>
                      <span>{clientInfo.defaultLoadLocation.name}</span>
                      <span className="text-muted-foreground">
                        ({clientInfo.defaultLoadLocation.city})
                      </span>
                      {hasRole(['admin', 'ops']) && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-blue-600" onClick={handleOpenEditDefaultLocation}>
                          <Pencil className="h-3 w-3 inline mr-0.5" /> Editar
                        </Button>
                      )}
                    </>
                  ) : (
                    hasRole(['admin', 'ops']) && (
                      <Button variant="link" size="sm" className="h-auto p-0 text-blue-600" onClick={handleOpenEditDefaultLocation}>
                        Configurar
                      </Button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
        {hasRole(['admin', 'ops']) && (order.status === 'error' || order.status === 'pending') && (
          <Button onClick={handleReprocess} disabled={isReprocessing} size="sm" className="h-10 min-w-[44px] sm:h-9 sm:min-w-0">
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
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white h-10 min-w-[44px] sm:h-9 sm:min-w-0"
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

      {/* Confirmar anulación de línea */}
      <AlertDialog open={!!lineToCancel} onOpenChange={(open) => !open && setLineToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular línea</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Anular esta línea del pedido? La línea se marcará como anulada y no se incluirá en el conteo ni en la exportación FTP. Esta acción puede deshacerse manualmente en base de datos si fuera necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancellingLine}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmCancelLine(); }}
              disabled={isCancellingLine}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancellingLine ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Anular línea
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para editar ubicación de carga predeterminada del cliente */}
      <Dialog open={showEditDefaultLocationModal} onOpenChange={setShowEditDefaultLocationModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ubicación de carga predeterminada</DialogTitle>
            <DialogDescription>
              Configura la ubicación de carga predeterminada para {clientInfo?.name || 'este cliente'}. Se usará en futuros pedidos cuando el documento no especifique punto de carga.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <LocationSearchSelect
              label="Ubicación de carga"
              placeholder="Buscar ubicación..."
              value={editDefaultLocationValue}
              onChange={setEditDefaultLocationValue}
              disabled={savingDefaultLocation}
              hint="Se usará cuando el pedido no especifique punto de carga en el documento."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDefaultLocationModal(false)} disabled={savingDefaultLocation}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDefaultLocation} disabled={savingDefaultLocation}>
              {savingDefaultLocation ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client and Load Location Info - Always visible */}
      <div className="section-card bg-gradient-to-r from-blue-50 to-slate-50 border-blue-200">
        <div className="p-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Client Info */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Cliente</p>
                <p className="font-semibold text-lg">
                  {clientInfo?.name || order.clientName || 'Sin cliente'}
                </p>
                {clientInfo?.address && (
                  <p className="text-sm text-muted-foreground">{clientInfo.address}</p>
                )}
                {(!order.clientId || order.clientId === 'null') && (
                  <>
                    <div className="mt-2 rounded-md border border-amber-200/60 bg-amber-50/50 px-3 py-2 text-sm">
                      <p className="font-medium text-amber-800">Correo recibido</p>
                      <p className="mt-0.5 text-amber-700">{order.senderAddress || senderFallback?.senderAddress || '—'}</p>
                      <p className="mt-0.5 truncate text-amber-700/90">{order.subject || senderFallback?.subject || '—'}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
                      onClick={handleOpenAssignClient}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                      Asignar cliente
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Default Load Location */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <MapPin className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-muted-foreground">Ubicación de Carga</p>
                    {clientInfo?.defaultLoadLocation && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                        Predeterminada
                      </Badge>
                    )}
                  </div>
                  {hasRole(['admin', 'ops']) && order?.clientId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOpenEditDefaultLocation}
                      className="shrink-0 h-8"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {clientInfo?.defaultLoadLocation ? 'Editar' : 'Configurar'}
                    </Button>
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
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">{t.orders.emailSummary}</p>
              <p className="mt-1 text-sm">{emailSummary ?? t.orders.noSummary}</p>
              {order.messageId && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t.orders.technicalDetails} ▾
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{order.messageId}</p>
                  </CollapsibleContent>
                </Collapsible>
              )}
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
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                {t.orders.noEventsRecorded}
              </p>
            ) : (
              <div className="relative space-y-4">
                {events.map((event, index) => {
                  const Icon = eventTypeIcons[event.eventType] || Clock;
                  const isError = event.eventType === 'error';
                  const isStatusChange = event.eventType === 'status_change';
                  const isLast = index === events.length - 1;
                  const eventDate = new Date(event.timestamp);
                  const prevDate = index > 0 ? new Date(events[index - 1].timestamp) : null;
                  const isNewDay = !prevDate || eventDate.toDateString() !== prevDate.toDateString();
                  const timeFormat = isNewDay ? 'dd MMM, HH:mm:ss' : 'HH:mm:ss';

                  const statusLabels: Record<string, string> = {
                    'REJECTED': 'Rechazado',
                    'COMPLETED': 'Completado',
                    'IN_REVIEW': 'En revisión',
                    'APPROVED': 'Aprobado',
                    'PROCESSING': 'Procesando',
                  };
                  const rawInfo = (event as OrderEvent & { rawInfo?: Record<string, unknown> }).rawInfo;
                  const statusChangeInfo = isStatusChange && rawInfo?.new_status
                    ? {
                        status: statusLabels[rawInfo.new_status as string] || String(rawInfo.new_status),
                        reason: rawInfo.reason as string | undefined,
                      }
                    : null;

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
                                &quot;{statusChangeInfo.reason}&quot;
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="font-medium">{eventLabels[event.eventType] || event.details}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {format(eventDate, timeFormat, { locale: dateLocale })}
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
            )}
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
          getRowClassName={(row) => (row.anulada ? 'opacity-60 bg-muted/30' : '')}
        />
      </div>

      {/* Dialog: Asignar cliente (sin salir de la vista) */}
      <Dialog open={assignClientModalOpen} onOpenChange={(open) => { setAssignClientModalOpen(open); if (!open) setSenderFallback(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar cliente al pedido</DialogTitle>
            <DialogDescription>
              Contexto del correo para identificar el cliente correcto. Selecciona el cliente debajo.
            </DialogDescription>
          </DialogHeader>
          {order && (
            <div className="space-y-4 py-4">
              <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1">
                <div>
                  <Label className="text-xs text-muted-foreground">Remitente</Label>
                  <p className="font-medium">{order.senderAddress || senderFallback?.senderAddress || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Asunto</Label>
                  <p className="font-medium break-words">{order.subject || senderFallback?.subject || '—'}</p>
                </div>
              </div>
              <ClientSearchBox
                value={selectedClientForAssign}
                onSelect={(clientId, client) => {
                  setSelectedClientForAssign(clientId);
                  setSelectedClientForAssignName(client?.name ?? '');
                }}
                placeholder="Buscar por nombre o código de cliente..."
                label="Cliente"
                selectedClientName={selectedClientForAssignName || undefined}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignClientModalOpen(false)}>
              {t.common?.cancel || 'Cancelar'}
            </Button>
            <Button
              onClick={handleAssignClient}
              disabled={!selectedClientForAssign || savingAssign}
            >
              {savingAssign ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {savingAssign ? 'Asignando...' : 'Asignar cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
