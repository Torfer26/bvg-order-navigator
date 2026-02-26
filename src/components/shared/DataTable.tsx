import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  /** Hide this column in cards view (e.g. redundant or too verbose) */
  hideInCards?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  getRowClassName?: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  /** 'auto' = cards on mobile, table on desktop; 'table' = always table; 'cards' = always cards */
  responsiveMode?: 'table' | 'cards' | 'auto';
  /** Sort state: which column and direction. Used with onSortChange for clickable headers */
  sort?: { key: string; dir: 'asc' | 'desc' };
  /** Called when user clicks a sortable column header */
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  getRowClassName,
  loading = false,
  emptyMessage,
  responsiveMode = 'auto',
  sort,
  onSortChange,
  pagination,
}: DataTableProps<T>) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  const useCardsView =
    responsiveMode === 'cards' || (responsiveMode === 'auto' && isMobile);

  const visibleColumns = useCardsView
    ? columns.filter((col) => !col.hideInCards)
    : columns;

  const PaginationControls = () => {
    if (!pagination || totalPages <= 1) return null;
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3">
        <p className="text-sm text-muted-foreground order-2 sm:order-1">
          {t.common.showing} {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)} -{' '}
          {Math.min(pagination.page * pagination.pageSize, pagination.total)} {t.common.of} {pagination.total}
        </p>
        <div className="flex items-center gap-1 order-1 sm:order-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 min-w-[44px] sm:h-8 sm:min-w-0"
            onClick={() => pagination.onPageChange(1)}
            disabled={pagination.page === 1}
            aria-label="Primera página"
          >
            <ChevronsLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 min-w-[44px] sm:h-8 sm:min-w-0"
            onClick={() => pagination.onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span className="px-3 text-sm min-w-[4rem] text-center">
            {t.common.page} {pagination.page} {t.common.of} {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-10 min-w-[44px] sm:h-8 sm:min-w-0"
            onClick={() => pagination.onPageChange(pagination.page + 1)}
            disabled={pagination.page >= totalPages}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 min-w-[44px] sm:h-8 sm:min-w-0"
            onClick={() => pagination.onPageChange(totalPages)}
            disabled={pagination.page >= totalPages}
            aria-label="Última página"
          >
            <ChevronsRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    );
  };

  if (useCardsView) {
    return (
      <div className="section-card">
        <div className="divide-y divide-border">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-muted-foreground">{t.common.loading}</span>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              {emptyMessage || t.common.noData}
            </div>
          ) : (
            data.map((row) => (
              <div
                key={keyExtractor(row)}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onRowClick(row);
                  }
                }}
                className={cn(
                  'p-4 space-y-2 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  getRowClassName?.(row)
                )}
              >
                {visibleColumns.map((column) => (
                  <div key={column.key} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                    {column.header && (
                      <span className="text-xs font-medium text-muted-foreground shrink-0 sm:w-28">
                        {column.header}
                      </span>
                    )}
                    <div className={cn('text-sm min-w-0', column.className, !column.header && 'sm:ml-28')}>
                      {column.cell(row)}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
        <PaginationControls />
      </div>
    );
  }

  return (
    <div className="section-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const isSortable = column.sortable && onSortChange;
                const isActive = sort?.key === column.key;
                const handleHeaderClick = () => {
                  if (!isSortable) return;
                  const newDir = isActive && sort?.dir === 'desc' ? 'asc' : 'desc';
                  onSortChange(column.key, newDir);
                };
                return (
                  <TableHead
                    key={column.key}
                    className={cn(
                      'data-table-header',
                      column.className,
                      isSortable && 'cursor-pointer select-none hover:bg-muted/50'
                    )}
                    onClick={handleHeaderClick}
                  >
                    <div className="flex items-center gap-1">
                      {column.header}
                      {isSortable && (
                        <span className="inline-flex text-muted-foreground">
                          {!isActive ? (
                            <ArrowUpDown className="h-4 w-4" aria-hidden />
                          ) : sort?.dir === 'desc' ? (
                            <ArrowDown className="h-4 w-4" aria-hidden />
                          ) : (
                            <ArrowUp className="h-4 w-4" aria-hidden />
                          )}
                        </span>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-muted-foreground">{t.common.loading}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  {emptyMessage || t.common.noData}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-muted/50',
                    getRowClassName?.(row)
                  )}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <PaginationControls />
    </div>
  );
}
