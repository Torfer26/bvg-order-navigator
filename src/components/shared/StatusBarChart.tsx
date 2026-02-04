import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// STATUS CONFIG - Colores y etiquetas unificadas
// ============================================================================
export const STATUS_CONFIG: Record<string, { 
  color: string; 
  bgLight: string;
  bgDark: string;
  label: string;
  icon?: string;
}> = {
  COMPLETED: { 
    color: '#10b981', 
    bgLight: 'bg-emerald-100', 
    bgDark: 'dark:bg-emerald-900/30',
    label: 'Completado' 
  },
  PROCESSING: { 
    color: '#3b82f6', 
    bgLight: 'bg-blue-100', 
    bgDark: 'dark:bg-blue-900/30',
    label: 'Procesando' 
  },
  VALIDATING: { 
    color: '#6366f1', 
    bgLight: 'bg-indigo-100', 
    bgDark: 'dark:bg-indigo-900/30',
    label: 'Validando' 
  },
  RECEIVED: { 
    color: '#8b5cf6', 
    bgLight: 'bg-violet-100', 
    bgDark: 'dark:bg-violet-900/30',
    label: 'Recibido' 
  },
  IN_REVIEW: { 
    color: '#f59e0b', 
    bgLight: 'bg-amber-100', 
    bgDark: 'dark:bg-amber-900/30',
    label: 'En revisión' 
  },
  APPROVED: { 
    color: '#14b8a6', 
    bgLight: 'bg-teal-100', 
    bgDark: 'dark:bg-teal-900/30',
    label: 'Aprobado' 
  },
  AWAITING_INFO: { 
    color: '#f97316', 
    bgLight: 'bg-orange-100', 
    bgDark: 'dark:bg-orange-900/30',
    label: 'Esperando info' 
  },
  REJECTED: { 
    color: '#ef4444', 
    bgLight: 'bg-red-100', 
    bgDark: 'dark:bg-red-900/30',
    label: 'Rechazado' 
  },
  ERROR: { 
    color: '#dc2626', 
    bgLight: 'bg-red-100', 
    bgDark: 'dark:bg-red-900/30',
    label: 'Error' 
  },
  PARSING: { 
    color: '#a855f7', 
    bgLight: 'bg-purple-100', 
    bgDark: 'dark:bg-purple-900/30',
    label: 'Analizando' 
  },
};

// ============================================================================
// TYPES
// ============================================================================
export interface StatusDistribution {
  status: string;
  count: number;
}

export interface StatusBarChartProps {
  data: StatusDistribution[];
  title?: string;
  description?: string;
  showTotal?: boolean;
  maxItems?: number;
  baseUrl?: string;
}

// ============================================================================
// STATUS BAR CHART COMPONENT
// ============================================================================
export function StatusBarChart({
  data,
  title = "Estado de Pedidos",
  description = "Distribución por estado",
  showTotal = true,
  maxItems = 8,
  baseUrl = '/orders',
}: StatusBarChartProps) {
  const total = data.reduce((sum, s) => sum + s.count, 0);
  const maxCount = Math.max(...data.map(s => s.count), 1);
  const displayData = data.slice(0, maxItems);

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Activity className="h-12 w-12 mb-3 opacity-50" />
        <p className="font-medium">Sin datos de estado</p>
        <p className="text-sm">No hay pedidos en el período seleccionado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {showTotal && (
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm text-muted-foreground">Total en período</h4>
            <p className="text-2xl font-bold">{total.toLocaleString('es-ES')}</p>
          </div>
        </div>
      )}

      {/* Bars */}
      <div className="space-y-2">
        {displayData.map((status) => {
          const config = STATUS_CONFIG[status.status] || { 
            color: '#6b7280', 
            bgLight: 'bg-gray-100',
            bgDark: 'dark:bg-gray-800',
            label: status.status 
          };
          const percentage = total > 0 ? (status.count / total) * 100 : 0;
          const barWidth = maxCount > 0 ? (status.count / maxCount) * 100 : 0;
          
          return (
            <Link 
              key={status.status}
              to={`${baseUrl}?status=${status.status}`}
              className={cn(
                "group flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200",
                "hover:bg-muted/60 hover:shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/20"
              )}
            >
              {/* Status indicator dot */}
              <div 
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: config.color }}
              />
              
              {/* Status label */}
              <div className="w-28 shrink-0">
                <span className="text-sm font-medium truncate">
                  {config.label}
                </span>
              </div>
              
              {/* Bar container */}
              <div className="flex-1 h-7 bg-muted/40 rounded-full overflow-hidden relative">
                {/* Animated bar */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2"
                  style={{ 
                    width: `${Math.max(barWidth, 8)}%`,
                    backgroundColor: config.color,
                  }}
                >
                  {/* Count inside bar if wide enough */}
                  {barWidth > 25 && (
                    <span className="text-xs font-semibold text-white">
                      {status.count.toLocaleString('es-ES')}
                    </span>
                  )}
                </div>
                
                {/* Count outside bar if narrow */}
                {barWidth <= 25 && (
                  <span 
                    className="absolute inset-y-0 flex items-center text-xs font-semibold"
                    style={{ left: `${Math.max(barWidth, 8) + 2}%` }}
                  >
                    {status.count.toLocaleString('es-ES')}
                  </span>
                )}
              </div>
              
              {/* Percentage */}
              <div className="w-14 text-right shrink-0">
                <span className="text-sm font-medium text-muted-foreground">
                  {percentage.toFixed(0)}%
                </span>
              </div>
              
              {/* Arrow on hover */}
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          );
        })}
      </div>

      {/* Show more link if there are more items */}
      {data.length > maxItems && (
        <Link 
          to={baseUrl}
          className="flex items-center justify-center gap-1 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Ver todos los estados ({data.length})
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

// ============================================================================
// COMPACT VERSION FOR SMALLER SPACES
// ============================================================================
export function StatusBarChartCompact({
  data,
  baseUrl = '/orders',
}: {
  data: StatusDistribution[];
  baseUrl?: string;
}) {
  const total = data.reduce((sum, s) => sum + s.count, 0);
  
  if (total === 0) return null;

  // Calculate cumulative percentages for stacked bar
  let cumulative = 0;
  const segments = data.map((status) => {
    const percentage = (status.count / total) * 100;
    const start = cumulative;
    cumulative += percentage;
    return { ...status, start, percentage };
  });

  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="h-3 w-full rounded-full overflow-hidden flex">
        {segments.map((segment) => {
          const config = STATUS_CONFIG[segment.status] || { color: '#6b7280' };
          return (
            <div
              key={segment.status}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
              style={{ 
                width: `${segment.percentage}%`,
                backgroundColor: config.color,
              }}
              title={`${STATUS_CONFIG[segment.status]?.label || segment.status}: ${segment.count} (${segment.percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {data.slice(0, 5).map((status) => {
          const config = STATUS_CONFIG[status.status];
          return (
            <Link
              key={status.status}
              to={`${baseUrl}?status=${status.status}`}
              className="flex items-center gap-1.5 text-xs hover:underline"
            >
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: config?.color || '#6b7280' }}
              />
              <span className="text-muted-foreground">
                {config?.label || status.status}:
              </span>
              <span className="font-medium">{status.count}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default StatusBarChart;
