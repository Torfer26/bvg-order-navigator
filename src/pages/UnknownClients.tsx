import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  UserX,
  Loader2,
  RefreshCw,
  Search,
  Mail,
  UserPlus,
  AlertCircle,
  Trash2,
  Users,
  BookUser,
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
  fetchDismissedOrderIds,
  fetchClients,
  fetchCustomerEmails,
  fetchCustomerEmailsWithClients,
  addCustomerEmail,
  assignClientToOrder,
  dismissUnknownClientEvent,
  dismissOrderPending,
  type UnknownClientEvent,
  type OrderWithoutClient,
  type CustomerEmailWithClient,
} from '@/lib/ordersService';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import type { Client } from '@/types';

/** Unified pending item: unique sender with optional event + orders */
interface PendingItem {
  senderKey: string;
  senderAddress: string;
  subject: string;
  receivedAt: string;
  event?: UnknownClientEvent;
  orders: OrderWithoutClient[];
}

export default function UnknownClients() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [customerEmails, setCustomerEmails] = useState<CustomerEmailWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal: assign sender (and optionally orders) to client
  const [assignModal, setAssignModal] = useState<{
    senderAddress: string;
    eventId?: string;
    orders: OrderWithoutClient[];
  } | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const [dismissedIds, customerEmailsData] = await Promise.all([
        fetchDismissedOrderIds(),
        fetchCustomerEmails(),
      ]);

      const [eventsData, ordersData, clientsData, emailsWithClients] = await Promise.all([
        fetchUnknownClientEvents(50),
        fetchOrdersWithoutClient(50, dismissedIds),
        fetchClients(),
        fetchCustomerEmailsWithClients(),
      ]);

      const resolvedEmails = new Set(
        customerEmailsData
          .filter((ce) => ce.active !== false && ce.email)
          .map((ce) => (ce.email as string).toLowerCase().trim())
      );

      const pendingEvents = eventsData.filter((e) => {
        const addr = (e.senderAddress || '').toLowerCase().trim();
        return addr && !resolvedEmails.has(addr);
      });

      // Merge by sender: unique senders with their event + orders
      const bySender = new Map<string, PendingItem>();

      for (const ev of pendingEvents) {
        const key = (ev.senderAddress || '').toLowerCase().trim();
        if (!key) continue;
        const existing = bySender.get(key);
        if (existing) {
          existing.event = ev;
          existing.receivedAt = ev.receivedAt || existing.receivedAt;
          existing.subject = ev.subject || existing.subject;
        } else {
          bySender.set(key, {
            senderKey: key,
            senderAddress: ev.senderAddress || '',
            subject: ev.subject || '',
            receivedAt: ev.receivedAt || '',
            event: ev,
            orders: [],
          });
        }
      }

      for (const ord of ordersData) {
        const key = (ord.senderAddress || '').toLowerCase().trim();
        if (!key) continue;
        const existing = bySender.get(key);
        if (existing) {
          existing.orders.push(ord);
        } else {
          bySender.set(key, {
            senderKey: key,
            senderAddress: ord.senderAddress || '',
            subject: ord.subject || '',
            receivedAt: ord.createdAt || '',
            orders: [ord],
          });
        }
      }

      setPendingItems(Array.from(bySender.values()).sort(
        (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
      ));
      setCustomerEmails(emailsWithClients);
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

  const filteredPending = useMemo(() => {
    if (!searchQuery.trim()) return pendingItems;
    const q = searchQuery.toLowerCase();
    return pendingItems.filter(
      (p) =>
        p.senderAddress?.toLowerCase().includes(q) ||
        p.subject?.toLowerCase().includes(q) ||
        p.orders.some((o) => o.orderCode?.toLowerCase().includes(q))
    );
  }, [pendingItems, searchQuery]);

  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return customerEmails;
    const q = searchQuery.toLowerCase();
    return customerEmails.filter(
      (ce) =>
        ce.email?.toLowerCase().includes(q) ||
        ce.clientName?.toLowerCase().includes(q) ||
        ce.clientCode?.toLowerCase().includes(q)
    );
  }, [customerEmails, searchQuery]);

  const handleOpenAssign = (item: PendingItem) => {
    setAssignModal({
      senderAddress: item.senderAddress,
      eventId: item.event?.id,
      orders: item.orders,
    });
    setSelectedClient('');
  };

  const handleAssign = async () => {
    if (!assignModal || !selectedClient) return;
    setSaving(true);
    try {
      // 1. Add sender to customer_emails (if new sender - ignore "ya existe")
      if (assignModal.senderAddress) {
        const addRes = await addCustomerEmail(selectedClient, assignModal.senderAddress);
        if (!addRes.success && !addRes.message.includes('ya está asociado') && !addRes.message.includes('ya existe')) {
          toast.error(addRes.message);
          setSaving(false);
          return;
        }
      }
      // 2. Assign all orders to the client
      for (const ord of assignModal.orders) {
        await assignClientToOrder(ord.id, selectedClient);
      }
      toast.success(
        assignModal.orders.length > 0
          ? `Cliente asignado. ${assignModal.orders.length} pedido(s) actualizado(s).`
          : 'Email asociado correctamente al cliente'
      );
      setAssignModal(null);
      loadData(true);
    } catch (error) {
      toast.error('Error al asignar');
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = async (item: PendingItem) => {
    const key = item.senderKey;
    setDismissing(key);
    try {
      if (item.event) {
        const res = await dismissUnknownClientEvent(item.event.id);
        if (!res.success) {
          toast.error(res.message);
          return;
        }
      }
      for (const ord of item.orders) {
        await dismissOrderPending(ord.id);
      }
      toast.success('Descartado correctamente');
      setPendingItems((prev) => prev.filter((p) => p.senderKey !== key));
    } catch {
      toast.error('Error al descartar');
    } finally {
      setDismissing(null);
    }
  };

  const pendingColumns: Column<PendingItem>[] = [
    {
      key: 'senderAddress',
      header: 'Remitente',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{row.senderAddress || '—'}</span>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Asunto',
      cell: (row) => (
        <span className="text-muted-foreground truncate max-w-[280px] block">
          {row.subject || '—'}
        </span>
      ),
    },
    {
      key: 'orders',
      header: 'Pedidos',
      cell: (row) =>
        row.orders.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.orders.slice(0, 3).map((o) => (
              <Link
                key={o.id}
                to={`/orders/${o.id}`}
                className="text-primary hover:underline text-sm"
              >
                {o.orderCode}
              </Link>
            ))}
            {row.orders.length > 3 && (
              <span className="text-muted-foreground text-sm">+{row.orders.length - 3}</span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
      className: 'w-48',
    },
    {
      key: 'receivedAt',
      header: 'Recibido',
      cell: (row) =>
        row.receivedAt
          ? format(new Date(row.receivedAt), 'dd/MM/yyyy HH:mm', { locale: dateLocale })
          : '—',
      className: 'w-36',
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenAssign(row);
            }}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Asignar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss(row);
            }}
            disabled={dismissing === row.senderKey}
            className="text-muted-foreground hover:text-destructive"
          >
            {dismissing === row.senderKey ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1" />
                Descartar
              </>
            )}
          </Button>
        </div>
      ),
      className: 'w-48',
    },
  ];

  const emailColumns: Column<CustomerEmailWithClient>[] = [
    {
      key: 'clientName',
      header: 'Cliente',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{row.clientName || row.clientCode}</span>
          <span className="text-muted-foreground text-sm">({row.clientCode})</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      cell: (row) => (
        <span className="font-mono text-sm">{row.email || '—'}</span>
      ),
    },
    {
      key: 'emailType',
      header: 'Tipo',
      cell: (row) => (
        <Badge variant="outline" className="font-normal">
          {row.emailType || 'PRIMARY'}
        </Badge>
      ),
      className: 'w-24',
    },
    {
      key: 'active',
      header: 'Activo',
      cell: (row) => (
        <Badge variant={row.active ? 'default' : 'secondary'}>
          {row.active ? 'Sí' : 'No'}
        </Badge>
      ),
      className: 'w-20',
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="page-header">
          <h1 className="page-title flex items-center gap-2">
            <UserX className="h-7 w-7" />
            Clientes sin asignar
          </h1>
          <p className="page-description">
            Remitentes no reconocidos y pedidos sin cliente. Asigna emails a clientes o
            descarta los que no quieras tratar.
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
          placeholder="Buscar por remitente, asunto o pedido..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Section: Pendientes (unified) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Pendientes de asignar
          </h2>
          {pendingItems.length > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {pendingItems.length} pendiente{pendingItems.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Remitentes no reconocidos y pedidos sin cliente. Agrupados por email. Asigna o
          descarta para sacarlos de la lista.
        </p>
        <DataTable
          columns={pendingColumns}
          data={filteredPending}
          keyExtractor={(row) => row.senderKey}
          emptyMessage="No hay pendientes de asignar"
        />
      </div>

      {/* Section: Clientes y emails (customer_emails) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookUser className="h-5 w-5 text-muted-foreground" />
            Relación clientes – emails
          </h2>
          <Badge variant="outline">
            {customerEmails.length} asociación{customerEmails.length !== 1 ? 'es' : ''}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Emails asociados a clientes en <code className="text-xs">customer_emails</code>.
          Los futuros pedidos de estos remitentes se asignan automáticamente.
        </p>
        <DataTable
          columns={emailColumns}
          data={filteredEmails}
          keyExtractor={(row) => row.id}
          emptyMessage="No hay asociaciones cliente-email"
        />
      </div>

      {/* Modal: Asignar */}
      <Dialog open={!!assignModal} onOpenChange={(open) => !open && setAssignModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar a cliente</DialogTitle>
            <DialogDescription>
              Asocia este remitente a un cliente. Si tiene pedidos, también se asignarán.
            </DialogDescription>
          </DialogHeader>
          {assignModal && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Remitente</Label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/50">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">{assignModal.senderAddress}</span>
                </div>
              </div>
              {assignModal.orders.length > 0 && (
                <div className="space-y-2">
                  <Label>Pedidos que se asignarán</Label>
                  <div className="flex flex-wrap gap-2">
                    {assignModal.orders.map((o) => (
                      <Link
                        key={o.id}
                        to={`/orders/${o.id}`}
                        className="text-primary hover:underline text-sm font-medium"
                      >
                        {o.orderCode}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
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
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModal(null)}>
              {t.common?.cancel || 'Cancelar'}
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedClient || saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Asignando...' : 'Asignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
