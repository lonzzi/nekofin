import { createContext, useContext } from 'react';

export const TabletSidebarContext = createContext<{
  isCollapsed: boolean;
  showSidebar: () => void;
} | null>(null);

export function useTabletSidebar() {
  return useContext(TabletSidebarContext);
}
