"use client";

import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import LoginModal from "@/components/LoginModal";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const { showLogin, setShowLogin } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onLoginClick={() => setShowLogin(true)} />
      <div className="flex-1 flex flex-col min-h-0 bg-neutral-900">
        {children}
      </div>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
