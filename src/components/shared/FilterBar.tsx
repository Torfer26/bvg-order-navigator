import React from 'react';
import { Search, X, CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  type: 'select' | 'date' | 'search';
  label: string;
  placeholder?: string;
  options?: FilterOption[];
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string | undefined>;
  onChange: (key: string, value: string | undefined) => void;
  onClear: () => void;
}

export function FilterBar({ filters, values, onChange, onClear }: FilterBarProps) {
  const { t, language } = useLanguage();
  const hasActiveFilters = Object.values(values).some((v) => v !== undefined && v !== '');
  const dateLocale = language === 'es' ? es : it;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
      {filters.map((filter) => {
        if (filter.type === 'search') {
          return (
            <div key={filter.key} className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={filter.placeholder || `${t.common.search}...`}
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value || undefined)}
                className="pl-9"
              />
            </div>
          );
        }

        if (filter.type === 'select' && filter.options) {
          return (
            <Select
              key={filter.key}
              value={values[filter.key] || 'all'}
              onValueChange={(v) => onChange(filter.key, v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all}</SelectItem>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        if (filter.type === 'date') {
          const dateValue = values[filter.key] ? new Date(values[filter.key]!) : undefined;
          return (
            <Popover key={filter.key}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[180px] justify-start text-left font-normal',
                    !dateValue && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateValue ? format(dateValue, 'dd/MM/yyyy', { locale: dateLocale }) : filter.label}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateValue}
                  onSelect={(date) => onChange(filter.key, date?.toISOString())}
                  locale={dateLocale}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          );
        }

        return null;
      })}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5">
          <X className="h-4 w-4" />
          {t.common.clearFilters}
        </Button>
      )}
    </div>
  );
}
