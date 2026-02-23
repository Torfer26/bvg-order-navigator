import React, { useState, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  Package, 
  MapPin, 
  Loader2,
  Users,
  Truck,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Activity,
  Target,
  Globe2,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Warehouse,
  ArrowRight,
  AlertOctagon
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

// New enhanced components
import { EnhancedMetricCard, KPI_DEFINITIONS } from '@/components/shared/EnhancedMetricCard';
import { AnalyticsFilterBar, type AnalyticsFilters, type PeriodPreset } from '@/components/shared/AnalyticsFilterBar';
import { StatusBarChart } from '@/components/shared/StatusBarChart';

// Services
import {
  fetchAnalyticsKPIs,
  fetchDailyTrend,
  fetchStatusDistribution,
  fetchClientStats,
  fetchRegionStats,
  fetchPeriodComparison,
  fetchHourlyPattern,
  fetchWeekdayPattern,
  fetchTopDestinations,
  fetchTopOrigins,
  fetchOriginRegionStats,
  fetchTopOriginDestinationPairs,
  fetchClientsForFilter,
  fetchRegionsForFilter,
  type DateRange,
  type AnalyticsKPIs,
  type DailyTrend,
  type StatusDistribution,
  type ClientStats,
  type RegionStats,
  type OriginStats,
  type OriginRegionStats,
  type OriginDestinationPair,
  type PeriodComparison,
  type HourlyPattern,
  type WeekdayPattern,
  type DestinationStats,
  type FilterOption,
} from '@/lib/analyticsService';

// ============================================================================
// AREA CHART COMPONENT - Smooth area visualization with proper scaling
// ============================================================================
function AreaChart({
  data,
  height = 280,
  showLabels = true 
}: { 
  data: DailyTrend[]; 
  height?: number;
  showLabels?: boolean;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        <div className="text-center">
          <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay datos para el período seleccionado</p>
        </div>
      </div>
    );
  }
  
  // Calculate totals
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);
  const maxOrders = Math.max(...data.map(d => d.orders), 1);
  const daysWithOrders = data.filter(d => d.orders > 0).length;
  const avgOrders = daysWithOrders > 0 ? Math.round(totalOrders / daysWithOrders) : 0;
  
  // Today indicator
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayData = data.find(d => d.date === today);
  
  // Calculate nice round numbers for Y axis  
  const yAxisMax = Math.max(Math.ceil(maxOrders * 1.15 / 5) * 5, 10);
  const yAxisSteps = [0, Math.round(yAxisMax * 0.25), Math.round(yAxisMax * 0.5), Math.round(yAxisMax * 0.75), yAxisMax];
  
  // Trend calculation (comparing first half vs second half)
  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));
  const firstHalfSum = firstHalf.reduce((sum, d) => sum + d.orders, 0);
  const secondHalfSum = secondHalf.reduce((sum, d) => sum + d.orders, 0);
  const trendPct = firstHalfSum > 0 ? ((secondHalfSum - firstHalfSum) / firstHalfSum) * 100 : 0;
  
  // Date label logic
  const getLabelIndices = () => {
    if (data.length <= 7) return data.map((_, i) => i);
    if (data.length <= 14) return data.map((_, i) => i).filter(i => i % 2 === 0 || i === data.length - 1);
    const step = Math.ceil(data.length / 7);
    return data.map((_, i) => i).filter(i => i === 0 || i === data.length - 1 || i % step === 0);
  };
  const labelIndices = getLabelIndices();
  
  const chartPadding = { top: 32, right: 12, bottom: showLabels ? 40 : 16, left: 48 };

  return (
    <div className="relative w-full select-none" style={{ height }}>
      {/* Today's orders badge */}
      {todayData && (
        <div className="absolute top-0 left-12 flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
            Hoy: {todayData.orders} pedidos
          </span>
        </div>
      )}
      
      {/* Summary stats */}
      <div className="absolute top-0 right-2 flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>Total período:</span>
          <span className="font-bold text-foreground tabular-nums">{totalOrders.toLocaleString('es-ES')}</span>
        </div>
        <div className={cn(
          "flex items-center gap-1 font-medium tabular-nums",
          trendPct > 5 ? "text-emerald-600 dark:text-emerald-500" : 
          trendPct < -5 ? "text-red-600 dark:text-red-500" : 
          "text-muted-foreground"
        )}>
          {trendPct > 5 && <TrendingUp className="h-3 w-3" />}
          {trendPct < -5 && <TrendingUp className="h-3 w-3 rotate-180" />}
          <span>{trendPct > 0 ? '+' : ''}{trendPct.toFixed(0)}%</span>
        </div>
      </div>
      
      {/* Y-Axis labels */}
      <div 
        className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-right pr-2"
        style={{ width: chartPadding.left, paddingTop: chartPadding.top, paddingBottom: chartPadding.bottom }}
      >
        {yAxisSteps.slice().reverse().map((val, i) => (
          <span key={i} className="text-[10px] text-muted-foreground tabular-nums leading-none">
            {val}
          </span>
        ))}
      </div>
      
      {/* Chart area */}
      <div 
        className="absolute bg-muted/20 rounded"
        style={{ 
          left: chartPadding.left, 
          right: chartPadding.right, 
          top: chartPadding.top, 
          bottom: chartPadding.bottom 
        }}
      >
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {yAxisSteps.map((_, i) => (
            <div 
              key={i} 
              className="w-full border-t border-border/40"
              style={{ borderStyle: i === 0 ? 'solid' : 'dashed' }}
            />
          ))}
        </div>
        
        {/* Average reference line (only if meaningful) */}
        {avgOrders > 0 && avgOrders < yAxisMax && (
          <div 
            className="absolute w-full border-t-2 border-amber-500/60 pointer-events-none z-10"
            style={{ bottom: `${(avgOrders / yAxisMax) * 100}%` }}
          >
            <span className="absolute right-1 -translate-y-1/2 text-[9px] text-amber-600 dark:text-amber-400 bg-card/90 px-1 rounded font-medium">
              Prom: {avgOrders}
            </span>
          </div>
        )}
        
        {/* Bars container */}
        <div className="absolute inset-x-2 inset-y-0 flex items-end gap-[3px]">
          {data.map((d, i) => {
            const barHeight = (d.orders / yAxisMax) * 100;
            const isToday = d.date === today;
            const hasOrders = d.orders > 0;
            
            return (
              <div 
                key={d.date}
                className="flex-1 group relative flex flex-col justify-end h-full"
                style={{ minWidth: 0 }}
              >
                {/* Bar */}
                <div 
                  className={cn(
                    "w-full transition-all duration-200 rounded-t-sm",
                    isToday 
                      ? "bg-blue-500 group-hover:bg-blue-600" 
                      : hasOrders
                        ? "bg-slate-500 dark:bg-slate-400 group-hover:bg-slate-600 dark:group-hover:bg-slate-300"
                        : "bg-slate-200 dark:bg-slate-700"
                  )}
                  style={{ 
                    height: hasOrders ? `${Math.max(barHeight, 3)}%` : '2px',
                    minHeight: hasOrders ? '4px' : '2px'
                  }}
                />
                
                {/* Today indicator dot */}
                {isToday && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />
                )}
                
                {/* Tooltip */}
                <div 
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none"
                >
                  <div className={cn(
                    "text-white text-xs rounded shadow-lg whitespace-nowrap px-2.5 py-1.5",
                    isToday ? "bg-blue-600" : "bg-slate-800"
                  )}>
                    <div className="text-white/70 text-[10px] font-medium flex items-center gap-1">
                      {isToday && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      {format(new Date(d.date), 'EEEE, d MMM', { locale: es })}
                      {isToday && <span className="text-white font-semibold">(HOY)</span>}
                    </div>
                    <div className="mt-0.5 font-bold tabular-nums text-sm">
                      {d.orders} <span className="font-normal text-white/70">pedidos</span>
                    </div>
                    {d.pallets > 0 && (
                      <div className="text-white/60 text-[10px] tabular-nums">
                        {d.pallets} pallets
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* X-Axis labels */}
      {showLabels && (
        <div 
          className="absolute left-0 right-0 bottom-0 flex"
          style={{ 
            height: chartPadding.bottom - 8,
            paddingLeft: chartPadding.left + 8, 
            paddingRight: chartPadding.right + 8,
            paddingTop: 8
          }}
        >
          {data.map((d, i) => {
            const isToday = d.date === today;
            if (!labelIndices.includes(i) && !isToday) return <div key={d.date} className="flex-1" />;
            return (
              <div key={d.date} className="flex-1 flex justify-center">
                <span className={cn(
                  "text-[10px] whitespace-nowrap tabular-nums",
                  isToday ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-muted-foreground"
                )}>
                  {isToday ? 'Hoy' : format(new Date(d.date), 'dd/MM', { locale: es })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CLIENT RANKING CARD
// ============================================================================
function ClientRankCard({ 
  client, 
  rank, 
  maxOrders 
}: { 
  client: ClientStats; 
  rank: number; 
  maxOrders: number;
}) {
  const percentage = (client.totalOrders / maxOrders) * 100;
  const isTop3 = rank <= 3;
  
  const medalColors = {
    1: 'from-amber-400 via-yellow-300 to-amber-500',
    2: 'from-gray-300 via-gray-200 to-gray-400',
    3: 'from-amber-600 via-amber-500 to-amber-700',
  };
  
  return (
    <Link 
      to={`/orders?client_id=${client.clientId}`}
      className={cn(
        "group relative p-4 rounded-xl transition-all duration-300",
        "bg-gradient-to-r from-white/60 to-white/30 dark:from-gray-800/60 dark:to-gray-800/30",
        "border border-white/20 dark:border-gray-700/30",
        "hover:from-white/80 hover:to-white/50 dark:hover:from-gray-800/80 dark:hover:to-gray-800/50",
        "hover:shadow-lg hover:border-white/30"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
          "transition-transform duration-300 group-hover:scale-110",
          isTop3 
            ? `bg-gradient-to-br ${medalColors[rank as 1 | 2 | 3]} text-white shadow-lg` 
            : "bg-muted text-muted-foreground"
        )}>
          {rank}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold truncate pr-4">{client.clientName}</span>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {client.totalOrders}
              </span>
              <Badge variant="outline" className="text-xs font-medium">
                {client.totalPallets} plt
              </Badge>
            </div>
          </div>
          
          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                isTop3 
                  ? "bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" 
                  : "bg-blue-400/70"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// ============================================================================
// REGION CARD
// ============================================================================
function RegionCard({ 
  region, 
  index, 
  maxDeliveries 
}: { 
  region: RegionStats; 
  index: number; 
  maxDeliveries: number;
}) {
  const percentage = (region.deliveries / maxDeliveries) * 100;
  
  const gradients = [
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-blue-600',
  ];
  
  const gradient = gradients[index % gradients.length];
  
  return (
    <Link
      to={`/orders?region=${encodeURIComponent(region.region)}`}
      className={cn(
        "group relative p-5 rounded-2xl transition-all duration-300 overflow-hidden",
        "bg-gradient-to-br from-white/70 to-white/40 dark:from-gray-800/70 dark:to-gray-800/40",
        "border border-white/20 dark:border-gray-700/30",
        "hover:shadow-xl hover:scale-[1.02]"
      )}
    >
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-500",
        gradient
      )} />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br", gradient,
              "text-white shadow-lg"
            )}>
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold">{region.region}</h4>
              <p className="text-sm text-muted-foreground">
                {region.deliveries.toLocaleString('es-ES')} entregas
              </p>
            </div>
          </div>
          <Badge className={cn(
            "bg-gradient-to-r text-white border-0 shadow-md",
            gradient
          )}>
            {region.pallets.toLocaleString('es-ES')} plt
          </Badge>
        </div>
        
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out",
              gradient
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-right">
          {Math.round(percentage)}% del máximo
        </p>
      </div>
    </Link>
  );
}

// ============================================================================
// HOURLY PATTERN CHART - Bar chart showing orders by hour
// ============================================================================
function HourlyPatternChart({ data }: { data: HourlyPattern[] }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Activity className="h-12 w-12 mb-3 opacity-50" />
        <p>No hay datos de patrón horario</p>
      </div>
    );
  }

  const maxOrders = Math.max(...data.map(d => d.orders), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-1 h-40">
        {data.map((item) => {
          const height = (item.orders / maxOrders) * 100;
          const isWorkHours = item.hour >= 8 && item.hour <= 18;
          
          return (
            <div
              key={item.hour}
              className="flex-1 flex flex-col items-center group"
            >
              <div className="relative w-full flex justify-center">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    {item.hour}:00 - {item.orders} pedidos
                  </div>
                </div>
                {/* Bar */}
                <div
                  className={cn(
                    "w-full max-w-[20px] rounded-t transition-all duration-300",
                    isWorkHours 
                      ? "bg-gradient-to-t from-cyan-500 to-cyan-400" 
                      : "bg-gradient-to-t from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-500",
                    "group-hover:from-cyan-600 group-hover:to-cyan-500"
                  )}
                  style={{ height: `${Math.max(height, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {/* X axis labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pt-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-cyan-500" />
          <span className="text-muted-foreground">Horario laboral (8-18h)</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// WEEKDAY PATTERN CHART - Bar chart showing orders by day of week
// ============================================================================
function WeekdayPatternChart({ data }: { data: WeekdayPattern[] }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Activity className="h-12 w-12 mb-3 opacity-50" />
        <p>No hay datos de patrón semanal</p>
      </div>
    );
  }

  const maxOrders = Math.max(...data.map(d => d.orders), 1);
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);

  // Reorder to start from Monday (1) instead of Sunday (0)
  const orderedData = [...data].sort((a, b) => {
    const aDay = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
    const bDay = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
    return aDay - bDay;
  });

  const dayColors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-indigo-600',
    'from-cyan-500 to-teal-600',
    'from-emerald-500 to-green-600',
    'from-amber-500 to-orange-600',
    'from-rose-400 to-pink-500',
    'from-gray-400 to-gray-500',
  ];

  return (
    <div className="space-y-3">
      {orderedData.map((item, index) => {
        const percentage = totalOrders > 0 ? (item.orders / totalOrders) * 100 : 0;
        const barWidth = (item.orders / maxOrders) * 100;
        const isWeekend = item.dayOfWeek === 0 || item.dayOfWeek === 6;
        
        return (
          <div key={item.dayOfWeek} className="flex items-center gap-3">
            <div className="w-12 text-sm font-medium text-muted-foreground">
              {item.dayName.slice(0, 3)}
            </div>
            <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                  isWeekend ? 'from-gray-400 to-gray-500' : dayColors[index % dayColors.length]
                )}
                style={{ width: `${Math.max(barWidth, 4)}%` }}
              />
            </div>
            <div className="w-16 text-right">
              <span className="font-semibold text-sm">{item.orders}</span>
              <span className="text-xs text-muted-foreground ml-1">({percentage.toFixed(0)}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// TOP DESTINATIONS CHART
// ============================================================================
function TopDestinationsChart({ data }: { data: DestinationStats[] }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <MapPin className="h-12 w-12 mb-3 opacity-50" />
        <p>No hay datos de destinos</p>
      </div>
    );
  }

  const maxDeliveries = Math.max(...data.map(d => d.deliveries), 1);

  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((dest, index) => {
        const barWidth = (dest.deliveries / maxDeliveries) * 100;
        const gradients = [
          'from-emerald-500 to-teal-600',
          'from-blue-500 to-indigo-600',
          'from-violet-500 to-purple-600',
          'from-rose-500 to-pink-600',
          'from-amber-500 to-orange-600',
        ];
        const gradient = gradients[index % gradients.length];
        
        return (
          <div key={dest.destinationId} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate pr-2" title={dest.destinationName}>
                {dest.destinationName}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-sm">{dest.deliveries}</span>
                <Badge variant="outline" className="text-xs">
                  {dest.pallets} plt
                </Badge>
              </div>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                  gradient
                )}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            {dest.city && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {dest.city}{dest.province ? `, ${dest.province}` : ''}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// TOP ORIGINS CHART
// ============================================================================
function TopOriginsChart({ data }: { data: OriginStats[] }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Warehouse className="h-12 w-12 mb-3 opacity-50" />
        <p>No hay datos de orígenes</p>
      </div>
    );
  }

  const maxPickups = Math.max(...data.map(d => d.pickups), 1);

  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((origin, index) => {
        const barWidth = (origin.pickups / maxPickups) * 100;
        const gradients = [
          'from-amber-500 to-orange-600',
          'from-sky-500 to-blue-600',
          'from-indigo-500 to-violet-600',
          'from-fuchsia-500 to-pink-600',
          'from-orange-500 to-amber-600',
        ];
        const gradient = gradients[index % gradients.length];

        return (
          <div key={origin.originId} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate pr-2" title={origin.originName}>
                {origin.originName}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-sm">{origin.pickups}</span>
                <Badge variant="outline" className="text-xs">
                  {origin.pallets} plt
                </Badge>
              </div>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                  gradient
                )}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            {origin.city && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {origin.city}{origin.province ? `, ${origin.province}` : ''}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// ORIGIN REGION CARD
// ============================================================================
function OriginRegionCard({
  region,
  index,
  maxPickups
}: {
  region: OriginRegionStats;
  index: number;
  maxPickups: number;
}) {
  const percentage = (region.pickups / maxPickups) * 100;

  const gradients = [
    'from-amber-500 to-orange-600',
    'from-sky-500 to-blue-600',
    'from-indigo-500 to-violet-600',
    'from-fuchsia-500 to-pink-600',
  ];
  const gradient = gradients[index % gradients.length];

  return (
    <div
      className={cn(
        "group relative p-5 rounded-2xl transition-all duration-300 overflow-hidden",
        "bg-gradient-to-br from-white/70 to-white/40 dark:from-gray-800/70 dark:to-gray-800/40",
        "border border-white/20 dark:border-gray-700/30",
        "hover:shadow-xl hover:scale-[1.02]"
      )}
    >
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-500",
        gradient
      )} />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br", gradient,
              "text-white shadow-lg"
            )}>
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold">{region.region}</h4>
              <p className="text-sm text-muted-foreground">
                {region.pickups.toLocaleString('es-ES')} recogidas
              </p>
            </div>
          </div>
          <Badge className={cn(
            "bg-gradient-to-r text-white border-0 shadow-md",
            gradient
          )}>
            {region.pallets.toLocaleString('es-ES')} plt
          </Badge>
        </div>
        
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out",
              gradient
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-right">
          {Math.round(percentage)}% del máximo
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================
function MetricSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-border/50 bg-gradient-to-br from-white/60 to-white/30 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-muted" />
          <div className="w-24 h-4 rounded bg-muted" />
        </div>
        <div className="w-16 h-6 rounded-full bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="w-32 h-8 rounded bg-muted" />
        <div className="w-40 h-4 rounded bg-muted" />
      </div>
      <div className="mt-4 h-9 rounded bg-muted/50" />
    </div>
  );
}

function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/60 to-white/30 p-6 animate-pulse">
      <div className="space-y-2 mb-4">
        <div className="w-40 h-5 rounded bg-muted" />
        <div className="w-64 h-4 rounded bg-muted" />
      </div>
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div 
            key={i} 
            className="flex-1 bg-muted rounded-t"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================
function AnalyticsEmptyState({ onResetFilters }: { onResetFilters: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-semibold mb-2">Sin datos para este período</h3>
      <p className="text-muted-foreground max-w-md mb-4">
        No se encontraron pedidos con los filtros seleccionados.
        Intenta seleccionar un rango de fechas diferente o limpiar los filtros.
      </p>
      <Button variant="outline" onClick={onResetFilters}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Ver últimos 30 días
      </Button>
    </div>
  );
}

// ============================================================================
// ERROR STATE
// ============================================================================
function AnalyticsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" role="alert">
      <AlertTriangle className="h-16 w-16 text-destructive/50 mb-4" />
      <h3 className="text-lg font-semibold mb-2">Error al cargar datos</h3>
      <p className="text-muted-foreground max-w-md mb-4">
        No se pudieron obtener los datos de analítica. Por favor, verifica tu conexión e inténtalo de nuevo.
      </p>
      <Button onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Reintentar
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN ANALYTICS COMPONENT
// ============================================================================
export default function Analytics() {
  // Filter state
  const [filters, setFilters] = useState<AnalyticsFilters>({
    periodPreset: '30d',
    customRange: {
      from: subDays(new Date(), 30),
      to: new Date(),
    },
    comparisonPeriod: 'previous',
    clientId: undefined,
    regionId: undefined,
    originRegionId: undefined,
  });

  // Calculate date range based on preset (must be before dateRangeKey and useQueries)
  const dateRange = useMemo<DateRange>(() => {
    const now = new Date();
    switch (filters.periodPreset) {
      case '7d':
        return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
      case '30d':
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      case '90d':
        return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
      case 'custom':
        return { from: startOfDay(filters.customRange.from), to: endOfDay(filters.customRange.to) };
      default:
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    }
  }, [filters.periodPreset, filters.customRange.from, filters.customRange.to]);

  const dateRangeKey = useMemo(
    () => `${dateRange.from.toISOString().slice(0, 10)}_${dateRange.to.toISOString().slice(0, 10)}`,
    [dateRange.from, dateRange.to]
  );

  const filtersKey = useMemo(
    () => `${filters.clientId || ''}_${filters.regionId || ''}_${filters.originRegionId || ''}`,
    [filters.clientId, filters.regionId, filters.originRegionId]
  );

  // Filter options (load once)
  const { data: filterOptions } = useQuery({
    queryKey: ['analytics', 'filterOptions'],
    queryFn: async () => {
      const [clients, regions] = await Promise.all([
        fetchClientsForFilter(),
        fetchRegionsForFilter(),
      ]);
      return { clients, regions };
    },
    staleTime: 5 * 60 * 1000,
  });
  const filterClients = filterOptions?.clients ?? [];
  const filterRegions = filterOptions?.regions ?? [];

  // Analytics data with useQueries (cached by dateRange)
  const defaultKPIs: AnalyticsKPIs = {
    totalOrders: 0,
    totalPallets: 0,
    totalDeliveries: 0,
    uniqueRegions: 0,
    uniqueOrigins: 0,
    pendingLocations: 0,
    linesWithoutOrigin: 0,
    avgOrdersPerDay: 0,
  };

  const queryFilters = useMemo(
    () => ({
      clientId: filters.clientId,
      regionId: filters.regionId,
      originRegionId: filters.originRegionId,
    }),
    [filters.clientId, filters.regionId, filters.originRegionId]
  );

  const results = useQueries({
    queries: [
      {
        queryKey: ['analytics', 'kpis', dateRangeKey, filtersKey],
        queryFn: () => fetchAnalyticsKPIs(dateRange, queryFilters),
        staleTime: 30 * 1000,
      },
      {
        queryKey: ['analytics', 'dailyTrend', dateRangeKey, filtersKey],
        queryFn: () => fetchDailyTrend(dateRange, queryFilters),
        staleTime: 30 * 1000,
      },
      {
        queryKey: ['analytics', 'statusDist', dateRangeKey, filtersKey],
        queryFn: () => fetchStatusDistribution(dateRange, queryFilters),
        staleTime: 30 * 1000,
      },
      {
        queryKey: ['analytics', 'clientStats', dateRangeKey, filtersKey],
        queryFn: () => fetchClientStats(dateRange, queryFilters),
        staleTime: 30 * 1000,
      },
      {
        queryKey: ['analytics', 'regionStats', dateRangeKey, filtersKey],
        queryFn: () => fetchRegionStats(dateRange, queryFilters),
        staleTime: 30 * 1000,
      },
      {
        queryKey: ['analytics', 'comparison', dateRangeKey, filtersKey],
        queryFn: () => fetchPeriodComparison(dateRange, queryFilters),
        staleTime: 30 * 1000,
      },
      {
        queryKey: ['analytics', 'hourlyPattern', dateRangeKey, filtersKey],
        queryFn: () => fetchHourlyPattern(dateRange, queryFilters),
        staleTime: 30 * 1000,
      },
      {
        queryKey: ['analytics', 'weekdayPattern', dateRangeKey, filtersKey],
        queryFn: () => fetchWeekdayPattern(dateRange, queryFilters),
        staleTime: 30 * 1000,
      },
      {
        queryKey: ['analytics', 'topDestinations', dateRangeKey, filtersKey],
        queryFn: () => fetchTopDestinations(dateRange, 10, queryFilters),
        staleTime: 30 * 1000,
      },
      {
        queryKey: ['analytics', 'topOrigins', dateRangeKey, filtersKey],
        queryFn: () => fetchTopOrigins(dateRange, 10, queryFilters),
        staleTime: 30 * 1000,
      },
      {
        queryKey: ['analytics', 'originRegionStats', dateRangeKey, filtersKey],
        queryFn: () => fetchOriginRegionStats(dateRange, queryFilters),
        staleTime: 30 * 1000,
      },
      {
        queryKey: ['analytics', 'originDestPairs', dateRangeKey, filtersKey],
        queryFn: () => fetchTopOriginDestinationPairs(dateRange, 8, queryFilters),
        staleTime: 30 * 1000,
      },
    ],
  });

  const [
    kpisQuery,
    dailyTrendQuery,
    statusDistQuery,
    clientStatsQuery,
    regionStatsQuery,
    comparisonQuery,
    hourlyPatternQuery,
    weekdayPatternQuery,
    topDestinationsQuery,
    topOriginsQuery,
    originRegionStatsQuery,
    originDestPairsQuery,
  ] = results;

  const kpis = kpisQuery.data ?? defaultKPIs;
  const dailyTrend = dailyTrendQuery.data ?? [];
  const statusDist = statusDistQuery.data ?? [];
  const clientStats = clientStatsQuery.data ?? [];
  const regionStats = regionStatsQuery.data ?? [];
  const comparison = comparisonQuery.data ?? null;
  const hourlyPattern = hourlyPatternQuery.data ?? [];
  const weekdayPattern = weekdayPatternQuery.data ?? [];
  const topDestinations = topDestinationsQuery.data ?? [];
  const topOrigins = topOriginsQuery.data ?? [];
  const originRegionStats = originRegionStatsQuery.data ?? [];
  const originDestPairs = originDestPairsQuery.data ?? [];

  const isLoading = results.some((r) => r.isLoading);
  const isFetching = results.some((r) => r.isFetching);
  const hasError = results.every((r) => r.isError);
  const lastUpdated = results.some((r) => r.dataUpdatedAt)
    ? new Date(Math.max(...results.map((r) => r.dataUpdatedAt)))
    : new Date();

  const refetchAll = () => results.forEach((r) => r.refetch());

  // Handle filter changes
  const handleFiltersChange = (newFilters: Partial<AnalyticsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      periodPreset: '30d',
      customRange: {
        from: subDays(new Date(), 30),
        to: new Date(),
      },
      comparisonPeriod: 'previous',
      clientId: undefined,
      regionId: undefined,
      originRegionId: undefined,
    });
  };
  
  // Derived data
  const maxClientOrders = Math.max(...(clientStats.slice(0, 10).map(c => c.totalOrders) || [1]), 1);
  const maxRegionDeliveries = Math.max(...(regionStats.map(r => r.deliveries) || [1]), 1);
  const maxOriginRegionPickups = Math.max(...(originRegionStats.map(r => r.pickups) || [1]), 1);
  const sparklineData = dailyTrend.map(d => d.orders);
  const palletsSparkline = dailyTrend.map(d => d.pallets);
  
  const hasData = !hasError && results.some((r) => r.isSuccess);
  
  return (
    <div className="space-y-6 pb-8">
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Centro de Analítica
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Insights de pedidos y logística en tiempo real
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* ================================================================== */}
      {/* FILTER BAR WITH DATA FRESHNESS */}
      {/* ================================================================== */}
      <AnalyticsFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        lastUpdated={lastUpdated}
        isLoading={isLoading || isFetching}
        onRefresh={refetchAll}
        clients={filterClients}
        regions={filterRegions}
        showAdvancedFilters={true}
      />
      
      {/* Error state */}
      {hasError && <AnalyticsErrorState onRetry={refetchAll} />}
      
      {/* Loading state */}
      {isLoading && !hasError && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <ChartSkeleton height={280} />
            <ChartSkeleton height={280} />
          </div>
        </>
      )}
      
      {/* Empty state */}
      {!isLoading && !hasError && !hasData && (
        <AnalyticsEmptyState onResetFilters={handleResetFilters} />
      )}
      
      {/* Main content - BUSINESS ANALYTICS (no operational queues) */}
      {!isLoading && !hasError && hasData && (
        <>
          {/* ================================================================== */}
          {/* KPI METRICS - Business focused */}
          {/* ================================================================== */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <EnhancedMetricCard
              title="Total Pedidos"
              value={kpis?.totalOrders || 0}
              previousValue={comparison?.previous.totalOrders}
              change={comparison?.percentChange.orders}
              definition={KPI_DEFINITIONS.totalOrders}
              drilldownUrl={`/orders?from=${format(dateRange.from, 'yyyy-MM-dd')}&to=${format(dateRange.to, 'yyyy-MM-dd')}`}
              drilldownLabel="Ver pedidos"
              icon={Package}
              sparklineData={sparklineData}
              accentColor="#3b82f6"
              iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
            />
            <EnhancedMetricCard
              title="Pallets Movidos"
              value={kpis?.totalPallets || 0}
              previousValue={comparison?.previous.totalPallets}
              change={comparison?.percentChange.pallets}
              definition={KPI_DEFINITIONS.totalPallets}
              drilldownUrl={`/orders?from=${format(dateRange.from, 'yyyy-MM-dd')}&to=${format(dateRange.to, 'yyyy-MM-dd')}`}
              drilldownLabel="Ver detalles"
              icon={Truck}
              sparklineData={palletsSparkline}
              accentColor="#10b981"
              iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
            />
            <EnhancedMetricCard
              title="Entregas Resueltas"
              value={kpis?.totalDeliveries || 0}
              previousValue={comparison?.previous.totalDeliveries}
              change={comparison?.percentChange.deliveries}
              definition={KPI_DEFINITIONS.deliveriesResolved}
              drilldownUrl="/orders?location_status=AUTO,MANUALLY_SET,CONFIRMED"
              drilldownLabel="Ver entregas"
              icon={Target}
              accentColor="#8b5cf6"
              iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
            />
            <EnhancedMetricCard
              title="Clientes Activos"
              value={clientStats.length}
              definition={{
                description: "Número de clientes únicos con pedidos en el período seleccionado.",
                formula: "COUNT(DISTINCT client_id) WHERE created_at IN período",
                unit: "clientes",
              }}
              drilldownUrl="/masters/clients"
              drilldownLabel="Ver clientes"
              icon={Users}
              accentColor="#ec4899"
              iconBg="bg-gradient-to-br from-pink-500 to-rose-600"
            />
            <EnhancedMetricCard
              title="Orígenes Únicos"
              value={kpis?.uniqueOrigins ?? 0}
              definition={KPI_DEFINITIONS.uniqueOrigins}
              drilldownUrl="/analytics"
              drilldownLabel="Ver Top Orígenes"
              icon={Warehouse}
              accentColor="#f59e0b"
              iconBg="bg-gradient-to-br from-amber-500 to-orange-600"
            />
            <EnhancedMetricCard
              title="Líneas sin Origen"
              value={kpis?.linesWithoutOrigin ?? 0}
              definition={KPI_DEFINITIONS.linesWithoutOrigin}
              drilldownUrl="/orders?location_status=PENDING_LOCATION"
              drilldownLabel="Ver pendientes"
              icon={AlertOctagon}
              accentColor="#ef4444"
              iconBg="bg-gradient-to-br from-red-500 to-rose-600"
            />
          </div>
          
          {/* ================================================================== */}
          {/* MAIN CHARTS ROW - Trend + Status */}
          {/* ================================================================== */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Trend Chart */}
            <Card className="lg:col-span-2 border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-xl overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      Tendencia de Pedidos
                    </CardTitle>
                    <CardDescription>
                      Evolución diaria del volumen de pedidos recibidos
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-semibold">
                    {dailyTrend.reduce((sum, d) => sum + d.orders, 0).toLocaleString('es-ES')} total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <AreaChart data={dailyTrend} height={280} />
              </CardContent>
            </Card>
            
            {/* Status Distribution */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-amber-500" />
                  Estado de Pedidos
                </CardTitle>
                <CardDescription>Distribución en el período</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <StatusBarChart 
                  data={statusDist} 
                  showTotal={true}
                  maxItems={6}
                />
              </CardContent>
            </Card>
          </div>
          
          {/* ================================================================== */}
          {/* PATTERNS ROW - Hourly + Weekday */}
          {/* ================================================================== */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Hourly Pattern */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-500" />
                  Patrón Horario
                </CardTitle>
                <CardDescription>Distribución de pedidos por hora del día</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <HourlyPatternChart data={hourlyPattern} />
              </CardContent>
            </Card>
            
            {/* Weekday Pattern */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-violet-500" />
                  Patrón Semanal
                </CardTitle>
                <CardDescription>Distribución de pedidos por día de la semana</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <WeekdayPatternChart data={weekdayPattern} />
              </CardContent>
            </Card>
          </div>
          
          {/* ================================================================== */}
          {/* TOP CLIENTS + TOP DESTINATIONS + TOP ORIGINS */}
          {/* ================================================================== */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Top Clients */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      Top Clientes
                    </CardTitle>
                    <CardDescription>Ranking por volumen de pedidos</CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {clientStats.length} activos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {clientStats.slice(0, 5).map((client, i) => (
                    <ClientRankCard 
                      key={client.clientId}
                      client={client}
                      rank={i + 1}
                      maxOrders={maxClientOrders}
                    />
                  ))}
                  
                  {clientStats.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Users className="h-12 w-12 mb-3 opacity-50" />
                      <p>No hay datos de clientes</p>
                    </div>
                  )}
                  
                  {clientStats.length > 5 && (
                    <Button variant="ghost" className="w-full mt-2 text-muted-foreground" asChild>
                      <Link to="/masters/clients">
                        Ver todos ({clientStats.length})
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Top Destinations */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-emerald-500" />
                      Top Destinos
                    </CardTitle>
                    <CardDescription>Destinos más frecuentes</CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {topDestinations.length} destinos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <TopDestinationsChart data={topDestinations} />
              </CardContent>
            </Card>
            
            {/* Top Origins */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/70 dark:to-gray-800/40 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Warehouse className="h-5 w-5 text-amber-500" />
                      Top Orígenes
                    </CardTitle>
                    <CardDescription>Puntos de carga más utilizados</CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {topOrigins.length} orígenes
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <TopOriginsChart data={topOrigins} />
              </CardContent>
            </Card>
          </div>
          
          {/* ================================================================== */}
          {/* GEOGRAPHIC DISTRIBUTION - Destinations + Origins */}
          {/* ================================================================== */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Destinations by region */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Globe2 className="h-5 w-5 text-teal-500" />
                      Regiones de Destino
                    </CardTitle>
                    <CardDescription>Entregas por región de entrega</CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {regionStats.length} regiones
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {regionStats.slice(0, 6).map((region, i) => (
                    <RegionCard
                      key={region.region}
                      region={region}
                      index={i}
                      maxDeliveries={maxRegionDeliveries}
                    />
                  ))}
                </div>
                {regionStats.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MapPin className="h-12 w-12 mb-3 opacity-50" />
                    <p>No hay datos de regiones de destino</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Origins by region */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Warehouse className="h-5 w-5 text-amber-500" />
                      Regiones de Origen
                    </CardTitle>
                    <CardDescription>Recogidas por región de carga</CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {originRegionStats.length} regiones
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {originRegionStats.slice(0, 6).map((region, i) => (
                    <OriginRegionCard
                      key={region.region}
                      region={region}
                      index={i}
                      maxPickups={maxOriginRegionPickups}
                    />
                  ))}
                </div>
                {originRegionStats.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Warehouse className="h-12 w-12 mb-3 opacity-50" />
                    <p>No hay datos de regiones de origen</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ================================================================== */}
          {/* FLUJOS ORIGEN → DESTINO */}
          {/* ================================================================== */}
          {originDestPairs.length > 0 && (
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/70 dark:to-gray-800/40 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <ArrowRight className="h-5 w-5 text-indigo-500" />
                      Top Flujos Origen → Destino
                    </CardTitle>
                    <CardDescription>Combinaciones origen-destino más frecuentes</CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {originDestPairs.length} flujos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {originDestPairs.map((pair, i) => (
                    <div
                      key={`${pair.originId}-${pair.destinationId}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm truncate block" title={pair.originName}>
                          {pair.originName}
                        </span>
                        <span className="text-xs text-muted-foreground">Origen</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0 text-right">
                        <span className="font-medium text-sm truncate block" title={pair.destinationName}>
                          {pair.destinationName}
                        </span>
                        <span className="text-xs text-muted-foreground">Destino</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline">{pair.count} líneas</Badge>
                        <Badge variant="secondary">{pair.pallets} plt</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
