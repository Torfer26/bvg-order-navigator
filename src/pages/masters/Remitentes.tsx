import React, { useState, useMemo, useEffect } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { fetchRemitentes } from '@/lib/ordersService';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Remitente } from '@/types';
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
  
  const [remitentes, setRemitentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ search?: string; type?: string }>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRemitente, setEditingRemitente] = useState<Remitente | null>(null);
  const [formData, setFormData] = useState({ clientId: '', email: '', name: '', active: true });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const remitentesData = await fetchRemitentes();
        setRemitentes(remitentesData);
      } catch (error) {
        console.error('Error loading remitentes:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredRemitentes = useMemo(() => {
    return remitentes.filter((r) => {
      if (filters.type && r.type !== filters.type) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (
          !r.code?.toLowerCase().includes(s) && 
          !r.name?.toLowerCase().includes(s) &&
          !r.location?.toLowerCase().includes(s) &&
          !r.address?.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [filters, remitentes]);

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

  const columns: Column<any>[] = [
    { key: 'code', header: 'Código', cell: (row) => <span className="font-medium">{row.code}</span> },
    { key: 'name', header: 'Nombre', cell: (row) => row.name },
    { key: 'type', header: 'Tipo', cell: (row) => row.type || '-' },
    { key: 'location', header: 'Localización', cell: (row) => `${row.location || ''} ${row.district ? `(${row.district})` : ''}`.trim() || '-' },
    { key: 'address', header: 'Dirección', cell: (row) => row.address || '-' },
    { key: 'country', header: 'País', cell: (row) => row.country || '-' },
    {
      key: 'createdAt',
      header: 'Importado',
      cell: (row) => row.createdAt ? format(new Date(row.createdAt), 'dd/MM/yyyy', { locale: dateLocale }) : '-',
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
          { key: 'search', type: 'search', label: t.common.search, placeholder: 'Buscar por código, nombre, localización...' },
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
