import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Calendar, 
  RefreshCw, 
  Building2, 
  MapPin,
  Warehouse,
  Filter,
  X,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

// ============================================================================
// TYPES
// ============================================================================
export type PeriodPreset = '7d' | '30d' | '90d' | 'custom';
export type ComparisonPeriod = 'previous' | 'lastMonth' | 'lastYear' | 'none';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AnalyticsFilters {
  periodPreset: PeriodPreset;
  customRange: DateRange;
  comparisonPeriod: ComparisonPeriod;
  clientId?: string;
  regionId?: string;       // región destino (entregas)
  originRegionId?: string;  // región origen (carga)
}

export interface ClientOption {
  id: string;
  name: string;
}

export interface RegionOption {
  id: string;
  name: string;
}

// ============================================================================
// DATA FRESHNESS INDICATOR
// ============================================================================
interface DataFreshnessProps {
  lastUpdated: Date;
  isLoading: boolean;
  onRefresh: () => void;
}

function DataFreshnessIndicator({ lastUpdated, isLoading, onRefresh }: DataFreshnessProps) {
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / 60000);
  
  // Determine freshness status
  const isStale = diffMinutes > 5;
  const isVeryStale = diffMinutes > 15;

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
      isVeryStale 
        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
        : isStale 
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
    )}>
      {/* Status dot */}
      <div className="relative">
        <div className={cn(
          "w-2 h-2 rounded-full",
          isVeryStale ? "bg-red-500" : isStale ? "bg-amber-500" : "bg-emerald-500"
        )} />
        {isStale && (
          <div className={cn(
            "absolute inset-0 w-2 h-2 rounded-full animate-ping",
            isVeryStale ? "bg-red-500" : "bg-amber-500"
          )} />
        )}
      </div>
      
      {/* Time info */}
      <Clock className="h-3 w-3" />
      <span>
        {isVeryStale 
          ? `Datos de hace ${diffMinutes} min` 
          : isStale 
          ? `Actualizado hace ${diffMinutes} min`
          : diffMinutes === 0 
          ? 'Actualizado ahora'
          : `Actualizado hace ${diffMinutes} min`
        }
      </span>
      
      {/* Refresh button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 ml-1 hover:bg-white/50"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isLoading ? 'Actualizando...' : 'Actualizar datos ahora'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ============================================================================
// ANALYTICS FILTER BAR
// ============================================================================
export interface AnalyticsFilterBarProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: Partial<AnalyticsFilters>) => void;
  lastUpdated: Date;
  isLoading: boolean;
  onRefresh: () => void;
  clients?: ClientOption[];
  regions?: RegionOption[];
  showAdvancedFilters?: boolean;
}

export function AnalyticsFilterBar({
  filters,
  onFiltersChange,
  lastUpdated,
  isLoading,
  onRefresh,
  clients = [],
  regions = [],
  showAdvancedFilters = false,
}: AnalyticsFilterBarProps) {
  const hasActiveFilters = filters.clientId || filters.regionId || filters.originRegionId;

  const handleClearFilters = () => {
    onFiltersChange({
      clientId: undefined,
      regionId: undefined,
      originRegionId: undefined,
    });
  };

  const periodLabels: Record<PeriodPreset, string> = {
    '7d': 'Últimos 7 días',
    '30d': 'Últimos 30 días',
    '90d': 'Últimos 90 días',
    'custom': 'Personalizado',
  };

  const comparisonLabels: Record<ComparisonPeriod, string> = {
    previous: 'Período anterior',
    lastMonth: 'Mismo período mes pasado',
    lastYear: 'Mismo período año pasado',
    none: 'Sin comparar',
  };

  return (
    <div className="space-y-3">
      {/* Main filter row */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-xl border">
        {/* Period selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          
          {/* Period preset buttons */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-background/80 border">
            {(['7d', '30d', '90d'] as PeriodPreset[]).map((preset) => (
              <Button
                key={preset}
                variant={filters.periodPreset === preset ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onFiltersChange({ periodPreset: preset })}
                className={cn(
                  "h-7 px-3 text-xs font-medium transition-all",
                  filters.periodPreset === preset && "shadow-sm"
                )}
              >
                {preset === '7d' ? '7D' : preset === '30d' ? '30D' : '90D'}
              </Button>
            ))}
            
            {/* Custom date picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={filters.periodPreset === 'custom' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    "h-7 px-3 text-xs",
                    filters.periodPreset === 'custom' && "shadow-sm"
                  )}
                >
                  <Calendar className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={{ from: filters.customRange.from, to: filters.customRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      onFiltersChange({ 
                        customRange: { from: range.from, to: range.to },
                        periodPreset: 'custom'
                      });
                    }
                  }}
                  locale={es}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Comparison selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">vs</span>
          <Select 
            value={filters.comparisonPeriod} 
            onValueChange={(value: ComparisonPeriod) => onFiltersChange({ comparisonPeriod: value })}
          >
            <SelectTrigger className="h-8 w-full min-w-0 sm:w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="previous">Período anterior</SelectItem>
              <SelectItem value="lastMonth">Mes pasado</SelectItem>
              <SelectItem value="lastYear">Año pasado</SelectItem>
              <SelectItem value="none">Sin comparar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-border mx-2 hidden sm:block" />

        {/* Advanced filters (optional) */}
        {showAdvancedFilters && (
          <>
            {/* Client filter */}
            {clients.length > 0 && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Select 
                  value={filters.clientId || 'all'} 
                  onValueChange={(value) => onFiltersChange({ clientId: value === 'all' ? undefined : value })}
                >
                  <SelectTrigger className="h-8 w-full min-w-0 sm:w-[160px] text-xs">
                    <SelectValue placeholder="Todos los clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Region destino filter */}
            {regions.length > 0 && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" title="Región de entrega" />
                <Select 
                  value={filters.regionId || 'all'} 
                  onValueChange={(value) => onFiltersChange({ regionId: value === 'all' ? undefined : value })}
                >
                  <SelectTrigger className="h-8 w-full min-w-0 sm:w-[160px] text-xs" title="Solo pedidos entregados en esta región">
                    <SelectValue placeholder="Región de entrega" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las regiones de entrega</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Region origen filter */}
            {regions.length > 0 && (
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-muted-foreground" title="Región de carga" />
                <Select 
                  value={filters.originRegionId || 'all'} 
                  onValueChange={(value) => onFiltersChange({ originRegionId: value === 'all' ? undefined : value })}
                >
                  <SelectTrigger className="h-8 w-full min-w-0 sm:w-[160px] text-xs" title="Solo pedidos cargados en esta región">
                    <SelectValue placeholder="Región de carga" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las regiones de carga</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={`orig-${region.id}`} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Clear filters button */}
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearFilters}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar filtros
              </Button>
            )}
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Data freshness indicator */}
        <DataFreshnessIndicator 
          lastUpdated={lastUpdated} 
          isLoading={isLoading} 
          onRefresh={onRefresh}
        />
      </div>

      {/* Period indicator badge */}
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="secondary" className="font-normal">
          {periodLabels[filters.periodPreset]}
        </Badge>
        <span className="text-muted-foreground">
          • {format(filters.customRange.from, 'dd MMM yyyy', { locale: es })} → {format(filters.customRange.to, 'dd MMM yyyy', { locale: es })}
        </span>
        {filters.comparisonPeriod !== 'none' && (
          <span className="text-muted-foreground">
            • Comparando con {comparisonLabels[filters.comparisonPeriod].toLowerCase()}
          </span>
        )}
      </div>
    </div>
  );
}

export default AnalyticsFilterBar;
