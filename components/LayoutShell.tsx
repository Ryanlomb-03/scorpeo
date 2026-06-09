"use client";

import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import LoginModal from "@/components/LoginModal";
import { useSidebar } from "@/context/SidebarContext";
import { AnimatePresence, motion } from "framer-motion";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const { showLogin, setShowLogin } = useAuth();
  const { isMobile, isSidebarOpen, setIsSidebarOpen, hydrated } = useSidebar();

  return (
    <div className="flex h-[100dvh] overflow-hidden relative">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {hydrated && isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <Sidebar onLoginClick={() => setShowLogin(true)} />
      
      <div className="flex-1 flex flex-col min-h-0 bg-neutral-900 w-full">
        {children}
      </div>
      
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
