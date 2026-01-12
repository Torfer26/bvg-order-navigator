import React, { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { mockRemitentes, mockClients } from '@/lib/mockData';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Remitente } from '@/types';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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

export default function Remitentes() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;
  
  const [filters, setFilters] = useState<{ search?: string; clientId?: string }>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRemitente, setEditingRemitente] = useState<Remitente | null>(null);
  const [formData, setFormData] = useState({ clientId: '', email: '', name: '', active: true });

  const filteredRemitentes = useMemo(() => {
    return mockRemitentes.filter((r) => {
      if (filters.clientId && r.clientId !== filters.clientId) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.email.toLowerCase().includes(s) && !r.name.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [filters]);

  const getClientName = (clientId: string) => {
    return mockClients.find((c) => c.id === clientId)?.name || '-';
  };

  const openNew = () => {
    setEditingRemitente(null);
    setFormData({ clientId: '', email: '', name: '', active: true });
    setIsDialogOpen(true);
  };

  const openEdit = (remitente: Remitente) => {
    setEditingRemitente(remitente);
    setFormData({
      clientId: remitente.clientId,
      email: remitente.email,
      name: remitente.name,
      active: remitente.active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    toast.success(editingRemitente ? t.remitentes.remitenteUpdated : t.remitentes.remitenteCreated);
    setIsDialogOpen(false);
  };

  const columns: Column<Remitente>[] = [
    { key: 'email', header: t.common.email, cell: (row) => <span className="font-medium">{row.email}</span> },
    { key: 'name', header: t.common.name, cell: (row) => row.name },
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
      key: 'createdAt',
      header: t.common.created,
      cell: (row) => format(new Date(row.createdAt), 'dd/MM/yyyy', { locale: dateLocale }),
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
          <h1 className="page-title">{t.remitentes.title}</h1>
          <p className="page-description">{t.remitentes.subtitle}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t.remitentes.newRemitente}
        </Button>
      </div>

      <FilterBar
        filters={[
          { key: 'search', type: 'search', label: t.common.search, placeholder: t.remitentes.searchPlaceholder },
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
        data={filteredRemitentes}
        keyExtractor={(row) => row.id}
        emptyMessage={t.remitentes.noRemitentesFound}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRemitente ? t.remitentes.editRemitente : t.remitentes.newRemitente}</DialogTitle>
            <DialogDescription>
              {editingRemitente ? t.remitentes.editRemitente : t.remitentes.newRemitente}
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
              <Label htmlFor="email">{t.common.email}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="pedidos@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t.common.name}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t.remitentes.office}
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
