import React, { useState, useMemo, useEffect } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { fetchLocationAliases, fetchLocationsMap } from '@/lib/ordersService';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LocationAlias } from '@/types';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { Plus, Pencil, Trash2, ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function LocationAliases() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;
  
  const [aliases, setAliases] = useState<any[]>([]);
  const [locationMap, setLocationMap] = useState<Record<string, { name: string; code?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ search?: string; status?: string }>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlias, setEditingAlias] = useState<LocationAlias | null>(null);
  const [formData, setFormData] = useState({
    clientId: '',
    alias: '',
    normalizedLocation: '',
    active: true,
  });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [aliasesData, locMap] = await Promise.all([
          fetchLocationAliases(),
          fetchLocationsMap(),
        ]);
        setAliases(aliasesData);
        setLocationMap(locMap);
      } catch (error) {
        console.error('Error loading location aliases:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredAliases = useMemo(() => {
    return aliases.filter((a) => {
      if (filters.status && a.status !== filters.status) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (
          !a.aliasNorm?.toLowerCase().includes(s) &&
          !String(a.locationId)?.toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [filters, aliases]);

  const openNew = () => {
    setEditingAlias(null);
    setFormData({ clientId: '', alias: '', normalizedLocation: '', active: true });
    setIsDialogOpen(true);
  };

  const openEdit = (alias: LocationAlias) => {
    setEditingAlias(alias);
    setFormData({
      clientId: alias.clientId,
      alias: alias.alias,
      normalizedLocation: alias.normalizedLocation,
      active: alias.active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    toast.success(editingAlias ? t.aliases.aliasUpdated : t.aliases.aliasCreated);
    setIsDialogOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'success';
      case 'PENDING': return 'warning';
      case 'REJECTED': return 'error';
      default: return 'neutral';
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'aliasNorm',
      header: 'Alias Normalizado',
      cell: (row) => <span className="font-mono font-medium">{row.aliasNorm}</span>,
    },
    {
      key: 'mapping',
      header: 'Mapeo',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{row.aliasNorm}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            Location ID: {row.locationId}
            {locationMap[row.locationId]?.name ? ` · ${locationMap[row.locationId].name}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (row) => <StatusBadge status={getStatusColor(row.status)} label={row.status} />,
    },
    {
      key: 'source',
      header: 'Origen',
      cell: (row) => <span className="text-sm">{row.source}</span>,
    },
    {
      key: 'confidence',
      header: 'Confianza',
      cell: (row) => <span className="text-sm">{(row.confidence * 100).toFixed(0)}%</span>,
    },
    {
      key: 'hits',
      header: 'Usos',
      cell: (row) => <span className="text-sm font-medium">{row.hits}</span>,
    },
    {
      key: 'lastUsed',
      header: 'Último Uso',
      cell: (row) => row.lastUsed ? format(new Date(row.lastUsed), 'dd/MM/yyyy', { locale: dateLocale }) : '-',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">{t.aliases.title}</h1>
          <p className="page-description">{t.aliases.subtitle}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t.aliases.newAlias}
        </Button>
      </div>

      <FilterBar
        filters={[
          { key: 'search', type: 'search', label: t.common.search, placeholder: 'Buscar por alias o location ID...' },
          {
            key: 'status',
            type: 'select',
            label: 'Estado',
            options: [
              { value: 'APPROVED', label: 'Aprobado' },
              { value: 'PENDING', label: 'Pendiente' },
              { value: 'REJECTED', label: 'Rechazado' },
            ],
          },
        ]}
        values={filters}
        onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
        onClear={() => setFilters({})}
      />

      <DataTable
        columns={columns}
        data={filteredAliases}
        keyExtractor={(row) => row.id}
        emptyMessage={t.aliases.noAliasesFound}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.aliases.newAlias}</DialogTitle>
            <DialogDescription>
              La edición/creación de alias se gestiona fuera del frontend. Esta vista es solo de lectura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Para crear o editar alias, usa el flujo de backoffice o n8n. Aquí solo se listan los alias existentes de la tabla location_aliases.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
