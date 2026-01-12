import React, { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { DLQStatusBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { mockDLQOrders } from '@/lib/mockData';
import { useLanguage, interpolate } from '@/contexts/LanguageContext';
import type { DLQOrder, DLQFilters } from '@/types';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
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
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;
  
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
      toast.success(interpolate(t.dlq.markedResolved, { orderCode: selectedDLQ.orderCode }));
    } else {
      toast.success(interpolate(t.dlq.retryStarted, { orderCode: selectedDLQ.orderCode }));
    }
    
    setSelectedDLQ(null);
    setActionType(null);
  };

  const columns: Column<DLQOrder>[] = [
    {
      key: 'orderCode',
      header: t.orders.orderCode,
      cell: (row) => <span className="font-medium">{row.orderCode}</span>,
    },
    {
      key: 'client',
      header: t.common.client,
      cell: (row) => row.clientName,
    },
    {
      key: 'error',
      header: t.dlq.errorCode,
      cell: (row) => (
        <div>
          <StatusBadge status="error" label={row.errorCode} />
          <p className="mt-1 text-sm text-muted-foreground">{row.errorMessage}</p>
        </div>
      ),
    },
    {
      key: 'retryCount',
      header: t.dlq.retryCount,
      cell: (row) => row.retryCount,
      className: 'text-center',
    },
    {
      key: 'status',
      header: t.common.status,
      cell: (row) => <DLQStatusBadge resolved={row.resolved} />,
    },
    {
      key: 'createdAt',
      header: t.common.date,
      cell: (row) => format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm', { locale: dateLocale }),
    },
  ];

  if (hasRole(['admin', 'ops'])) {
    columns.push({
      key: 'actions',
      header: t.common.actions,
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
              {t.dlq.resolve}
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
              {t.dlq.retry}
            </Button>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t.dlq.resolvedBy} {row.resolvedBy}
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
        <h1 className="page-title">{t.dlq.title}</h1>
        <p className="page-description">{t.dlq.subtitle}</p>
      </div>

      <FilterBar
        filters={[
          { key: 'search', type: 'search', label: t.common.search, placeholder: t.dlq.searchPlaceholder },
          {
            key: 'resolved',
            type: 'select',
            label: t.common.status,
            options: [
              { value: 'false', label: t.dlq.unresolved },
              { value: 'true', label: t.dlq.resolved },
            ],
          },
          {
            key: 'errorCode',
            type: 'select',
            label: t.dlq.errorType,
            options: errorCodes,
          },
        ]}
        values={{
          ...filters,
          resolved: filters.resolved === undefined ? undefined : String(filters.resolved),
        } as Record<string, string | undefined>}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      <DataTable
        columns={columns}
        data={paginatedOrders}
        keyExtractor={(row) => row.id}
        emptyMessage={t.dlq.noDLQOrders}
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
              {actionType === 'resolve' ? t.dlq.confirmResolve : t.dlq.confirmRetry}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'resolve'
                ? interpolate(t.dlq.resolveMessage, { orderCode: selectedDLQ?.orderCode || '' })
                : interpolate(t.dlq.retryMessage, { orderCode: selectedDLQ?.orderCode || '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedDLQ(null); setActionType(null); }}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleAction} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
