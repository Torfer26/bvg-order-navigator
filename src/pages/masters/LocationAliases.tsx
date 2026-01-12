import React, { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { mockLocationAliases, mockClients } from '@/lib/mockData';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LocationAlias } from '@/types';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { Plus, Pencil, Trash2, ArrowRight } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function LocationAliases() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;
  
  const [filters, setFilters] = useState<{ search?: string; clientId?: string }>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlias, setEditingAlias] = useState<LocationAlias | null>(null);
  const [formData, setFormData] = useState({
    clientId: '',
    alias: '',
    normalizedLocation: '',
    active: true,
  });

  const filteredAliases = useMemo(() => {
    return mockLocationAliases.filter((a) => {
      if (filters.clientId && a.clientId !== filters.clientId) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (
          !a.alias.toLowerCase().includes(s) &&
          !a.normalizedLocation.toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [filters]);

  const getClientName = (clientId: string) => {
    return mockClients.find((c) => c.id === clientId)?.name || '-';
  };

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

  const columns: Column<LocationAlias>[] = [
    {
      key: 'alias',
      header: t.aliases.alias,
      cell: (row) => <span className="font-mono font-medium">{row.alias}</span>,
    },
    {
      key: 'mapping',
      header: t.aliases.mapping,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{row.alias}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.normalizedLocation}</span>
        </div>
      ),
    },
    { key: 'client', header: t.common.client, cell: (row) => getClientName(row.clientId) },
    {
      key: 'active',
      header: t.common.status,
      cell: (row) =>
        row.active ? (
          <StatusBadge status="success" label={t.common.active} />
        ) : (
          <StatusBadge status="neutral" label={t.common.inactive} />
        ),
    },
    {
      key: 'updatedAt',
      header: t.common.updated,
      cell: (row) => format(new Date(row.updatedAt), 'dd/MM/yyyy', { locale: dateLocale }),
    },
    {
      key: 'actions',
      header: t.common.actions,
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

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
          { key: 'search', type: 'search', label: t.common.search, placeholder: t.aliases.searchPlaceholder },
          {
            key: 'clientId',
            type: 'select',
            label: t.common.client,
            options: mockClients.map((c) => ({ value: c.id, label: c.name })),
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
            <DialogTitle>{editingAlias ? t.aliases.editAlias : t.aliases.newAlias}</DialogTitle>
            <DialogDescription>
              {editingAlias ? t.aliases.editAlias : t.aliases.newAlias}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.common.client}</Label>
              <Select
                value={formData.clientId}
                onValueChange={(v) => setFormData({ ...formData, clientId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.remitentes.selectClient} />
                </SelectTrigger>
                <SelectContent>
                  {mockClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alias">{t.aliases.alias}</Label>
              <Input
                id="alias"
                value={formData.alias}
                onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                placeholder={t.aliases.aliasHint}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="normalized">{t.aliases.normalizedLocation}</Label>
              <Input
                id="normalized"
                value={formData.normalizedLocation}
                onChange={(e) => setFormData({ ...formData, normalizedLocation: e.target.value })}
                placeholder="ej. Madrid - Almacén Central"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t.common.active}</Label>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSave}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
