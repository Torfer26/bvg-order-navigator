import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { mockOrders, mockClients } from '@/lib/mockData';
import type { OrderIntake, OrderFilters } from '@/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const PAGE_SIZE = 10;

export default function Orders() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<OrderFilters>({});
  const [page, setPage] = useState(1);

  const filteredOrders = useMemo(() => {
    return mockOrders.filter((order) => {
      if (filters.clientId && order.clientId !== filters.clientId) return false;
      if (filters.status && order.status !== filters.status) return false;
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
  }, [filters]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page]);

  const columns: Column<OrderIntake>[] = [
    {
      key: 'orderCode',
      header: 'Codice Ordine',
      cell: (row) => <span className="font-medium">{row.orderCode}</span>,
    },
    {
      key: 'client',
      header: 'Cliente',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.clientName}</p>
          <p className="text-sm text-muted-foreground">{row.senderAddress}</p>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Oggetto',
      cell: (row) => (
        <p className="max-w-[300px] truncate" title={row.subject}>
          {row.subject}
        </p>
      ),
    },
    {
      key: 'lines',
      header: 'Righe',
      cell: (row) => row.linesCount,
      className: 'text-center',
    },
    {
      key: 'status',
      header: 'Stato',
      cell: (row) => <OrderStatusBadge status={row.status} />,
    },
    {
      key: 'receivedAt',
      header: 'Ricevuto',
      cell: (row) => format(new Date(row.receivedAt), 'dd/MM/yyyy HH:mm', { locale: it }),
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

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Ordini Intake</h1>
        <p className="page-description">
          Visualizza e gestisci gli ordini ricevuti via email
        </p>
      </div>

      <FilterBar
        filters={[
          { key: 'search', type: 'search', label: 'Cerca', placeholder: 'Cerca per codice, cliente, oggetto...' },
          {
            key: 'clientId',
            type: 'select',
            label: 'Cliente',
            options: mockClients.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            key: 'status',
            type: 'select',
            label: 'Stato',
            options: [
              { value: 'pending', label: 'In attesa' },
              { value: 'processing', label: 'In elaborazione' },
              { value: 'completed', label: 'Completato' },
              { value: 'error', label: 'Errore' },
            ],
          },
        { key: 'dateFrom', type: 'date', label: 'Da' },
          { key: 'dateTo', type: 'date', label: 'A' },
        ]}
        values={filters as Record<string, string | undefined>}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      <DataTable
        columns={columns}
        data={paginatedOrders}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
        emptyMessage="Nessun ordine trovato con i filtri selezionati"
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
