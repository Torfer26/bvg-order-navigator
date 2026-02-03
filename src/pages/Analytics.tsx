import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Package, 
  MapPin, 
  Calendar,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Users,
  Truck,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Activity,
  Target,
  Zap,
  Globe2,
  ChevronRight,
  Clock,
  RefreshCw
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  fetchAnalyticsKPIs,
  fetchDailyTrend,
  fetchStatusDistribution,
  fetchClientStats,
  fetchRegionStats,
  fetchPeriodComparison,
  type DateRange,
  type AnalyticsKPIs,
  type DailyTrend,
  type StatusDistribution,
  type ClientStats,
  type RegionStats,
  type PeriodComparison,
} from '@/lib/analyticsService';

// Modern status colors - 2026 palette
const STATUS_CONFIG: Record<string, { color: string; gradient: string; label: string }> = {
  COMPLETED: { color: '#10b981', gradient: 'from-emerald-400 to-teal-500', label: 'Completado' },
  PROCESSING: { color: '#3b82f6', gradient: 'from-blue-400 to-indigo-500', label: 'Procesando' },
  VALIDATING: { color: '#f59e0b', gradient: 'from-amber-400 to-orange-500', label: 'Validando' },
  RECEIVED: { color: '#8b5cf6', gradient: 'from-violet-400 to-purple-500', label: 'Recibido' },
  IN_REVIEW: { color: '#ec4899', gradient: 'from-pink-400 to-rose-500', label: 'En revisión' },
  APPROVED: { color: '#14b8a6', gradient: 'from-teal-400 to-cyan-500', label: 'Aprobado' },
  AWAITING_INFO: { color: '#f97316', gradient: 'from-orange-400 to-red-500', label: 'Esperando info' },
  REJECTED: { color: '#ef4444', gradient: 'from-red-400 to-rose-600', label: 'Rechazado' },
  ERROR: { color: '#dc2626', gradient: 'from-red-500 to-red-700', label: 'Error' },
};

type PeriodPreset = '7d' | '30d' | '90d' | 'custom';

