import React, { useState, useEffect } from 'react';
import { Search, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchClients } from '@/lib/ordersService';
import type { Client } from '@/types';

interface ClientSearchBoxProps {
  value: string;
  onSelect: (clientId: string, client?: Client) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  /** Initial display text when a client is pre-selected (e.g. from parent state) */
  selectedClientName?: string;
  className?: string;
}

/**
 * Search box for clients - type to search, results appear below (like consignatarios/LocationSelectorModal).
 * Replaces the old Select dropdown with a live search experience.
 */
export function ClientSearchBox({
  value,
  onSelect,
  placeholder = 'Buscar por nombre o código de cliente...',
  label = 'Cliente',
  disabled = false,
  selectedClientName,
  className = '',
}: ClientSearchBoxProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // When value changes externally (e.g. reset), clear search
  useEffect(() => {
    if (!value) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchClients(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Client search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectClient = (client: Client) => {
    onSelect(client.id, client);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-medium flex items-center gap-2">
        <Search className="h-4 w-4" />
        {label}
      </Label>
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-8"
          disabled={disabled}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Mostrar cliente seleccionado cuando hay value */}
      {value && selectedClientName && (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Check className="h-4 w-4 text-primary" />
          Seleccionado: <strong>{selectedClientName}</strong>
        </p>
      )}

      {searchResults.length > 0 && (
        <div className="max-h-[180px] overflow-y-auto rounded-md border p-2">
          <div className="space-y-1">
            {searchResults.map((client) => (
              <div
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  value === client.id
                    ? 'border border-primary bg-primary/5'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Código: {client.code}
                    </p>
                  </div>
                  {value === client.id && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3">
          No se encontraron clientes
        </p>
      )}
    </div>
  );
}
