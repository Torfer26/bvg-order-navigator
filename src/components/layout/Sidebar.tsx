import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  AlertTriangle, 
  Building2, 
  Users, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles?: ('admin' | 'ops' | 'read')[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/orders', icon: FileText, label: 'Ordini Intake' },
  { to: '/dlq', icon: AlertTriangle, label: 'DLQ' },
  { to: '/masters/clients', icon: Building2, label: 'Clienti', roles: ['admin'] },
  { to: '/masters/remitentes', icon: Package, label: 'Remitentes', roles: ['admin'] },
  { to: '/masters/holidays', icon: Settings, label: 'Festività', roles: ['admin'] },
  { to: '/masters/aliases', icon: Settings, label: 'Alias Località', roles: ['admin'] },
  { to: '/users', icon: Users, label: 'Utenti', roles: ['admin'] },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { hasRole } = useAuth();

  const filteredItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return hasRole(item.roles);
  });

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
      )}
    >
      {/* Logo */}
      <div className="flex h-header items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <span className="text-sm font-bold text-sidebar-primary-foreground">BV</span>
            </div>
            <span className="text-base font-semibold text-sidebar-foreground">BVG Ops</span>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary mx-auto">
            <span className="text-sm font-bold text-sidebar-primary-foreground">BV</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'nav-item',
                isActive ? 'nav-item-active' : 'nav-item-inactive',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={onToggle}
          className={cn(
            'nav-item nav-item-inactive w-full',
            collapsed && 'justify-center px-2'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span>Comprimi</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
