import React, { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { mockHolidays } from '@/lib/mockData';
import { useLanguage, interpolate } from '@/contexts/LanguageContext';
import type { Holiday } from '@/types';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
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
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;
  
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
    toast.success(editingHoliday ? t.holidays.holidayUpdated : t.holidays.holidayCreated);
    setIsDialogOpen(false);
  };

  const handleDelete = (holiday: Holiday) => {
    toast.success(interpolate(t.holidays.holidayDeleted, { name: holiday.name }));
  };

  const columns: Column<Holiday>[] = [
    {
      key: 'date',
      header: t.common.date,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {format(new Date(row.date), 'dd MMMM yyyy', { locale: dateLocale })}
          </span>
        </div>
      ),
    },
    { key: 'name', header: t.common.name, cell: (row) => row.name },
    { key: 'region', header: t.holidays.region, cell: (row) => row.region || t.holidays.national },
    {
      key: 'actions',
      header: t.common.actions,
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
          <h1 className="page-title">{t.holidays.title}</h1>
          <p className="page-description">{t.holidays.subtitle}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t.holidays.newHoliday}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={sortedHolidays}
        keyExtractor={(row) => row.id}
        emptyMessage={t.holidays.noHolidaysFound}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHoliday ? t.holidays.editHoliday : t.holidays.newHoliday}</DialogTitle>
            <DialogDescription>
              {editingHoliday ? t.holidays.editHoliday : t.holidays.newHoliday}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.common.date}</Label>
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
                      ? format(formData.date, 'dd MMMM yyyy', { locale: dateLocale })
                      : t.holidays.selectDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => date && setFormData({ ...formData, date })}
                    locale={dateLocale}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{t.common.name}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ej. Navidad"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">{t.holidays.region} (opcional)</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder={t.holidays.regionOptional}
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
