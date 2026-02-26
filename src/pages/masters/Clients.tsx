import React, { useState, useMemo, useEffect } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  fetchClientsWithLastOrder,
  fetchClientWithDefaultLocation,
  saveCustomerDefaultLoadLocation,
  clearCustomerDefaultLoadLocation,
} from '@/lib/ordersService';
import { useLanguage, interpolate } from '@/contexts/LanguageContext';
import type { Client, Location } from '@/types';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { LocationSearchSelect } from '@/components/shared/LocationSearchSelect';

export default function Clients() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;
  
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('lastOrderAt_desc');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', email: '', active: true });
  const [defaultLoadLocation, setDefaultLoadLocation] = useState<Location | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [hasLoadedLocation, setHasLoadedLocation] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const clientsData = await fetchClientsWithLastOrder();
        setClients(clientsData);
      } catch (error) {
        console.error('Error loading clients:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredClients = useMemo(() => {
    let result = clients;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.code?.toLowerCase().includes(s) ||
          c.name?.toLowerCase().includes(s) ||
          c.email?.toLowerCase().includes(s) ||
          c.location?.toLowerCase().includes(s) ||
          c.companyCode?.toLowerCase().includes(s)
      );
    }
    // Ordenar
    const [key, dir] = sortBy.split('_');
    const mult = dir === 'desc' ? -1 : 1;
    return [...result].sort((a, b) => {
      if (key === 'lastOrderAt' || key === 'lastOrder') {
        const aVal = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
        const bVal = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
        return (aVal - bVal) * mult;
      }
      if (key === 'name') {
        return ((a.name || '').localeCompare(b.name || '')) * mult;
      }
      if (key === 'code') {
        return ((a.code || '').localeCompare(b.code || '')) * mult;
      }
      return 0;
    });
  }, [search, clients, sortBy]);

  const openNew = () => {
    setEditingClient(null);
    setFormData({ code: '', name: '', email: '', active: true });
    setDefaultLoadLocation(null);
    setHasLoadedLocation(false);
    setIsDialogOpen(true);
  };

  const openEdit = async (client: Client) => {
    setEditingClient(client);
    setFormData({
      code: client.code,
      name: client.name,
      email: client.email || '',
      active: client.active,
    });
    setDefaultLoadLocation(null);
    setHasLoadedLocation(false);
    setIsDialogOpen(true);
    // Load default load location for this client
    try {
      const clientData = await fetchClientWithDefaultLocation(client.id);
      setHasLoadedLocation(true);
      if (clientData?.defaultLoadLocation) {
        setDefaultLoadLocation({
          id: Number(clientData.defaultLoadLocation.id),
          name: clientData.defaultLoadLocation.name,
          address: clientData.defaultLoadLocation.address,
          city: clientData.defaultLoadLocation.city,
          province: clientData.defaultLoadLocation.region,
          zipCode: clientData.defaultLoadLocation.zipCode,
        });
      }
    } catch (err) {
      console.error('Error loading default load location:', err);
    }
  };

  const handleSave = async () => {
    if (editingClient && hasLoadedLocation) {
      // Save default load location (only when we successfully loaded client data)
      setSavingLocation(true);
      try {
        if (defaultLoadLocation) {
          const result = await saveCustomerDefaultLoadLocation(editingClient.id, defaultLoadLocation.id);
          if (result.success) {
            toast.success(result.message);
          } else {
            toast.error(result.message);
            setSavingLocation(false);
            return;
          }
        } else {
          const result = await clearCustomerDefaultLoadLocation(editingClient.id);
          if (result.success) {
            toast.success(result.message);
          } else {
            toast.error(result.message);
            setSavingLocation(false);
            return;
          }
        }
      } catch (err) {
        toast.error('Error al guardar ubicación de carga');
        setSavingLocation(false);
        return;
      } finally {
        setSavingLocation(false);
      }
      toast.success(interpolate(t.clients.clientUpdated, { name: formData.name }));
    } else if (editingClient) {
      toast.success(interpolate(t.clients.clientUpdated, { name: formData.name }));
    } else {
      toast.success(interpolate(t.clients.clientCreated, { name: formData.name }));
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (client: Client) => {
    toast.success(interpolate(t.clients.clientDeleted, { name: client.name }));
  };

  const columns: Column<any>[] = [
    {
      key: 'code',
      header: t.common.code || 'Código',
      cell: (row) => <span className="font-mono font-medium">{row.code}</span>,
    },
    {
      key: 'name',
      header: t.common.name || 'Nombre',
      cell: (row) => row.name,
    },
    {
      key: 'companyCode',
      header: 'Código Empresa',
      cell: (row) => row.companyCode || '-',
    },
    {
      key: 'location',
      header: 'Localización',
      cell: (row) => {
        const parts = [];
        if (row.location) parts.push(row.location);
        if (row.country) parts.push(row.country);
        return parts.join(', ') || '-';
      },
    },
    {
      key: 'active',
      header: t.common.status || 'Estado',
      cell: (row) =>
        row.active ? (
          <StatusBadge status="success" label={t.common.active || 'Activo'} />
        ) : (
          <StatusBadge status="neutral" label={t.common.inactive || 'Inactivo'} />
        ),
    },
    {
      key: 'lastOrderAt',
      header: t.clients?.lastOrder ?? 'Último pedido',
      sortable: true,
      cell: (row) =>
        row.lastOrderAt
          ? format(new Date(row.lastOrderAt), 'dd/MM/yyyy HH:mm', { locale: dateLocale })
          : (t.clients?.noOrders ?? '-'),
    },
    {
      key: 'createdAt',
      header: 'Importado',
      cell: (row) => row.createdAt ? format(new Date(row.createdAt), 'dd/MM/yyyy', { locale: dateLocale }) : '-',
    },
    {
      key: 'actions',
      header: t.common.actions || 'Acciones',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(row); }} aria-label={t.clients.editClient || 'Editar cliente'}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ),
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
          <h1 className="page-title">{t.clients.title}</h1>
          <p className="page-description">{t.clients.subtitle}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t.clients.newClient}
        </Button>
      </div>

      <FilterBar
        filters={[
          { key: 'search', type: 'search', label: t.common.search, placeholder: t.clients.searchPlaceholder },
          {
            key: 'sort',
            type: 'select',
            label: t.clients?.sortBy ?? 'Ordenar por',
            options: [
              { value: 'lastOrderAt_desc', label: t.clients?.sortLastOrderDesc ?? 'Último pedido (más reciente)' },
              { value: 'lastOrderAt_asc', label: t.clients?.sortLastOrderAsc ?? 'Último pedido (más antiguo)' },
              { value: 'name_asc', label: t.clients?.sortNameAsc ?? 'Nombre A-Z' },
              { value: 'name_desc', label: t.clients?.sortNameDesc ?? 'Nombre Z-A' },
              { value: 'code_asc', label: t.clients?.sortCodeAsc ?? 'Código' },
            ],
          },
        ]}
        values={{ search, sort: sortBy }}
        onChange={(key, value) => {
          if (key === 'search') setSearch(value || '');
          if (key === 'sort') setSortBy(value || 'lastOrderAt_desc');
        }}
        onClear={() => { setSearch(''); setSortBy('lastOrderAt_desc'); }}
      />

      <DataTable
        columns={columns}
        data={filteredClients}
        keyExtractor={(row) => row.id}
        emptyMessage={t.clients.noClientsFound}
        sort={{
          key: sortBy.split('_')[0],
          dir: (sortBy.split('_')[1] || 'desc') as 'asc' | 'desc',
        }}
        onSortChange={(key, dir) => setSortBy(`${key}_${dir}`)}
      />

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClient ? t.clients.editClient : t.clients.newClient}</DialogTitle>
            <DialogDescription>
              {editingClient ? t.clients.editClient : t.clients.newClient}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">{t.common.code}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="ej. METRO"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t.common.name}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ej. Metro S.p.A."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t.common.email}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="pedidos@ejemplo.com"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">{t.common.active}</Label>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
            {editingClient && (
              <LocationSearchSelect
                label="Ubicación de carga predeterminada"
                placeholder="Buscar ubicación de carga..."
                value={defaultLoadLocation}
                onChange={setDefaultLoadLocation}
                disabled={savingLocation}
                hint="Se usará como punto de carga cuando el pedido no especifique uno en el documento."
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={savingLocation}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSave} disabled={savingLocation}>
              {savingLocation ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                t.common.save
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
