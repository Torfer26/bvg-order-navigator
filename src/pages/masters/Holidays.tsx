import React, { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { mockHolidays } from '@/lib/mockData';
import type { Holiday } from '@/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Plus, Pencil, Trash2, CalendarDays } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Holidays() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState({ date: new Date(), name: '', region: '' });

  const sortedHolidays = useMemo(() => {
    return [...mockHolidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, []);

  const openNew = () => {
    setEditingHoliday(null);
    setFormData({ date: new Date(), name: '', region: '' });
    setIsDialogOpen(true);
  };

  const openEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      date: new Date(holiday.date),
      name: holiday.name,
      region: holiday.region || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    toast.success(editingHoliday ? 'Festività aggiornata' : 'Festività creata');
    setIsDialogOpen(false);
  };

  const handleDelete = (holiday: Holiday) => {
    toast.success(`Festività "${holiday.name}" eliminata`);
  };

  const columns: Column<Holiday>[] = [
    {
      key: 'date',
      header: 'Data',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {format(new Date(row.date), 'dd MMMM yyyy', { locale: it })}
          </span>
        </div>
      ),
    },
    { key: 'name', header: 'Nome', cell: (row) => row.name },
    { key: 'region', header: 'Regione', cell: (row) => row.region || 'Nazionale' },
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
          <h1 className="page-title">Festività</h1>
          <p className="page-description">Gestisci il calendario delle festività</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nuova Festività
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={sortedHolidays}
        keyExtractor={(row) => row.id}
        emptyMessage="Nessuna festività configurata"
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHoliday ? 'Modifica Festività' : 'Nuova Festività'}</DialogTitle>
            <DialogDescription>
              {editingHoliday
                ? 'Modifica i dati della festività'
                : 'Inserisci i dati della nuova festività'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !formData.date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {formData.date
                      ? format(formData.date, 'dd MMMM yyyy', { locale: it })
                      : 'Seleziona data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => date && setFormData({ ...formData, date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="es. Pasquetta"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Regione (opzionale)</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="es. Lombardia (lasciare vuoto per nazionale)"
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
