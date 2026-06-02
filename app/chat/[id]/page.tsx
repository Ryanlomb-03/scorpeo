"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChat } from "@/context/ChatContext";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadedConversationRef = useRef<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef<Record<string, boolean>>({});

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

  // Only load conversation once when id changes
  useEffect(() => {
    const id = params.id as string;
    if (mounted && id && id !== 'favicon.ico' && id !== loadedConversationRef.current) {
      // Skip if already viewing this conversation with messages
      if (currentConversation?.id === id && messages.length > 0) {
        loadedConversationRef.current = id;
        return;
      }
      loadedConversationRef.current = id;
      selectConversation(id);
    }
  }, [params.id, mounted]);

  // Trigger .popup-enter { animation: popup-enter 0.3s ease-out; }first appear for a conversation (including cached)
  useEffect(() => {
    const convId = currentConversation?.id;
    if (convId && messages.length > 0 && popupRef.current && !hasAnimatedRef.current[convId]) {
      popupRef.current.classList.add('popup-enter');
      hasAnimatedRef.current[convId] = true;
    }
  }, [messages, currentConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="spinner-loader">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4">
        <h1 className="text-white text-lg font-semibold" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
          Scorpio
        </h1>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="spinner-loader">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} />
              ))}
            </div>
          </div>
        ) : messages.length > 0 ? (
          <div ref={popupRef} className="flex-1 overflow-y-auto px-6 pt-4 pb-24 scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-transparent relative">
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-neutral-900 to-transparent pointer-events-none z-10" />
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg) => (
                <MessageBubble 
                  key={msg.id}
                  role={msg.role} 
                  content={msg.content} 
                  isLoading={msg.isLoading}
                  loadingPhase={msg.loadingPhase}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="w-full max-w-3xl mx-auto px-6 pb-4 bg-neutral-900 relative z-20">
          <ChatInput onSend={handleSendMessage} isAIThinking={isSending} />
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
