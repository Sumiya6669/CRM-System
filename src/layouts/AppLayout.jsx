import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '@/layouts/Sidebar';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileSidebarOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  const layoutValue = useMemo(
    () => ({
      isMobileSidebarOpen: mobileSidebarOpen,
      openMobileSidebar: () => setMobileSidebarOpen(true),
      closeMobileSidebar: () => setMobileSidebarOpen(false),
    }),
    [mobileSidebarOpen]
  );

  return (
    <LayoutProvider value={layoutValue}>
      <div className="min-h-screen overflow-x-hidden bg-background">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          onToggle={() => setCollapsed(!collapsed)}
        />
      <main
        className={cn(
          'min-h-screen min-w-0 transition-all duration-300',
          collapsed ? 'lg:ml-[68px]' : 'lg:ml-[240px]'
        )}
      >
        <Outlet />
      </main>
      </div>
    </LayoutProvider>
  );
}
