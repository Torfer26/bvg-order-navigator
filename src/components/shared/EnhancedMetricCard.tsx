import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Info, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ChevronRight,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================================================
// KPI DEFINITIONS - Definiciones claras para cada métrica
// ============================================================================
export interface KPIDefinition {
  description: string;
  formula?: string;
  unit: string;
  note?: string;
  frequency?: string;
}

export const KPI_DEFINITIONS: Record<string, KPIDefinition> = {
  totalOrders: {
    description: "Número de pedidos recibidos en el período seleccionado.",
    formula: "COUNT(ordenes_intake) WHERE created_at IN período",
    unit: "pedidos",
    frequency: "Actualización: cada 5 minutos",
  },
  totalPallets: {
    description: "Suma de pallets declarados en todas las líneas de pedidos del período.",
    formula: "SUM(ordenes_intake_lineas.pallets)",
    unit: "pallets (PLT)",
    note: "Solo incluye pedidos con líneas procesadas.",
  },
  deliveriesResolved: {
    description: "Líneas de pedido con destino asignado (destination_id no nulo).",
    formula: "COUNT(lineas) WHERE destination_id IS NOT NULL",
    unit: "líneas",
    note: "Una 'entrega' = una línea de pedido con destino.",
  },
  pendingLocations: {
    description: "Líneas sin destino asignado que requieren selección manual.",
    formula: "COUNT(lineas) WHERE location_status = 'PENDING_LOCATION'",
    unit: "líneas",
    note: "⚠️ Bloquean el procesamiento del pedido.",
  },
  backlogTotal: {
    description: "Pedidos que aún no han sido completados o rechazados.",
    formula: "COUNT(pedidos) WHERE status NOT IN (COMPLETED, REJECTED)",
    unit: "pedidos",
  },
  avgCycleTime: {
    description: "Tiempo promedio desde recepción hasta completado.",
    formula: "AVG(completed_at - created_at)",
    unit: "minutos",
  },
};

// ============================================================================
// SPARKLINE COMPONENT
// ============================================================================
function Sparkline({ 
  data, 
  color = '#3b82f6', 
  height = 32 
}: { 
  data: number[]; 
  color?: string; 
  height?: number;
}) {
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
    <svg 
      width="100%" 
      height={height} 
      className="overflow-visible"
      role="img"
      aria-label="Gráfico de tendencia"
    >
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
// ENHANCED METRIC CARD COMPONENT
// ============================================================================
export interface EnhancedMetricCardProps {
  title: string;
  value: number;
  previousValue?: number;
  change?: number;
  definition: KPIDefinition;
  drilldownUrl: string;
  drilldownLabel: string;
  variant?: 'default' | 'warning' | 'critical';
  sparklineData?: number[];
  icon: LucideIcon;
  accentColor?: string;
  iconBg?: string;
}

export function EnhancedMetricCard({
  title,
  value,
  previousValue,
  change,
  definition,
  drilldownUrl,
  drilldownLabel,
  variant = 'default',
  sparklineData,
  icon: Icon,
  accentColor = '#3b82f6',
  iconBg = 'bg-primary',
}: EnhancedMetricCardProps) {
  const navigate = useNavigate();
  
  const variantStyles = {
    default: 'border-border hover:border-primary/30',
    warning: 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400',
    critical: 'border-red-300 bg-red-50/50 dark:bg-red-950/20 hover:border-red-400',
  };

  const handleClick = () => {
    navigate(drilldownUrl);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(drilldownUrl);
    }
  };

  return (
    <div 
      className={cn(
        "group relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300",
        "bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40",
        "backdrop-blur-xl shadow-lg hover:shadow-xl",
        "hover:translate-y-[-2px]",
        variantStyles[variant]
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${value.toLocaleString('es-ES')} ${definition.unit}. Click para ${drilldownLabel.toLowerCase()}`}
    >
      {/* Ambient glow effect */}
      <div 
        className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-10 blur-3xl transition-opacity duration-500 group-hover:opacity-20 pointer-events-none"
        style={{ background: accentColor }}
      />
      
      {/* Urgent indicator for warning/critical */}
      {variant !== 'default' && (
        <div className="absolute top-3 right-3">
          <span className="relative flex h-3 w-3">
            <span className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              variant === 'critical' ? 'bg-red-400' : 'bg-amber-400'
            )} />
            <span className={cn(
              "relative inline-flex rounded-full h-3 w-3",
              variant === 'critical' ? 'bg-red-500' : 'bg-amber-500'
            )} />
          </span>
        </div>
      )}

      <div className="relative z-10">
        {/* Header with icon and definition tooltip */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2.5 rounded-xl text-white shadow-lg",
              iconBg
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="font-medium text-sm text-muted-foreground">{title}</span>
            
            {/* Definition tooltip */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Definición de ${title}`}
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-4" onClick={(e) => e.stopPropagation()}>
                <p className="font-semibold mb-2">{title}</p>
                <p className="text-sm text-muted-foreground mb-2">{definition.description}</p>
                {definition.formula && (
                  <p className="text-xs font-mono bg-muted p-2 rounded mb-2">
                    {definition.formula}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  <strong>Unidad:</strong> {definition.unit}
                </p>
                {definition.note && (
                  <p className={cn(
                    "text-xs mt-2 p-2 rounded",
                    definition.note.includes('⚠️') 
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {definition.note}
                  </p>
                )}
                {definition.frequency && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {definition.frequency}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Change indicator */}
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
              change > 0 ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" :
              change < 0 ? "bg-red-100/80 text-red-700 dark:bg-red-900/50 dark:text-red-400" :
              "bg-gray-100/80 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"
            )}>
              {change > 0 ? <TrendingUp className="h-3 w-3" /> : 
               change < 0 ? <TrendingDown className="h-3 w-3" /> : 
               <Minus className="h-3 w-3" />}
              {change > 0 ? '+' : ''}{change}%
            </div>
          )}
        </div>

        {/* Value */}
        <div className="space-y-1">
          <p className="text-3xl font-bold tracking-tight">
            {value.toLocaleString('es-ES')}
          </p>
          
          {/* Comparison context - explicit "vs período anterior" */}
          {previousValue !== undefined && change !== undefined && (
            <p className="text-sm text-muted-foreground">
              vs {previousValue.toLocaleString('es-ES')} período anterior
            </p>
          )}
          {previousValue === undefined && change !== undefined && (
            <p className="text-sm text-muted-foreground">
              vs período anterior
            </p>
          )}
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-4 -mx-1">
            <Sparkline data={sparklineData} color={accentColor} height={36} />
          </div>
        )}

        {/* Drill-down CTA - always visible for warning/critical, hover for default */}
        <div className={cn(
          "mt-4 flex items-center gap-1 text-sm font-medium transition-all duration-200",
          variant === 'default' 
            ? "opacity-0 group-hover:opacity-100 text-primary" 
            : variant === 'warning'
            ? "opacity-100 text-amber-700 dark:text-amber-400"
            : "opacity-100 text-red-700 dark:text-red-400"
        )}>
          <span>{drilldownLabel}</span>
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
}

export default EnhancedMetricCard;
