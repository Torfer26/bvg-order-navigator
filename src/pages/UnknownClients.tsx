import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  UserX,
  Loader2,
  RefreshCw,
  Search,
  Mail,
  FileText,
  UserPlus,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/DataTable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  fetchUnknownClientEvents,
  fetchOrdersWithoutClient,
  fetchClients,
  addCustomerEmail,
  assignClientToOrder,
  type UnknownClientEvent,
  type OrderWithoutClient,
} from '@/lib/ordersService';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import type { Client } from '@/types';

export default function UnknownClients() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;

  const [events, setEvents] = useState<UnknownClientEvent[]>([]);
  const [ordersWithoutClient, setOrdersWithoutClient] = useState<OrderWithoutClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state: assign sender to client
  const [assignSenderModal, setAssignSenderModal] = useState<{
    open: boolean;
    email: string;
    subject: string;
    eventId?: string;
  } | null>(null);
  const [selectedClientForSender, setSelectedClientForSender] = useState<string>('');
  const [savingSender, setSavingSender] = useState(false);

  // Modal state: assign client to order
  const [assignOrderModal, setAssignOrderModal] = useState<OrderWithoutClient | null>(null);
  const [selectedClientForOrder, setSelectedClientForOrder] = useState<string>('');
  const [savingOrder, setSavingOrder] = useState(false);

  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const [eventsData, ordersData, clientsData] = await Promise.all([
        fetchUnknownClientEvents(50),
        fetchOrdersWithoutClient(50),
        fetchClients(),
      ]);
      setEvents(eventsData);
      setOrdersWithoutClient(ordersData);
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading unknown clients data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.senderAddress?.toLowerCase().includes(q) ||
        e.subject?.toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return ordersWithoutClient;
    const q = searchQuery.toLowerCase();
    return ordersWithoutClient.filter(
      (o) =>
        o.senderAddress?.toLowerCase().includes(q) ||
        o.subject?.toLowerCase().includes(q) ||
        o.orderCode?.toLowerCase().includes(q)
    );
  }, [ordersWithoutClient, searchQuery]);

  const handleOpenAssignSender = (event: UnknownClientEvent) => {
    setAssignSenderModal({
      open: true,
      email: event.senderAddress,
      subject: event.subject,
      eventId: event.id,
    });
    setSelectedClientForSender('');
  };

  const handleAssignSender = async () => {
    if (!assignSenderModal || !selectedClientForSender) return;
    setSavingSender(true);
    try {
      const result = await addCustomerEmail(
        selectedClientForSender,
        assignSenderModal.email
      );
      if (result.success) {
        toast.success(result.message);
        setAssignSenderModal(null);
        loadData(true);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al asociar email');
    } finally {
      setSavingSender(false);
    }
  };

  const handleOpenAssignOrder = (order: OrderWithoutClient) => {
    setAssignOrderModal(order);
    setSelectedClientForOrder('');
  };

  const handleAssignOrder = async () => {
    if (!assignOrderModal || !selectedClientForOrder) return;
    setSavingOrder(true);
    try {
      const result = await assignClientToOrder(
        assignOrderModal.id,
        selectedClientForOrder
      );
      if (result.success) {
        toast.success(result.message);
        setAssignOrderModal(null);
        loadData(true);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al asignar cliente');
    } finally {
      setSavingOrder(false);
    }
  };

  const eventColumns: Column<UnknownClientEvent>[] = [
    {
      key: 'senderAddress',
      header: 'Remitente',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.senderAddress || '—'}</span>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Asunto',
      cell: (row) => (
        <span className="text-muted-foreground truncate max-w-[300px] block">
          {row.subject || '—'}
        </span>
      ),
    },
    {
      key: 'receivedAt',
      header: 'Recibido',
      cell: (row) =>
        row.receivedAt
          ? format(new Date(row.receivedAt), 'dd/MM/yyyy HH:mm', { locale: dateLocale })
          : '—',
      className: 'w-40',
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenAssignSender(row)}
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Asignar a cliente
        </Button>
      ),
      className: 'w-40',
    },
  ];

  const orderColumns: Column<OrderWithoutClient>[] = [
    {
      key: 'orderCode',
      header: 'Pedido',
      cell: (row) => (
        <Link
          to={`/orders/${row.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.orderCode}
        </Link>
      ),
    },
    {
      key: 'senderAddress',
      header: 'Remitente',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span>{row.senderAddress || '—'}</span>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Asunto',
      cell: (row) => (
        <span className="text-muted-foreground truncate max-w-[250px] block">
          {row.subject || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Creado',
      cell: (row) =>
        format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm', { locale: dateLocale }),
      className: 'w-40',
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenAssignOrder(row)}
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Asignar cliente
        </Button>
      ),
      className: 'w-40',
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{t.common?.loading || 'Cargando...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="page-header">
          <h1 className="page-title flex items-center gap-2">
            <UserX className="h-7 w-7" />
            Clientes sin asignar
          </h1>
          <p className="page-description">
            Remitentes no reconocidos y pedidos sin cliente. Asigna emails a clientes para
            que futuros pedidos se procesen correctamente.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por remitente o asunto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Section: Remitentes no reconocidos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Remitentes no reconocidos
          </h2>
          {events.length > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {events.length} pendiente{events.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Emails recibidos cuyo remitente no está en customer_emails. Asigna cada email a un
          cliente para que los próximos pedidos de ese remitente se asocien automáticamente.
        </p>
        <DataTable
          columns={eventColumns}
          data={filteredEvents}
          keyExtractor={(row) => row.id}
          emptyMessage="No hay remitentes pendientes de asignar"
        />
      </div>

      {/* Section: Pedidos sin cliente */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Pedidos sin cliente asignado
          </h2>
          {ordersWithoutClient.length > 0 && (
            <Badge variant="outline">
              {ordersWithoutClient.length} pedido{ordersWithoutClient.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Pedidos creados sin cliente. Asigna un cliente para completar el pedido.
        </p>
        <DataTable
          columns={orderColumns}
          data={filteredOrders}
          keyExtractor={(row) => row.id}
          emptyMessage="No hay pedidos sin cliente"
        />
      </div>

      {/* Modal: Asignar remitente a cliente */}
      <Dialog
        open={!!assignSenderModal?.open}
        onOpenChange={(open) => !open && setAssignSenderModal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar remitente a cliente</DialogTitle>
            <DialogDescription>
              Asocia este email a un cliente. Los futuros pedidos de este remitente se
              asignarán automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email (remitente)</Label>
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/50">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm">{assignSenderModal?.email || ''}</span>
              </div>
            </div>
            {assignSenderModal?.subject && (
              <div className="space-y-2">
                <Label>Asunto</Label>
                <p className="text-sm text-muted-foreground truncate">
                  {assignSenderModal.subject}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={selectedClientForSender}
                onValueChange={setSelectedClientForSender}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients
                    .filter((c) => c.active !== false)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignSenderModal(null)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleAssignSender}
              disabled={!selectedClientForSender || savingSender}
            >
              {savingSender ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {savingSender ? 'Asociando...' : 'Asociar email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Asignar cliente a pedido */}
      <Dialog
        open={!!assignOrderModal}
        onOpenChange={(open) => !open && setAssignOrderModal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar cliente al pedido</DialogTitle>
            <DialogDescription>
              Selecciona el cliente para este pedido. El pedido quedará asociado
              correctamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {assignOrderModal && (
              <>
                <div className="space-y-2">
                  <Label>Pedido</Label>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/orders/${assignOrderModal.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {assignOrderModal.orderCode}
                    </Link>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Remitente</Label>
                  <p className="text-sm text-muted-foreground">
                    {assignOrderModal.senderAddress || '—'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select
                    value={selectedClientForOrder}
                    onValueChange={setSelectedClientForOrder}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients
                        .filter((c) => c.active !== false)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOrderModal(null)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleAssignOrder}
              disabled={!selectedClientForOrder || savingOrder}
            >
              {savingOrder ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {savingOrder ? 'Asignando...' : 'Asignar cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
