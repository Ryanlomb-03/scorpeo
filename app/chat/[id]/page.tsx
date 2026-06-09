"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import MessageBubble from "@/components/MessageBubble";
import ChatInput from "@/components/ChatInput";
import Sidebar from "@/components/Sidebar";
import LoginModal from "@/components/LoginModal";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const { selectConversation, loading, messages, sendMessage, currentConversation, resetChat, isSending } = useChat();
  const { user } = useAuth();
  const { isMobile, setIsSidebarOpen } = useSidebar();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadedConversationRef = useRef<string | null>(null);

  // Update browser tab title based on conversation title
  useEffect(() => {
    if (currentConversation?.title) {
      document.title = currentConversation.title;
    } else {
      document.title = "Scorpio";
    }
  }, [currentConversation?.title]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to home if no valid conversation id
  useEffect(() => {
    if (mounted && (!params.id || params.id === 'favicon.ico')) {
      resetChat();
      router.replace('/');
    }
  }, [mounted, params.id, router, resetChat]);

  // Only load conversation once when id changes, OR when user becomes available
  useEffect(() => {
    const id = params.id as string;
    if (!mounted || !id || id === 'favicon.ico') return;
    if (!user) {
      // User not loaded yet — clear ref so we retry when user arrives
      loadedConversationRef.current = null;
      return;
    }
    if (id === loadedConversationRef.current) return;
    // Skip if already viewing this conversation with messages
    if (currentConversation?.id === id && messages.length > 0) {
      loadedConversationRef.current = id;
      return;
    }
    loadedConversationRef.current = id;
    selectConversation(id);
  }, [params.id, mounted, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  return (
    <>
      <div className="p-3 sm:p-4 flex items-center gap-3 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.5)] z-20 relative bg-neutral-900">
        {isMobile && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            disabled={!mounted || loading}
            className={`p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors ${(!mounted || loading) ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        )}
        <h1 className="text-white text-lg font-semibold" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
          Scorpio
        </h1>
      </div>
      <div className="flex-1 flex flex-col min-h-0 w-full max-w-full">
        {(!mounted || loading) ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="spinner-loader">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} />
              ))}
            </div>
          </div>
        ) : messages.length > 0 ? (
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 pt-4 pb-24 scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-transparent relative w-full">
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-neutral-900 to-transparent pointer-events-none z-10" />
            <div className="max-w-3xl mx-auto space-y-4 w-full">
              {messages.map((msg) => (
                <MessageBubble 
                  key={msg.id}
                  role={msg.role} 
                  content={msg.content} 
                  isLoading={msg.isLoading}
                  loadingPhase={msg.loadingPhase}
                  messageId={msg.id}
                  userId={user?.uid}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="w-full max-w-3xl mx-auto px-0 sm:px-6 pb-4 bg-neutral-900 relative z-20">
          <ChatInput onSend={handleSendMessage} isAIThinking={isSending} position="bottom" />
        </div>
      </div>
      <div className="p-4 text-center border-t border-neutral-800">
        <p className="text-xs text-gray-500">
          <a href="/terms" className="hover:underline">Scorpio Terms</a>
          <span className="mx-1">and</span>
          <a href="/privacy" className="hover:underline">Privacy Policy</a>
          <span className="mx-1">apply.</span>
          <span>Scorpio is AI and can make mistakes.</span>
        </p>
      </div>
    </>
  );
}