// ============================================================================
// SPARKLINE COMPONENT - Mini trend visualization
// ============================================================================
function Sparkline({ data, color = '#3b82f6', height = 32 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return null;
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = height - ((value - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');
  
  const areaPoints = `0,${height} ${points} 100,${height}`;
  
  return (
    <svg width="100%" height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sparkline-gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon 
        points={areaPoints} 
        fill={`url(#sparkline-gradient-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point highlight */}
      <circle 
        cx="100" 
        cy={height - ((data[data.length - 1] - min) / range) * (height - 4)}
        r="3"
        fill={color}
      />
    </svg>
  );
}

// ============================================================================
// DONUT CHART COMPONENT - Modern circular visualization
// ============================================================================
function DonutChart({ 
  data, 
  size = 180,
  strokeWidth = 24 
}: { 
  data: { label: string; value: number; color: string }[]; 
  size?: number;
  strokeWidth?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {data.map((item, index) => {
          const percentage = item.value / total;
          const strokeDasharray = `${percentage * circumference} ${circumference}`;
          const strokeDashoffset = -currentOffset * circumference;
          currentOffset += percentage;
          
          return (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
              style={{ 
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
              }}
            />
          );
        })}
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{total}</span>
        <span className="text-xs text-muted-foreground">Total</span>
      </div>
    </div>
  );
}

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
  // Handle empty or insufficient data
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No hay datos para el período seleccionado
      </div>
    );
  }
  
  if (data.length === 1) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <Package className="h-8 w-8 mb-2 text-blue-500" />
        <p className="font-semibold text-foreground">{data[0].orders} pedidos</p>
        <p className="text-sm">{format(new Date(data[0].date), 'dd MMMM yyyy', { locale: es })}</p>
      </div>
    );
  }
  
  const maxOrders = Math.max(...data.map(d => d.orders), 1);
  const minOrders = Math.min(...data.map(d => d.orders));
  const padding = { top: 50, right: 10, bottom: showLabels ? 50 : 20, left: 10 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = 100; // Use viewBox units
  
  // Calculate Y position with proper scaling
  const getY = (value: number) => {
    if (maxOrders === minOrders) return chartHeight / 2 + padding.top;
    return chartHeight - ((value - minOrders) / (maxOrders - minOrders)) * chartHeight + padding.top;
  };
  
  // Generate smooth curve path
  const getPath = () => {
    const points = data.map((d, i) => ({
      x: data.length === 1 ? 50 : (i / (data.length - 1)) * chartWidth,
      y: getY(d.orders)
    }));
    
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x},${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      
      // Tension factor for smoothness
      const tension = 0.3;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    
    return path;
  };
  
  const linePath = getPath();
  const areaPath = `${linePath} L ${chartWidth},${chartHeight + padding.top} L 0,${chartHeight + padding.top} Z`;
  
  // Calculate statistics
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);
  const avgOrders = Math.round(totalOrders / data.length);
  const daysWithData = data.filter(d => d.orders > 0).length;
  const trend = data.length > 1 ? data[data.length - 1].orders - data[0].orders : 0;
  
  // Determine label positions - show more labels for short periods
  const getLabelIndices = () => {
    if (data.length <= 7) return data.map((_, i) => i); // Show all
    if (data.length <= 14) return data.map((_, i) => i).filter(i => i % 2 === 0 || i === data.length - 1);
    const step = Math.ceil(data.length / 6);
    return data.map((_, i) => i).filter(i => i === 0 || i === data.length - 1 || i % step === 0);
  };
  
  const labelIndices = getLabelIndices();
  
  return (
    <div className="relative w-full" style={{ height }}>
      <svg 
        viewBox={`0 0 ${chartWidth} ${height}`} 
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1="0"
            y1={padding.top + chartHeight * (1 - pct)}
            x2={chartWidth}
            y2={padding.top + chartHeight * (1 - pct)}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeDasharray="2 2"
          />
        ))}
        
        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#areaGradient)"
        />
        
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points - only show on hover via CSS */}
        {data.map((d, i) => {
          const x = data.length === 1 ? 50 : (i / (data.length - 1)) * chartWidth;
          const y = getY(d.orders);
          
          return (
            <circle
              key={d.date}
              cx={x}
              cy={y}
              r="1.2"
              fill="white"
              stroke="#3b82f6"
              strokeWidth="0.5"
              className="opacity-0 hover:opacity-100 transition-opacity"
            />
          );
        })}
      </svg>
      
      {/* X-axis labels - positioned absolutely for better control */}
      {showLabels && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-between px-1">
          {data.map((d, i) => {
            if (!labelIndices.includes(i)) return null;
            const leftPct = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
            return (
              <span 
                key={d.date}
                className="text-[10px] text-muted-foreground whitespace-nowrap"
                style={{ 
                  position: 'absolute', 
                  left: `${leftPct}%`,
                  transform: 'translateX(-50%)'
                }}
              >
                {format(new Date(d.date), 'dd/MM', { locale: es })}
              </span>
            );
          })}
        </div>
      )}
      
      {/* Interactive overlay with tooltips */}
      <div className="absolute inset-0" style={{ top: padding.top, bottom: padding.bottom }}>
        <div className="relative w-full h-full flex">
          {data.map((d, i) => {
            const leftPct = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
            return (
              <div 
                key={d.date}
                className="flex-1 group relative"
                style={{ minWidth: 0 }}
              >
                {/* Tooltip */}
                <div 
                  className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none"
                  style={{ 
                    left: '50%', 
                    transform: 'translateX(-50%)'
                  }}
                >
                  <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                    <div className="font-semibold text-blue-300">
                      {format(new Date(d.date), 'EEEE, d MMM', { locale: es })}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Package className="h-3 w-3 text-blue-400" />
                      <span className="font-bold">{d.orders}</span>
                      <span className="text-gray-400">pedidos</span>
                    </div>
                    {d.pallets > 0 && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <Truck className="h-3 w-3 text-emerald-400" />
                        <span>{d.pallets} pallets</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Hover indicator line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-blue-400/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Floating stats */}
      <div className="absolute top-2 right-2 flex items-center gap-2 flex-wrap justify-end">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/90 backdrop-blur-sm border text-xs shadow-sm">
          <Activity className="h-3 w-3 text-blue-500" />
          <span className="text-muted-foreground">Promedio:</span>
          <span className="font-semibold">{avgOrders}</span>
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm",
          trend > 0 ? "bg-emerald-100 text-emerald-700" : 
          trend < 0 ? "bg-red-100 text-red-700" : 
          "bg-gray-100 text-gray-600"
        )}>
          {trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : 
           trend < 0 ? <ArrowDownRight className="h-3 w-3" /> : 
           <Minus className="h-3 w-3" />}
          {Math.abs(trend)} vs inicio
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// METRIC CARD - Glassmorphism KPI card
// ============================================================================
interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  change?: number;
  sparklineData?: number[];
  accentColor: string;
  iconBg: string;
  size?: 'default' | 'large';
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  change, 
  sparklineData,
  accentColor,
  iconBg,
  size = 'default'
}: MetricCardProps) {
  return (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl border border-white/10",
      "bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40",
      "backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-500",
      "hover:translate-y-[-2px] hover:border-white/20",
      size === 'large' ? 'p-6' : 'p-5'
    )}>
      {/* Ambient glow effect */}
      <div 
        className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-30"
        style={{ background: accentColor }}
      />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={cn(
            "p-2.5 rounded-xl",
            iconBg
          )}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold",
              change > 0 ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" : 
              change < 0 ? "bg-red-100/80 text-red-700 dark:bg-red-900/50 dark:text-red-400" : 
              "bg-gray-100/80 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"
            )}>
              {change > 0 ? <ArrowUpRight className="h-3 w-3" /> : 
               change < 0 ? <ArrowDownRight className="h-3 w-3" /> : 
               <Minus className="h-3 w-3" />}
              {change > 0 ? '+' : ''}{change}%
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn(
            "font-bold tracking-tight",
            size === 'large' ? 'text-4xl' : 'text-3xl'
          )}>
            {typeof value === 'number' ? value.toLocaleString('es-ES') : value}
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        
        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-4 -mx-1">
            <Sparkline data={sparklineData} color={accentColor} height={36} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CLIENT RANKING CARD - Modern leaderboard item
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
    <div className={cn(
      "group relative p-4 rounded-xl transition-all duration-300",
      "bg-gradient-to-r from-white/60 to-white/30 dark:from-gray-800/60 dark:to-gray-800/30",
      "border border-white/20 dark:border-gray-700/30",
      "hover:from-white/80 hover:to-white/50 dark:hover:from-gray-800/80 dark:hover:to-gray-800/50",
      "hover:shadow-lg hover:border-white/30"
    )}>
      <div className="flex items-center gap-4">
        {/* Rank badge */}
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
          "transition-transform duration-300 group-hover:scale-110",
          isTop3 
            ? `bg-gradient-to-br ${medalColors[rank as 1 | 2 | 3]} text-white shadow-lg` 
            : "bg-muted text-muted-foreground"
        )}>
          {rank}
        </div>
        
        {/* Client info */}
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
          
          {/* Progress bar */}
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
      </div>
    </div>
  );
}

// ============================================================================
// REGION CARD - Geographic distribution card
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
    <div className={cn(
      "group relative p-5 rounded-2xl transition-all duration-300 overflow-hidden",
      "bg-gradient-to-br from-white/70 to-white/40 dark:from-gray-800/70 dark:to-gray-800/40",
      "border border-white/20 dark:border-gray-700/30",
      "hover:shadow-xl hover:scale-[1.02]"
    )}>
      {/* Background gradient on hover */}
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
        
        {/* Progress indicator */}
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out",
              gradient
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {/* Percentage label */}
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
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/60 to-white/30 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-muted" />
        <div className="w-16 h-6 rounded-full bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="w-24 h-4 rounded bg-muted" />
        <div className="w-32 h-8 rounded bg-muted" />
        <div className="w-20 h-3 rounded bg-muted" />
      </div>
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
// MAIN ANALYTICS COMPONENT
// ============================================================================
export default function Analytics() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d');
  const [customRange, setCustomRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Data states
  const [kpis, setKpis] = useState<AnalyticsKPIs | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [statusDist, setStatusDist] = useState<StatusDistribution[]>([]);
  const [clientStats, setClientStats] = useState<ClientStats[]>([]);
  const [regionStats, setRegionStats] = useState<RegionStats[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  
  // Calculate date range based on preset
  const dateRange = useMemo<DateRange>(() => {
    const now = new Date();
    switch (periodPreset) {
      case '7d':
        return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
      case '30d':
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      case '90d':
        return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
      case 'custom':
        return customRange;
      default:
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    }
  }, [periodPreset, customRange]);
  
  // Fetch data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [
        kpisData,
        trendData,
        statusData,
        clientData,
        regionData,
        comparisonData,
      ] = await Promise.all([
        fetchAnalyticsKPIs(dateRange),
        fetchDailyTrend(dateRange),
        fetchStatusDistribution(dateRange),
        fetchClientStats(dateRange),
        fetchRegionStats(dateRange),
        fetchPeriodComparison(dateRange),
      ]);
      
      setKpis(kpisData);
      setDailyTrend(trendData);
      setStatusDist(statusData);
      setClientStats(clientData);
      setRegionStats(regionData);
      setComparison(comparisonData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, [dateRange]);
  
  // Derived data
  const maxClientOrders = Math.max(...clientStats.slice(0, 10).map(c => c.totalOrders), 1);
  const maxRegionDeliveries = Math.max(...regionStats.map(r => r.deliveries), 1);
  const totalStatusCount = statusDist.reduce((sum, s) => sum + s.count, 0);
  const sparklineData = dailyTrend.map(d => d.orders);
  
  // Period label
  const periodLabel = periodPreset === 'custom' 
    ? `${format(customRange.from, 'dd MMM', { locale: es })} - ${format(customRange.to, 'dd MMM', { locale: es })}`
    : periodPreset === '7d' ? 'Últimos 7 días' 
    : periodPreset === '30d' ? 'Últimos 30 días' 
    : 'Últimos 90 días';
  
  // Donut chart data
  const donutData = statusDist.slice(0, 6).map(s => ({
    label: STATUS_CONFIG[s.status]?.label || s.status,
    value: s.count,
    color: STATUS_CONFIG[s.status]?.color || '#888',
  }));
  
  return (
    <div className="space-y-8 pb-8">
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
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
        
        {/* Period selector & refresh */}
        <div className="flex items-center gap-3">
          {/* Last updated */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={loadData}
                disabled={isLoading}
                className="text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                <Clock className="h-3 w-3 mr-1" />
                {format(lastUpdated, 'HH:mm', { locale: es })}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Actualizar datos</TooltipContent>
          </Tooltip>
          
          {/* Period buttons */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 backdrop-blur-sm border border-white/10">
            {(['7d', '30d', '90d'] as PeriodPreset[]).map((preset) => (
              <Button
                key={preset}
                variant={periodPreset === preset ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriodPreset(preset)}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-medium transition-all",
                  periodPreset === preset && "shadow-md"
                )}
              >
                {preset === '7d' ? '7D' : preset === '30d' ? '30D' : '90D'}
              </Button>
            ))}
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={periodPreset === 'custom' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    "h-8 px-3 rounded-lg text-xs font-medium transition-all",
                    periodPreset === 'custom' && "shadow-md"
                  )}
                >
                  <Calendar className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="range"
                  selected={{ from: customRange.from, to: customRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setCustomRange({ from: range.from, to: range.to });
                      setPeriodPreset('custom');
                    }
                  }}
                  locale={es}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      
      {/* Period indicator */}
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="secondary" className="font-normal">
          {periodLabel}
        </Badge>
        <span className="text-muted-foreground">
          • {format(dateRange.from, 'dd MMM yyyy', { locale: es })} → {format(dateRange.to, 'dd MMM yyyy', { locale: es })}
        </span>
      </div>
      
      {isLoading ? (
        <>
          {/* Loading state */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <ChartSkeleton height={280} />
            <ChartSkeleton height={280} />
          </div>
        </>
      ) : (
        <>
          {/* ================================================================== */}
          {/* KPI METRICS - Bento Grid */}
          {/* ================================================================== */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Pedidos"
              value={kpis?.totalOrders || 0}
              subtitle={`${kpis?.avgOrdersPerDay || 0} promedio/día`}
              icon={Package}
              change={comparison?.percentChange.orders}
              sparklineData={sparklineData}
              accentColor="#3b82f6"
              iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
            />
            <MetricCard
              title="Pallets Movidos"
              value={kpis?.totalPallets || 0}
              subtitle={`en ${dailyTrend.filter(d => d.pallets > 0).length} días activos`}
              icon={Truck}
              change={comparison?.percentChange.pallets}
              sparklineData={dailyTrend.map(d => d.pallets)}
              accentColor="#10b981"
              iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
            />
            <MetricCard
              title="Entregas Resueltas"
              value={kpis?.totalDeliveries || 0}
              subtitle="destinos asignados"
              icon={Target}
              change={comparison?.percentChange.deliveries}
              accentColor="#8b5cf6"
              iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
            />
            <MetricCard
              title="Pendientes"
              value={kpis?.pendingLocations || 0}
              subtitle="requieren ubicación"
              icon={AlertCircle}
              accentColor="#f59e0b"
              iconBg="bg-gradient-to-br from-amber-500 to-orange-600"
            />
          </div>
          
          {/* ================================================================== */}
          {/* CHARTS ROW */}
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
                  <Zap className="h-5 w-5 text-amber-500" />
                  Estado de Pedidos
                </CardTitle>
                <CardDescription>Distribución actual por estado</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col items-center">
                  {donutData.length > 0 ? (
                    <>
                      <DonutChart data={donutData} size={180} strokeWidth={20} />
                      
                      {/* Legend */}
                      <div className="mt-6 w-full space-y-2">
                        {statusDist.slice(0, 5).map((status) => {
                          const config = STATUS_CONFIG[status.status] || { color: '#888', label: status.status };
                          const percentage = totalStatusCount > 0 
                            ? Math.round((status.count / totalStatusCount) * 100) 
                            : 0;
                          
                          return (
                            <div 
                              key={status.status} 
                              className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full shadow-sm"
                                  style={{ backgroundColor: config.color }}
                                />
                                <span className="font-medium">{config.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{status.count}</span>
                                <span className="text-muted-foreground text-xs w-10 text-right">
                                  {percentage}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Activity className="h-12 w-12 mb-3 opacity-50" />
                      <p>Sin datos de estado</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* ================================================================== */}
          {/* DETAILED SECTIONS */}
          {/* ================================================================== */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Clients */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      Top Clientes
                    </CardTitle>
                    <CardDescription>
                      Ranking por volumen de pedidos
                    </CardDescription>
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
                    <Button variant="ghost" className="w-full mt-2 text-muted-foreground">
                      Ver todos ({clientStats.length})
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Regions */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-emerald-500" />
                      Distribución Geográfica
                    </CardTitle>
                    <CardDescription>
                      Entregas por comunidad autónoma
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {regionStats.length} regiones
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {regionStats.slice(0, 4).map((region, i) => (
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
                    <p>No hay datos de regiones</p>
                  </div>
                )}
                
                {regionStats.length > 4 && (
                  <Button variant="ghost" className="w-full mt-4 text-muted-foreground">
                    Ver todas ({regionStats.length})
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
