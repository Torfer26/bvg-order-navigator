import React, { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { mockRemitentes, mockClients } from '@/lib/mockData';
import type { Remitente } from '@/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
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
    toast.success(editingRemitente ? 'Remitente aggiornato' : 'Remitente creato');
    setIsDialogOpen(false);
  };

  const columns: Column<Remitente>[] = [
    { key: 'email', header: 'Email', cell: (row) => <span className="font-medium">{row.email}</span> },
    { key: 'name', header: 'Nome', cell: (row) => row.name },
    { key: 'client', header: 'Cliente', cell: (row) => getClientName(row.clientId) },
    {
      key: 'active',
      header: 'Stato',
      cell: (row) =>
        row.active ? (
          <StatusBadge status="success" label="Attivo" />
        ) : (
          <StatusBadge status="neutral" label="Inattivo" />
        ),
    },
    {
      key: 'createdAt',
      header: 'Creato',
      cell: (row) => format(new Date(row.createdAt), 'dd/MM/yyyy', { locale: it }),
    },
    {
      key: 'actions',
      header: 'Azioni',
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
          <h1 className="page-title">Remitentes</h1>
          <p className="page-description">Gestisci gli indirizzi email mittenti autorizzati</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Remitente
        </Button>
      </div>

      <FilterBar
        filters={[
          { key: 'search', type: 'search', label: 'Cerca', placeholder: 'Cerca per email, nome...' },
          {
            key: 'clientId',
            type: 'select',
            label: 'Cliente',
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
        emptyMessage="Nessun remitente trovato"
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRemitente ? 'Modifica Remitente' : 'Nuovo Remitente'}</DialogTitle>
            <DialogDescription>
              {editingRemitente ? 'Modifica i dati del remitente' : 'Inserisci i dati del nuovo remitente'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={formData.clientId}
                onValueChange={(v) => setFormData({ ...formData, clientId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona cliente" />
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="ordini@esempio.it"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="es. Ufficio Ordini"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Attivo</Label>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
