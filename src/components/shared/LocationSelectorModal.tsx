import React, { useState, useCallback, useEffect } from 'react';
import { Search, MapPin, Check, AlertTriangle, Plus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { searchLocations, setLineLocation, createLocationAlias } from '@/lib/ordersService';
import type { OrderLine, Location, LocationSuggestion } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface LocationSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  line: OrderLine | null;
  onLocationSet: (lineId: string, location: Location) => void;
}

export function LocationSelectorModal({
  isOpen,
  onClose,
  line,
  onLocationSet,
}: LocationSelectorModalProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [createAlias, setCreateAlias] = useState(true);
  const [aliasText, setAliasText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize alias text from raw customer (consignatario) when line changes
  // El alias debe ser el nombre del consignatario (rawCustomerText), no la localidad (rawDestinationText)
  // porque el matching del workflow busca por nombre de consignatario
  useEffect(() => {
    if (line) {
      // Para el alias: usar el nombre del consignatario del Excel
      const aliasSource = line.rawCustomerText || line.customer || '';
      setAliasText(aliasSource.trim().toUpperCase());
      
      // Para la búsqueda inicial: combinar consignatario + localidad para mejor matching
      const searchSource = [line.rawCustomerText, line.rawDestinationText]
        .filter(Boolean)
        .join(' ');
      setSearchQuery(searchSource || line.customer || '');
      setSelectedLocation(null);
    }
  }, [line]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchLocations(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectLocation = (location: Location) => {
    setSelectedLocation(location);
  };

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    const location: Location = {
      id: suggestion.id,
      name: suggestion.name,
      address: suggestion.address,
      city: suggestion.city,
      province: suggestion.province,
      zipCode: suggestion.zipCode,
    };
    setSelectedLocation(location);
  };

  const handleConfirm = async () => {
    if (!selectedLocation || !line) return;

    setIsSaving(true);
    try {
      // Set the location on the line
      const result = await setLineLocation(line.id, selectedLocation.id);
      
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      // Create alias if requested
      if (createAlias && aliasText.trim()) {
        const aliasResult = await createLocationAlias(aliasText.trim(), selectedLocation.id);
        if (aliasResult.success) {
          toast.success('Dirección de entrega asignada y alias creado');
        } else {
          toast.warning(`Dirección asignada, pero: ${aliasResult.message}`);
        }
      } else {
        toast.success('Dirección de entrega asignada. Tu corrección contribuye a mejorar la extracción automática.');
      }

      onLocationSet(line.id, selectedLocation);
      onClose();
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedLocation(null);
    setCreateAlias(true);
    onClose();
  };

  if (!line) return null;

  const suggestions = line.locationSuggestions || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Asignar Dirección de Entrega
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              {/* Datos del pedido */}
              <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Línea {line.lineNumber}
                  </span>
                  <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">
                    {line.pallets} pallets
                  </span>
                </div>
                
                <div className="grid gap-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Consignatario:</span>
                    <span className="text-sm font-medium">{line.rawCustomerText || line.customer}</span>
                  </div>
                  {line.rawDestinationText && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">Localidad (Excel):</span>
                      <span className="text-sm">{line.rawDestinationText}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Search className="h-3 w-3" />
                Busca la dirección de entrega del consignatario en nuestra base de datos
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Contenido con scroll */}
        <ScrollArea className="flex-1 -mx-4 px-4 sm:-mx-6 sm:px-6 min-h-0">
          <div className="space-y-4 py-2 pb-4">
            {/* Suggestions section */}
            {suggestions.length > 0 && (
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Direcciones de entrega sugeridas ({suggestions.length})
                </Label>
                <div className="space-y-2 max-h-[120px] overflow-y-auto rounded-md border p-2">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedLocation?.id === suggestion.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-accent hover:border-accent-foreground/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{suggestion.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[suggestion.city, suggestion.province].filter(Boolean).join(', ')}
                          </p>
                          {suggestion.address && (
                            <p className="text-xs text-muted-foreground truncate">
                              {suggestion.address}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(suggestion.score * 100)}%
                          </Badge>
                          {selectedLocation?.id === suggestion.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Search section */}
            <div>
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Search className="h-4 w-4" />
                Buscar dirección de entrega
              </Label>
              <div className="relative">
                <Input
                  placeholder="Buscar por nombre, dirección, ciudad..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-8"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="max-h-[140px] overflow-y-auto rounded-md border mt-2 p-2">
                  <div className="space-y-1">
                    {searchResults.map((location) => (
                      <div
                        key={location.id}
                        onClick={() => handleSelectLocation(location)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedLocation?.id === location.id
                            ? 'border border-primary bg-primary/5'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{location.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[location.city, location.province].filter(Boolean).join(', ')}
                              {location.zipCode && ` - ${location.zipCode}`}
                            </p>
                            {location.address && (
                              <p className="text-xs text-muted-foreground truncate">
                                {location.address}
                              </p>
                            )}
                          </div>
                          {selectedLocation?.id === location.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No se encontraron direcciones de entrega
                </p>
              )}
            </div>

            {/* Create alias + Selected location - visible cuando hay ubicacion seleccionada */}
            {selectedLocation && (
              <>
                <Separator />
                
                {/* Selected location preview */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    Dirección de entrega seleccionada
                  </Label>
                  <div className="p-3 rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-emerald-800 dark:text-emerald-300">{selectedLocation.name}</p>
                        <p className="text-sm text-emerald-700 dark:text-emerald-400">
                          {[selectedLocation.address, selectedLocation.city, selectedLocation.province]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 bg-white dark:bg-gray-800">
                        ID: {selectedLocation.id}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Create alias option - with clear explanation */}
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="create-alias"
                      checked={createAlias}
                      onCheckedChange={(checked) => setCreateAlias(checked as boolean)}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="create-alias" className="text-sm font-medium cursor-pointer text-blue-800 dark:text-blue-300">
                        Recordar esta asignación (crear alias)
                      </Label>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Cuando aparezca este consignatario en futuros pedidos, se asignará automáticamente esta dirección de entrega.
                      </p>
                    </div>
                  </div>
                  {createAlias && (
                    <div className="pl-6 space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Texto del consignatario que activará el alias:
                      </Label>
                      <Input
                        value={aliasText}
                        onChange={(e) => setAliasText(e.target.value.toUpperCase())}
                        placeholder="NOMBRE DEL CONSIGNATARIO"
                        className="font-mono text-sm h-8 bg-white dark:bg-gray-900"
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-4 border-t gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSaving} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedLocation || isSaving} className="w-full sm:w-auto h-10 min-w-[44px]">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Confirmar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
