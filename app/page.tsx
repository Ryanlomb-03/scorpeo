"use client";

import ChatWindow from "@/components/ChatWindow";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { setShowLogin } = useAuth();

  return (
    <ChatWindow onLoginClick={() => setShowLogin(true)} />
  );
}
