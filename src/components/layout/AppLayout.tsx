import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sidebar } from './Sidebar';
import { SidebarNavContent } from './SidebarNavContent';
import { Header } from './Header';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Mobile sidebar drawer */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="w-[var(--sidebar-width)] max-w-[85vw] p-0 gap-0 flex flex-col bg-sidebar border-sidebar-border [&>button]:text-sidebar-foreground [&>button]:right-4 [&>button]:top-4"
            aria-label="Menú de navegación"
          >
            <div className="flex flex-col h-full w-full">
              <SidebarNavContent
                isDrawer
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header
          onMenuClick={isMobile ? () => setSidebarOpen(true) : undefined}
          isMenuOpen={isMobile ? sidebarOpen : undefined}
        />
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
