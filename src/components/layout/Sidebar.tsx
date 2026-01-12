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
import { useLanguage } from '@/contexts/LanguageContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  labelKey: 'dashboard' | 'orders' | 'dlq' | 'clients' | 'remitentes' | 'holidays' | 'locationAliases' | 'users';
  roles?: ('admin' | 'ops' | 'read')[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
  { to: '/orders', icon: FileText, labelKey: 'orders' },
  { to: '/dlq', icon: AlertTriangle, labelKey: 'dlq' },
  { to: '/masters/clients', icon: Building2, labelKey: 'clients', roles: ['admin'] },
  { to: '/masters/remitentes', icon: Package, labelKey: 'remitentes', roles: ['admin'] },
  { to: '/masters/holidays', icon: Settings, labelKey: 'holidays', roles: ['admin'] },
  { to: '/masters/aliases', icon: Settings, labelKey: 'locationAliases', roles: ['admin'] },
  { to: '/users', icon: Users, labelKey: 'users', roles: ['admin'] },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { hasRole } = useAuth();
  const { t } = useLanguage();

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
          const label = t.nav[item.labelKey];
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'nav-item',
                isActive ? 'nav-item-active' : 'nav-item-inactive',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
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
              <span>{t.nav.collapse}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
