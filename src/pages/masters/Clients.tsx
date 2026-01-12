import React, { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { mockClients } from '@/lib/mockData';
import type { Client } from '@/types';
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
import { toast } from 'sonner';

export default function Clients() {
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', email: '', active: true });

  const filteredClients = useMemo(() => {
    if (!search) return mockClients;
    const s = search.toLowerCase();
    return mockClients.filter(
      (c) =>
        c.code.toLowerCase().includes(s) ||
        c.name.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s)
    );
  }, [search]);

  const openNew = () => {
    setEditingClient(null);
    setFormData({ code: '', name: '', email: '', active: true });
    setIsDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      code: client.code,
      name: client.name,
      email: client.email || '',
      active: client.active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (editingClient) {
      toast.success(`Cliente ${formData.name} aggiornato`);
    } else {
      toast.success(`Cliente ${formData.name} creato`);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (client: Client) => {
    toast.success(`Cliente ${client.name} eliminato`);
  };

  const columns: Column<Client>[] = [
    {
      key: 'code',
      header: 'Codice',
      cell: (row) => <span className="font-mono font-medium">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Nome',
      cell: (row) => row.name,
    },
    {
      key: 'email',
      header: 'Email',
      cell: (row) => row.email || '-',
    },
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
      key: 'updatedAt',
      header: 'Ultimo Aggiornamento',
      cell: (row) => format(new Date(row.updatedAt), 'dd/MM/yyyy', { locale: it }),
    },
    {
      key: 'actions',
      header: 'Azioni',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => handleDelete(row)}
          >
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
          <h1 className="page-title">Clienti</h1>
          <p className="page-description">Gestisci l'anagrafica clienti</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Cliente
        </Button>
      </div>

      <FilterBar
        filters={[{ key: 'search', type: 'search', label: 'Cerca', placeholder: 'Cerca per codice, nome, email...' }]}
        values={{ search }}
        onChange={(_, value) => setSearch(value || '')}
        onClear={() => setSearch('')}
      />

      <DataTable
        columns={columns}
        data={filteredClients}
        keyExtractor={(row) => row.id}
        emptyMessage="Nessun cliente trovato"
      />

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Modifica Cliente' : 'Nuovo Cliente'}</DialogTitle>
            <DialogDescription>
              {editingClient
                ? 'Modifica i dati del cliente'
                : 'Inserisci i dati del nuovo cliente'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Codice</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="es. METRO"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="es. Metro S.p.A."
              />
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
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Attivo</Label>
              <Switch
                id="active"
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
