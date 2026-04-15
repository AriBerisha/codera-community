"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { brand } from "@/lib/brand";

interface MobileLayoutContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  convListOpen: boolean;
  setConvListOpen: (open: boolean) => void;
}

const MobileLayoutContext = createContext<MobileLayoutContextValue>({
  sidebarOpen: false,
  setSidebarOpen: () => {},
  convListOpen: false,
  setConvListOpen: () => {},
});

export function useMobileLayout() {
  return useContext(MobileLayoutContext);
}

export function MobileLayout({
  userRole,
  userName,
  userEmail,
  children,
}: {
  userRole: string;
  userName: string | null | undefined;
  userEmail: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [convListOpen, setConvListOpen] = useState(false);
  const pathname = usePathname();

  // Close drawers on navigation
  useEffect(() => {
    setSidebarOpen(false);
    setConvListOpen(false);
  }, [pathname]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <MobileLayoutContext.Provider value={{ sidebarOpen, setSidebarOpen, convListOpen, setConvListOpen }}>
      <div className="flex h-screen overflow-hidden bg-[#0d1117]">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar userRole={userRole} userName={userName} userEmail={userEmail} />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSidebar} />
            <div className="absolute left-0 top-0 h-full w-[220px] shadow-2xl shadow-black/50">
              <Sidebar userRole={userRole} userName={userName} userEmail={userEmail} forceExpanded />
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto flex flex-col min-w-0">
          {/* Mobile top bar */}
          <div className="flex md:hidden items-center gap-3 px-3 py-2 border-b border-[#21262d] bg-[#0d1117] shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md hover:bg-[#21262d] text-[#7d8590] hover:text-[#c9d1d9] transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <img src={brand.logo} alt={brand.name} className="h-6 object-contain" />
          </div>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </MobileLayoutContext.Provider>
  );
}
