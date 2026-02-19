import React from 'react';
import { cn } from '@/lib/utils';
import { SidebarNavContent } from './SidebarNavContent';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
      )}
      aria-label="Barra de navegación"
    >
      <SidebarNavContent collapsed={collapsed} onToggle={onToggle} isDrawer={false} />
    </aside>
  );
}
