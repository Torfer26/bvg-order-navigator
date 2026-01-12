import React, { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { DLQStatusBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { mockDLQOrders } from '@/lib/mockData';
import type { DLQOrder, DLQFilters } from '@/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PAGE_SIZE = 10;

export default function DLQ() {
  const { hasRole } = useAuth();
  const [filters, setFilters] = useState<DLQFilters>({});
  const [page, setPage] = useState(1);
  const [selectedDLQ, setSelectedDLQ] = useState<DLQOrder | null>(null);
  const [actionType, setActionType] = useState<'resolve' | 'retry' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredOrders = useMemo(() => {
    return mockDLQOrders.filter((order) => {
      if (filters.resolved !== undefined && order.resolved !== filters.resolved) return false;
      if (filters.errorCode && order.errorCode !== filters.errorCode) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (
          !order.orderCode.toLowerCase().includes(search) &&
          !order.clientName.toLowerCase().includes(search) &&
          !order.errorMessage.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [filters]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page]);

  const errorCodes = useMemo(() => {
    const codes = new Set(mockDLQOrders.map((o) => o.errorCode));
    return Array.from(codes).map((code) => ({ value: code, label: code }));
  }, []);

  const handleAction = async () => {
    if (!selectedDLQ || !actionType) return;
    
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsProcessing(false);
    
    if (actionType === 'resolve') {
      toast.success(`Ordine ${selectedDLQ.orderCode} marcato come risolto`);
    } else {
      toast.success(`Reinvio ordine ${selectedDLQ.orderCode} avviato`);
    }
    
    setSelectedDLQ(null);
    setActionType(null);
  };

  const columns: Column<DLQOrder>[] = [
    {
      key: 'orderCode',
      header: 'Codice Ordine',
      cell: (row) => <span className="font-medium">{row.orderCode}</span>,
    },
    {
      key: 'client',
      header: 'Cliente',
      cell: (row) => row.clientName,
    },
    {
      key: 'error',
      header: 'Errore',
      cell: (row) => (
        <div>
          <StatusBadge status="error" label={row.errorCode} />
          <p className="mt-1 text-sm text-muted-foreground">{row.errorMessage}</p>
        </div>
      ),
    },
    {
      key: 'retryCount',
      header: 'Tentativi',
      cell: (row) => row.retryCount,
      className: 'text-center',
    },
    {
      key: 'status',
      header: 'Stato',
      cell: (row) => <DLQStatusBadge resolved={row.resolved} />,
    },
    {
      key: 'createdAt',
      header: 'Data',
      cell: (row) => format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm', { locale: it }),
    },
  ];

  if (hasRole(['admin', 'ops'])) {
    columns.push({
      key: 'actions',
      header: 'Azioni',
      cell: (row) =>
        !row.resolved ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDLQ(row);
                setActionType('resolve');
              }}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Risolvi
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDLQ(row);
                setActionType('retry');
              }}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Riprova
            </Button>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            Risolto da {row.resolvedBy}
          </span>
        ),
    });
  }

  const handleFilterChange = (key: string, value: string | undefined) => {
    const newFilters = { ...filters };
    if (key === 'resolved') {
      newFilters.resolved = value === 'true' ? true : value === 'false' ? false : undefined;
    } else {
      (newFilters as Record<string, string | undefined>)[key] = value;
    }
    setFilters(newFilters);
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({});
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Dead Letter Queue</h1>
        <p className="page-description">
          Gestisci gli ordini che non sono stati elaborati correttamente
        </p>
      </div>

      <FilterBar
        filters={[
          { key: 'search', type: 'search', label: 'Cerca', placeholder: 'Cerca per codice, cliente, errore...' },
          {
            key: 'resolved',
            type: 'select',
            label: 'Stato',
            options: [
              { value: 'false', label: 'Da risolvere' },
              { value: 'true', label: 'Risolti' },
            ],
          },
          {
            key: 'errorCode',
            type: 'select',
            label: 'Tipo errore',
            options: errorCodes,
          },
        ]}
        values={{
          ...filters,
          resolved: filters.resolved === undefined ? undefined : String(filters.resolved),
        }}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      <DataTable
        columns={columns}
        data={paginatedOrders}
        keyExtractor={(row) => row.id}
        emptyMessage="Nessun ordine nella DLQ"
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: filteredOrders.length,
          onPageChange: setPage,
        }}
      />

      {/* Action Dialog */}
      <Dialog open={!!selectedDLQ && !!actionType} onOpenChange={() => { setSelectedDLQ(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'resolve' ? 'Conferma Risoluzione' : 'Conferma Reinvio'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'resolve'
                ? `Sei sicuro di voler marcare l'ordine ${selectedDLQ?.orderCode} come risolto?`
                : `Sei sicuro di voler reinviare l'ordine ${selectedDLQ?.orderCode} per rielaborazione?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedDLQ(null); setActionType(null); }}>
              Annulla
            </Button>
            <Button onClick={handleAction} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
