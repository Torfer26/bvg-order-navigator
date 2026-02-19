import React, { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { searchLocations } from '@/lib/ordersService';
import type { Location } from '@/types';

export interface LocationSearchSelectProps {
  value: Location | null | undefined;
  onChange: (location: Location | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Helper text below the field */
  hint?: string;
}

/**
 * Reusable location search and select component.
 * Same search mechanism as consignatario (LocationSelectorModal) - uses customer_location_stg.
 */
export function LocationSearchSelect({
  value,
  onChange,
  label = 'Ubicación',
  placeholder = 'Buscar por nombre, dirección, ciudad...',
  disabled = false,
  hint,
}: LocationSearchSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
        console.error('Location search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectLocation = (location: Location) => {
    onChange(location);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleClear = () => {
    onChange(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>

      {value ? (
        <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{value.name}</p>
            <p className="text-xs text-muted-foreground">
              {[value.city, value.province].filter(Boolean).join(', ')}
              {value.zipCode && ` - ${value.zipCode}`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Quitar ubicación"
            className="shrink-0 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Input
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={disabled}
              className="pr-8"
              aria-label={label}
            />
            {isSearching && (
              <Loader2
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
                aria-hidden
              />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="max-h-[140px] overflow-y-auto rounded-md border p-2 space-y-1">
              {searchResults.map((location) => (
                <div
                  key={location.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectLocation(location)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectLocation(location);
                    }
                  }}
                  className="p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <div>
                    <p className="font-medium text-sm">{location.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[location.city, location.province].filter(Boolean).join(', ')}
                      {location.zipCode && ` - ${location.zipCode}`}
                    </p>
                    {location.address && (
                      <p className="text-xs text-muted-foreground truncate">{location.address}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No se encontraron ubicaciones</p>
          )}
        </>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
