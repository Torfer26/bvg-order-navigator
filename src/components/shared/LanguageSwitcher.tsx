import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/i18n/translations';
import { cn } from '@/lib/utils';

const flags: Record<Language, { emoji: string; label: string }> = {
  es: { emoji: '🇪🇸', label: 'Español' },
  it: { emoji: '🇮🇹', label: 'Italiano' },
};

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {(Object.keys(flags) as Language[]).map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={cn(
            'flex h-8 w-10 items-center justify-center rounded-md text-lg transition-all',
            language === lang
              ? 'bg-primary/10 shadow-sm'
              : 'hover:bg-muted opacity-60 hover:opacity-100'
          )}
          title={flags[lang].label}
          aria-label={flags[lang].label}
        >
          {flags[lang].emoji}
        </button>
      ))}
    </div>
  );
}
