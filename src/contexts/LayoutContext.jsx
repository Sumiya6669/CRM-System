import { createContext, useContext } from 'react';

const LayoutContext = createContext({
  isMobileSidebarOpen: false,
  openMobileSidebar: () => {},
  closeMobileSidebar: () => {},
});

export const LayoutProvider = LayoutContext.Provider;

export const useLayout = () => useContext(LayoutContext);
