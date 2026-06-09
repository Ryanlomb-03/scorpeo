"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  isMobile: boolean;
  hydrated: boolean;
  closeSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Start closed to prevent flash — will open on desktop after hydration
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const mobile = window.innerWidth <= 768;
    setIsMobile(mobile);
    setIsSidebarOpen(!mobile); // Open on desktop, closed on mobile
    setHydrated(true);

    const handleResize = () => {
      const nowMobile = window.innerWidth <= 768;
      setIsMobile(nowMobile);
      if (nowMobile) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const closeSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen, isMobile, hydrated, closeSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
