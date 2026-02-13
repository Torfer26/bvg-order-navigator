import React, { useState, useMemo, useEffect } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  fetchCustomerEmails,
  fetchClients,
  addCustomerEmail,
  updateCustomerEmail,
  type CustomerEmail,
} from '@/lib/ordersService';
import { Plus, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { Client } from '@/types';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

type CustomerEmailRow = CustomerEmail & { customerName?: string };

export default function CustomerEmails() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;

  const [items, setItems] = useState<CustomerEmailRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ customerId: '', email: '' });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [emailsData, clientsData] = await Promise.all([
        fetchCustomerEmails(),
        fetchClients(),
      ]);
      const clientMap = new Map<string, string>(
        clientsData.map((c) => [c.id, c.name || c.code || c.id])
      );
      const rows: CustomerEmailRow[] = emailsData.map((ce) => ({
        ...ce,
        customerName: clientMap.get(ce.customerId) || ce.customerId,
      }));
      setItems(rows);
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading customer emails:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(
      (row) =>
        row.email?.toLowerCase().includes(s) ||
        row.customerName?.toLowerCase().includes(s) ||
        row.customerId?.toLowerCase().includes(s)
    );
  }, [search, items]);

  const openNew = () => {
    setFormData({ customerId: '', email: '' });
    setIsDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!formData.customerId || !formData.email?.trim()) {
      toast.error('Selecciona un cliente e introduce un email');
      return;
    }
    setSaving(true);
    try {
      const result = await addCustomerEmail(formData.customerId, formData.email.trim());
      if (result.success) {
        toast.success(result.message);
        setIsDialogOpen(false);
        loadData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al añadir asociación');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row: CustomerEmailRow) => {
    const newActive = !row.active;
    try {
      const result = await updateCustomerEmail(row.id, { active: newActive });
      if (result.success) {
        setItems((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, active: newActive } : r))
        );
        toast.success(newActive ? 'Email activado' : 'Email desactivado');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const columns: Column<CustomerEmailRow>[] = [
    {
      key: 'customerName',
      header: 'Cliente',
      cell: (row) => (
        <span className="font-medium">{row.customerName || row.customerId}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      cell: (row) => (
        <span className="font-mono text-sm">{row.email}</span>
      ),
    },
    {
      key: 'emailType',
      header: 'Tipo',
      cell: (row) => row.emailType || 'PRIMARY',
    },
    {
      key: 'active',
      header: 'Activo',
      cell: (row) => (
        <Switch
          checked={row.active}
          onCheckedChange={() => handleToggleActive(row)}
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Creado',
      cell: (row) =>
        row.createdAt
          ? format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm', { locale: dateLocale })
          : '-',
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
          <h1 className="page-title">Clientes y correos asociados</h1>
          <p className="page-description">
            Gestiona la asociación entre clientes y direcciones de email para la resolución automática de pedidos.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir asociación
        </Button>
      </div>

      <FilterBar
        filters={[
          {
            key: 'search',
            type: 'search',
            label: t.common.search,
            placeholder: 'Buscar por cliente o email...',
          },
        ]}
        values={{ search }}
        onChange={(_, value) => setSearch(value || '')}
        onClear={() => setSearch('')}
      />

      <DataTable
        columns={columns}
        data={filteredItems}
        keyExtractor={(row) => row.id}
        emptyMessage="No hay asociaciones cliente-email. Añade una para que los pedidos se asignen automáticamente."
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir email a cliente</DialogTitle>
            <DialogDescription>
              Asocia una dirección de email a un cliente. Los pedidos recibidos desde este email se asignarán automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Cliente</Label>
              <Select
                value={formData.customerId}
                onValueChange={(v) => setFormData({ ...formData, customerId: v })}
              >
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name || c.code || c.id}
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
                placeholder="pedidos@cliente.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? ' Guardando...' : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
