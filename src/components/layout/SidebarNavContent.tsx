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
  Package,
  Mail,
  GitBranch,
  Activity,
  BarChart3,
  UserX,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles?: ('admin' | 'ops' | 'read')[];
  section?: string;
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/orders', icon: FileText, label: 'Pedidos' },
  { to: '/dlq', icon: AlertTriangle, label: 'DLQ' },
  { to: '/analytics', icon: BarChart3, label: 'Analítica', section: 'analytics' },
  { to: '/monitoring/emails', icon: Mail, label: 'Emails', section: 'monitoring' },
  { to: '/monitoring/unknown-clients', icon: UserX, label: 'Clientes sin asignar', roles: ['admin', 'ops'], section: 'monitoring' },
  { to: '/monitoring/logs', icon: GitBranch, label: 'Logs & Trazabilidad', section: 'monitoring' },
  { to: '/monitoring/extraction-evaluation', icon: Sparkles, label: 'Evaluación Extracción', roles: ['admin', 'ops'], section: 'monitoring' },
  { to: '/masters/clients', icon: Building2, label: 'Clientes', roles: ['admin'], section: 'masters' },
  { to: '/masters/customer-emails', icon: Mail, label: 'Clientes y correos', roles: ['admin', 'ops'], section: 'masters' },
  { to: '/masters/remitentes', icon: Package, label: 'Remitentes', roles: ['admin'], section: 'masters' },
  { to: '/masters/holidays', icon: Settings, label: 'Festivos', roles: ['admin'], section: 'masters' },
  { to: '/masters/aliases', icon: Settings, label: 'Alias Localizaciones', roles: ['admin'], section: 'masters' },
  { to: '/users', icon: Users, label: 'Usuarios', roles: ['admin'] },
];

export interface SidebarNavContentProps {
  collapsed?: boolean;
  onToggle?: () => void;
  /** When provided (e.g. in mobile drawer), close is shown instead of collapse; nav links call this on click */
  onClose?: () => void;
  /** When true, renders for mobile drawer (always expanded, no collapse) */
  isDrawer?: boolean;
}

export function SidebarNavContent({ collapsed = false, onToggle, onClose, isDrawer = false }: SidebarNavContentProps) {
  const location = useLocation();
  const { hasRole } = useAuth();
  const { t } = useLanguage();

  const filteredItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return hasRole(item.roles);
  });

  const handleNavClick = () => {
    if (isDrawer && onClose) onClose();
  };

  const NavItemView = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    return (
      <NavLink
        to={item.to}
        onClick={handleNavClick}
        className={({ isActive }) =>
          cn(
            'nav-item',
            isActive ? 'nav-item-active' : 'nav-item-inactive',
            !isDrawer && collapsed && 'justify-center px-2'
          )
        }
        title={collapsed && !isDrawer ? item.label : undefined}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        {(!collapsed || isDrawer) && <span>{item.label}</span>}
      </NavLink>
    );
  };

  return (
    <>
      {/* Logo */}
      <div className="flex h-header items-center justify-between border-b border-sidebar-border px-4">
        {(!collapsed || isDrawer) && (
          <div className="flex items-center gap-3">
            <img
              src="/Brivio-vigano-logo.png"
              alt="Brivio & Viganò"
              className="h-10 w-auto object-contain"
            />
            <span className="text-base font-semibold text-sidebar-foreground">BVG Ops</span>
          </div>
        )}
        {!isDrawer && collapsed && (
          <img
            src="/Brivio-vigano-logo.png"
            alt="BV"
            className="h-8 w-8 object-contain mx-auto"
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navegación principal">
        <div className="space-y-1">
          {filteredItems.filter((item) => !item.section).map((item) => (
            <NavItemView key={item.to} item={item} />
          ))}
        </div>

        {(!collapsed || isDrawer) && (
          <div className="mt-6 mb-2 px-3 text-xs font-semibold text-sidebar-foreground/70">ANALÍTICA</div>
        )}
        <div className="space-y-1">
          {filteredItems.filter((item) => item.section === 'analytics').map((item) => (
            <NavItemView key={item.to} item={item} />
          ))}
        </div>

        {(!collapsed || isDrawer) && (
          <div className="mt-6 mb-2 px-3 text-xs font-semibold text-sidebar-foreground/70">MONITORIZACIÓN</div>
        )}
        <div className="space-y-1">
          {filteredItems.filter((item) => item.section === 'monitoring').map((item) => (
            <NavItemView key={item.to} item={item} />
          ))}
        </div>

        {(!collapsed || isDrawer) && (
          <div className="mt-6 mb-2 px-3 text-xs font-semibold text-sidebar-foreground/70">MAESTROS</div>
        )}
        <div className="space-y-1">
          {filteredItems.filter((item) => item.section === 'masters').map((item) => (
            <NavItemView key={item.to} item={item} />
          ))}
        </div>
      </nav>

      {/* Footer: Collapse (desktop) or Close (drawer) */}
      <div className="border-t border-sidebar-border p-3">
        {isDrawer && onClose ? (
          <Button
            variant="ghost"
            className="nav-item nav-item-inactive w-full justify-start"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5 shrink-0" />
            <span>Cerrar</span>
          </Button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'nav-item nav-item-inactive w-full',
              collapsed && 'justify-center px-2'
            )}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" aria-hidden />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" aria-hidden />
                <span>{t.nav.collapse}</span>
              </>
            )}
          </button>
        )}
      </div>
    </>
  );
}
