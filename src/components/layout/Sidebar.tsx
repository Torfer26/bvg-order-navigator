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
  UserX
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
  { to: '/masters/clients', icon: Building2, label: 'Clientes', roles: ['admin'], section: 'masters' },
  { to: '/masters/remitentes', icon: Package, label: 'Remitentes', roles: ['admin'], section: 'masters' },
  { to: '/masters/holidays', icon: Settings, label: 'Festivos', roles: ['admin'], section: 'masters' },
  { to: '/masters/aliases', icon: Settings, label: 'Alias Localizaciones', roles: ['admin'], section: 'masters' },
  { to: '/users', icon: Users, label: 'Usuarios', roles: ['admin'] },
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
          <div className="flex items-center gap-3">
            <img 
              src="/Brivio-vigano-logo.png" 
              alt="Brivio & Viganò" 
              className="h-10 w-auto object-contain"
            />
            <span className="text-base font-semibold text-sidebar-foreground">BVG Ops</span>
          </div>
        )}
        {collapsed && (
          <img 
            src="/Brivio-vigano-logo.png" 
            alt="BV" 
            className="h-8 w-8 object-contain mx-auto"
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {/* Main Navigation */}
        <div className="space-y-1">
          {filteredItems.filter((item) => !item.section).map((item) => {
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
        </div>
        
        {/* Analytics Section */}
        {!collapsed && <div className="mt-6 mb-2 px-3 text-xs font-semibold text-muted-foreground">ANALÍTICA</div>}
        <div className="space-y-1">
          {filteredItems.filter((item) => item.section === 'analytics').map((item) => {
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
        </div>
        
        {/* Monitoring Section */}
        {!collapsed && <div className="mt-6 mb-2 px-3 text-xs font-semibold text-muted-foreground">MONITORIZACIÓN</div>}
        <div className="space-y-1">
          {filteredItems.filter((item) => item.section === 'monitoring').map((item) => {
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
        </div>
        
        {/* Masters Section */}
        {!collapsed && <div className="mt-6 mb-2 px-3 text-xs font-semibold text-muted-foreground">MAESTROS</div>}
        <div className="space-y-1">
          {filteredItems.filter((item) => item.section === 'masters').map((item) => {
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
        </div>
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
