import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchOrders, fetchClients } from '@/lib/ordersService';
import { useLanguage } from '@/contexts/LanguageContext';
import type { OrderIntake, OrderFilters, Client } from '@/types';
import { format, formatDistanceToNow } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PAGE_SIZE = 10;

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;

  // Read URL params for filtering
  const urlStatus = searchParams.get('status');
  const urlLocationStatus = searchParams.get('locationStatus');

  const [filters, setFilters] = useState<OrderFilters>({});
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderIntake[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Clear URL filter
  const clearUrlFilter = () => {
    setSearchParams({});
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [ordersData, clientsData] = await Promise.all([
          fetchOrders(),
          fetchClients(),
        ]);
        setOrders(ordersData);
        setClients(clientsData);
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calculate counts for tabs
  const statusCounts = useMemo(() => {
    const counts = {
      all: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      error: 0
    };

    orders.forEach(order => {
      counts.all++;
      const status = order.status?.toLowerCase() || 'pending';
      if (status === 'recibido' || status === 'validating' || status === 'in_review') {
        counts.pending++;
      } else if (status === 'processing' || status === 'generating_csv' || status === 'sent_ftp') {
        counts.processing++;
      } else if (status === 'completed' || status === 'received') { // Assuming 'received' might be final in some flows or mapped to completed
        // Actually based on previous conversations 'RECEIVED' is initial. Let's map carefully.
        // Mapping based on common sense of the statuses seen: 
        // PENDING: VALIDATING, IN_REVIEW, RECEIVED (initial)
        // PROCESSING: PROCESSING, GENERATING_CSV, SENT_FTP
        // COMPLETED: COMPLETED
        // ERROR: ERROR
      }

      // Simpler mapping based on strict strings if possible, or use the StatusBadge logic
      if (['received', 'validating', 'in_review', 'validated'].includes(status)) counts.pending++;
      else if (['processing', 'generating_csv', 'sent_ftp'].includes(status)) counts.processing++;
      else if (['completed'].includes(status)) counts.completed++;
      else if (['error'].includes(status)) counts.error++;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filters.clientId && order.clientId !== filters.clientId) return false;

      // URL status filter (exact match, case-insensitive)
      if (urlStatus) {
        const orderStatus = order.status?.toUpperCase();
        const filterStatus = urlStatus.toUpperCase();
        
        // Handle grouped statuses
        if (filterStatus === 'VALIDATING') {
          // Include both VALIDATING and IN_REVIEW
          if (!['VALIDATING', 'IN_REVIEW'].includes(orderStatus)) return false;
        } else {
          // Exact match for other statuses
          if (orderStatus !== filterStatus) return false;
        }
      }

      // Tab-based status filtering (legacy)
      if (filters.status && !urlStatus) {
        const s = filters.status;
        const orderStatus = order.status?.toLowerCase();
        if (s === 'pending') {
          if (!['received', 'validating', 'in_review', 'validated'].includes(orderStatus)) return false;
        } else if (s === 'processing') {
          if (!['processing', 'generating_csv', 'sent_ftp'].includes(orderStatus)) return false;
        } else if (s === 'completed') {
          if (orderStatus !== 'completed') return false;
        } else if (s === 'error') {
          if (orderStatus !== 'error') return false;
        } else if (s === 'rejected') {
          if (orderStatus !== 'rejected') return false;
        }
      }

      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (
          !order.orderCode.toLowerCase().includes(search) &&
          !order.subject.toLowerCase().includes(search) &&
          !order.clientName.toLowerCase().includes(search) &&
          !order.senderAddress.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(order.receivedAt) < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(order.receivedAt) > to) return false;
      }
      return true;
    });
  }, [orders, filters, urlStatus]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page]);

  const columns: Column<OrderIntake>[] = [
    {
      key: 'orderCode',
      header: t.orders.orderCode,
      cell: (row) => <span className="font-medium">{row.orderCode}</span>,
    },
    {
      key: 'client',
      header: t.common.client,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
            {row.clientName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-sm">{row.clientName}</p>
            <p className="text-xs text-muted-foreground">{row.senderAddress}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'subject',
      header: t.orders.subject,
      cell: (row) => (
        <p className="max-w-[300px] truncate" title={row.subject}>
          {row.subject}
        </p>
      ),
    },
    {
      key: 'lines',
      header: t.orders.linesCount,
      cell: (row) => row.linesCount,
      className: 'text-center',
    },
    {
      key: 'status',
      header: t.common.status,
      cell: (row) => <OrderStatusBadge status={row.status} />,
    },
    {
      key: 'receivedAt',
      header: t.orders.receivedAt,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {formatDistanceToNow(new Date(row.receivedAt), { addSuffix: true, locale: dateLocale })}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(row.receivedAt), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}
          </span>
        </div>
      ),
    },
  ];

  const handleFilterChange = (key: string, value: string | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({});
    setPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Status labels for URL filter badge
  const statusLabels: Record<string, string> = {
    'RECEIVED': 'Recibidos',
    'VALIDATING': 'Validando',
    'IN_REVIEW': 'En Revisión',
    'PROCESSING': 'Procesando',
    'COMPLETED': 'Completados',
    'REJECTED': 'Rechazados',
    'ERROR': 'Con Error',
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">{t.orders.title}</h1>
        <p className="page-description">{t.orders.subtitle}</p>
      </div>

      {/* URL Filter indicator */}
      {urlStatus && (
        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm text-muted-foreground">Filtro activo:</span>
          <Badge variant="secondary" className="gap-1">
            {statusLabels[urlStatus.toUpperCase()] || urlStatus}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={clearUrlFilter}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
          <span className="text-sm text-muted-foreground">
            ({filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'})
          </span>
        </div>
      )}

      <Tabs
        defaultValue="all"
        className="mb-6"
        onValueChange={(val) => handleFilterChange('status', val === 'all' ? undefined : val)}
      >
        <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
          <TabsTrigger value="all">
            Todo <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{statusCounts.all}</span>
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pendientes <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">{statusCounts.pending}</span>
          </TabsTrigger>
          <TabsTrigger value="processing">
            Procesando <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{statusCounts.processing}</span>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Hecho <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">{statusCounts.completed}</span>
          </TabsTrigger>
          <TabsTrigger value="error">
            Error <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{statusCounts.error}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar
        filters={[
          { key: 'search', type: 'search', label: t.common.search, placeholder: t.orders.searchPlaceholder },
          {
            key: 'clientId',
            type: 'select',
            label: t.common.client,
            options: clients.map((c) => ({ value: c.id, label: c.name })),
          },
          // Removed Status select as it is now handled by Tabs
          { key: 'dateFrom', type: 'date', label: t.common.from },
          { key: 'dateTo', type: 'date', label: t.common.to },
        ]}
        values={filters as Record<string, string | undefined>}
        onChange={handleFilterChange}
        onClear={() => {
          handleFilterChange('status', undefined); // Reset tabs implicitly if needed, or keep tabs state separate
          handleClearFilters();
        }}
      />

      <DataTable
        columns={columns}
        data={paginatedOrders}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
        emptyMessage={t.orders.noOrdersFound}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: filteredOrders.length,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
