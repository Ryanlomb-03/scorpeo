"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import SearchChats from "@/components/SearchChats";
import LoginModal from "@/components/LoginModal";

export default function SearchPage() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="flex h-screen">
      <Sidebar onLoginClick={() => setShowLogin(true)} />
      <SearchChats />
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}