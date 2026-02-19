import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  MapPin, 
  AlertTriangle, 
  ChevronRight,
  ExternalLink,
  Clock,
  Building2,
  Package,
  Search,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================
export interface PendingLocationLine {
  lineId: string;
  orderId: string;
  orderCode: string;
  clientName: string;
  rawDestinationText: string;
  rawCustomerText?: string;
  pallets: number;
  deliveryDate?: string;
  createdAt: string;
  suggestionsCount?: number;
}

export interface LocationSuggestion {
  id: number;
  name: string;
  address?: string;
  city?: string;
  province?: string;
  score?: number;
}

// ============================================================================
// PENDING LOCATION QUEUE COMPONENT
// ============================================================================
export interface PendingLocationQueueProps {
  lines: PendingLocationLine[];
  isLoading?: boolean;
  maxItems?: number;
  onAssignLocation?: (lineId: string, locationId: number) => Promise<void>;
  onSearchLocations?: (query: string) => Promise<LocationSuggestion[]>;
}

export function PendingLocationQueue({
  lines,
  isLoading = false,
  maxItems = 5,
  onAssignLocation,
  onSearchLocations,
}: PendingLocationQueueProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const displayLines = lines.slice(0, maxItems);
  const hasMore = lines.length > maxItems;

  if (lines.length === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
          <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">
            Sin pendientes de ubicación
          </h3>
          <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 mt-1">
            Todas las líneas tienen destino asignado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:border-amber-800 dark:from-amber-950/30 dark:to-orange-950/20 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <span>{lines.length} líneas requieren ubicación</span>
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                  Acción requerida
                </Badge>
              </CardTitle>
              <CardDescription>
                Asigna destino para continuar el procesamiento
              </CardDescription>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/orders?location_status=PENDING_LOCATION')}
            className="shrink-0"
          >
            Ver todas
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Queue table / cards */}
        <div className="rounded-lg border border-amber-200/50 dark:border-amber-800/50 overflow-hidden bg-white/60 dark:bg-gray-900/40">
          {/* Header - hidden on mobile (cards show labels inline) */}
          {!isMobile && (
            <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-amber-100/50 dark:bg-amber-900/20 text-xs font-medium text-amber-800 dark:text-amber-300 border-b border-amber-200/50 dark:border-amber-800/50">
              <div className="col-span-2">Pedido</div>
              <div className="col-span-3">Cliente</div>
              <div className="col-span-3">Destino (raw)</div>
              <div className="col-span-1 text-center">Pallets</div>
              <div className="col-span-1 text-center">Antigüedad</div>
              <div className="col-span-2 text-right">Acción</div>
            </div>
          )}

          {/* Rows */}
          <div className={isMobile ? "space-y-3 p-3" : "divide-y divide-amber-100 dark:divide-amber-900/30"}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                <span className="ml-2 text-sm text-muted-foreground">Cargando pendientes...</span>
              </div>
            ) : (
              displayLines.map((line) => (
                <PendingLocationRow
                  key={line.lineId}
                  line={line}
                  onAssignLocation={onAssignLocation}
                  onSearchLocations={onSearchLocations}
                  isCard={isMobile}
                />
              ))
            )}
          </div>

          {/* Footer with link to all */}
          {hasMore && (
            <div className="px-4 py-3 bg-amber-50/50 dark:bg-amber-900/10 border-t border-amber-200/50 dark:border-amber-800/50">
              <Link 
                to="/orders?location_status=PENDING_LOCATION"
                className="flex items-center justify-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
              >
                Ver las {lines.length - maxItems} líneas restantes
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// PENDING LOCATION ROW
// ============================================================================
interface PendingLocationRowProps {
  line: PendingLocationLine;
  onAssignLocation?: (lineId: string, locationId: number) => Promise<void>;
  onSearchLocations?: (query: string) => Promise<LocationSuggestion[]>;
  isCard?: boolean;
}

function PendingLocationRow({
  line,
  onAssignLocation,
  onSearchLocations,
  isCard = false,
}: PendingLocationRowProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(line.rawDestinationText || '');
  const [searchResults, setSearchResults] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const handleSearch = async () => {
    if (!onSearchLocations || !searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await onSearchLocations(searchQuery);
      setSearchResults(results);
    } catch (error) {
      toast.error('Error al buscar ubicaciones');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAssign = async (locationId: number, locationName: string) => {
    if (!onAssignLocation) return;
    
    setIsAssigning(true);
    try {
      await onAssignLocation(line.lineId, locationId);
      toast.success(`Ubicación asignada: ${locationName}`);
      setIsDialogOpen(false);
    } catch (error) {
      toast.error('Error al asignar ubicación');
    } finally {
      setIsAssigning(false);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(line.createdAt), {
    addSuffix: false,
    locale: es,
  });

  const orderLink = (
    <Link
      to={`/orders/${line.orderId}`}
      className="font-medium text-sm text-primary hover:underline flex items-center gap-1"
    >
      {line.orderCode}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
    </Link>
  );

  const actionButton = (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="default"
          className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm h-10 min-w-[44px] sm:h-8 sm:min-w-0"
        >
          <MapPin className="h-3.5 w-3.5 mr-1" aria-hidden />
          Asignar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignar ubicación</DialogTitle>
          <DialogDescription>
            Busca y selecciona el destino para la línea del pedido {line.orderCode}
          </DialogDescription>
        </DialogHeader>

        {/* Line info */}
        <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
          <p><strong>Cliente:</strong> {line.clientName}</p>
          <p><strong>Destino original:</strong> {line.rawDestinationText || 'No especificado'}</p>
          {line.rawCustomerText && (
            <p><strong>Consignatario:</strong> {line.rawCustomerText}</p>
          )}
          <p><strong>Pallets:</strong> {line.pallets}</p>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Buscar ubicación..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>

        {/* Results */}
        {searchResults.length > 0 && (
          <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
            {searchResults.map((loc) => (
              <button
                key={loc.id}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors disabled:opacity-50"
                onClick={() => handleAssign(loc.id, loc.name)}
                disabled={isAssigning}
              >
                <p className="font-medium">{loc.name}</p>
                <p className="text-sm text-muted-foreground">
                  {[loc.address, loc.city, loc.province].filter(Boolean).join(', ')}
                </p>
                {loc.score !== undefined && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    Coincidencia: {(loc.score * 100).toFixed(0)}%
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}

        {searchResults.length === 0 && searchQuery && !isSearching && (
          <p className="text-center text-sm text-muted-foreground py-4">
            No se encontraron ubicaciones. Intenta con otros términos.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );

  if (isCard) {
    return (
      <div className="rounded-lg border border-amber-200/50 dark:border-amber-800/50 bg-white dark:bg-gray-900/40 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>{orderLink}</div>
          <Badge variant="secondary" className="font-mono shrink-0">
            {line.pallets}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <span className="truncate" title={line.clientName}>{line.clientName}</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden />
          <span className="font-medium text-amber-700 dark:text-amber-400 break-words">
            {line.rawDestinationText || 'Sin especificar'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden />
            {timeAgo}
          </span>
          {actionButton}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors group">
      {/* Order code */}
      <div className="col-span-2">{orderLink}</div>

      {/* Client */}
      <div className="col-span-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <span className="text-sm truncate" title={line.clientName}>
            {line.clientName}
          </span>
        </div>
      </div>

      {/* Raw destination */}
      <div className="col-span-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400 truncate" title={line.rawDestinationText}>
            {line.rawDestinationText || 'Sin especificar'}
          </span>
        </div>
      </div>

      {/* Pallets */}
      <div className="col-span-1 text-center">
        <Badge variant="secondary" className="font-mono">
          {line.pallets}
        </Badge>
      </div>

      {/* Time ago */}
      <div className="col-span-1 text-center">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden />
          <span>{timeAgo}</span>
        </div>
      </div>

      {/* Action */}
      <div className="col-span-2 text-right">{actionButton}</div>
    </div>
  );
}

export default PendingLocationQueue;
