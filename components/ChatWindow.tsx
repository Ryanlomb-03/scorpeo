"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ChatInput from "./ChatInput";
import MessageBubble from "./MessageBubble";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";

const greetings = [
  "Hi, I'm Scorpio. Ask carefully — I don't miss details.",
  "I'm Scorpio. Fast mind, sharper answers.",
  "You don't need perfect questions. Just ask.",
  "Precision over noise. Let's begin.",
  "Built to think. Ready to answer.",
  "Hi, I'm Scorpio… it stings me to speak.",
  "Careful. My answers tend to hit exactly where needed.",
  "Ask anything. I'll strike straight to the point.",
  "Not everything needs a long answer. Just the right one.",
  "Sharp questions get sharper answers.",
  "Think deeper. I'll meet you there.",
  "Complex or simple — I'll break it down.",
  "Let's turn confusion into clarity.",
  "Ideas start here. Precision finishes them.",
  "Ask hard things. That's where I shine.",
  "Search, think, create — all in one place.",
  "Your questions, upgraded.",
  "From idea to answer in seconds.",
  "More than chat. This is thinking.",
  "Fast when you need it. Deep when it matters.",
  "Ask anything.",
  "Start typing…",
  "What do you want to know?",
  "Let's begin.",
  "Go ahead.",
  "What's on your mind?",
  "Ready to chat",
  "Let's talk",
  "Your turn to speak",
];

function Typewriter({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index <= text.length) {
        setDisplayedText(text.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [text]);

  return <span>{displayedText}</span>;
}

export default function ChatWindow({ onLoginClick }: { onLoginClick?: () => void }) {
  const [greeting, setGreeting] = useState("");
  const [showChat, setShowChat] = useState(false);
  const { messages, sendMessage, currentConversation, pendingConversationId, isSending, loading, retryMessage, updateMessageVersion } = useChat();
  const { user } = useAuth();
  const { isMobile, setIsSidebarOpen } = useSidebar();
  const router = useRouter();

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * greetings.length);
    setGreeting(greetings[randomIndex]);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setShowChat(true);
    } else {
      setShowChat(false);
    }
  }, [messages]);

  // Reset showChat when currentConversation is cleared (new chat)
  useEffect(() => {
    if (!currentConversation && messages.length === 0) {
      setShowChat(false);
    }
  }, [currentConversation, messages]);

  // Navigate to chat page when pending conversation is created
  useEffect(() => {
    if (pendingConversationId) {
      router.push(`/chat/${pendingConversationId}`);
    }
  }, [pendingConversationId, router]);

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  const handleRetry = async (messageId: string) => {
    if (currentConversation) {
      await retryMessage(messageId, currentConversation.id);
    }
  };

  const handleVersionChange = (messageId: string, version: number, content: string) => {
    updateMessageVersion(messageId, version, content);
  };

  const showGreeting = !currentConversation && messages.length === 0;

  return (
    <div className="flex flex-col flex-1 bg-neutral-900 w-full max-w-full">
      <div className="p-3 sm:p-4 flex items-center gap-3">
        {isMobile && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        )}
        <h1 className="text-white text-lg font-semibold" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Scorpio</h1>
      </div>
      <div className="flex-1 flex flex-col min-h-0 w-full max-w-full">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="spinner-loader">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} />
              ))}
            </div>
          </div>
        ) : showChat ? (
          <>
            <div className="flex-1 overflow-y-auto px-3 sm:px-6 pt-4 pb-24 scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-transparent relative w-full">
              <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-neutral-900 to-transparent pointer-events-none z-10" />
              <div className="max-w-3xl mx-auto w-full">
                {messages.map((msg) => (
                  <MessageBubble 
                    key={msg.id} 
                    role={msg.role} 
                    content={msg.content} 
                    isLoading={msg.isLoading}
                    loadingPhase={msg.loadingPhase}
                    messageId={msg.id}
                    userId={user?.uid}
                    conversationId={currentConversation?.id}
                    onRetry={handleRetry}
                    onVersionChange={handleVersionChange}
                  />
                ))}
              </div>
            </div>
            <div className="w-full max-w-3xl mx-auto px-0 sm:px-6 pb-4 bg-neutral-900 relative z-20">
              <ChatInput onSend={handleSendMessage} onLoginClick={onLoginClick} isAIThinking={isSending} position="bottom" />
            </div>
          </>
        ) : showGreeting ? (
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <motion.div layout className="w-full max-w-3xl px-4 sm:px-6 mb-4">
              <p className="text-white text-2xl text-center font-medium">
                <Typewriter text={greeting} />
              </p>
            </motion.div>
            <motion.div layout className="w-full max-w-3xl px-0 sm:px-6">
              <ChatInput onSend={handleSendMessage} onLoginClick={onLoginClick} isAIThinking={isSending} position="center" />
            </motion.div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center w-full">
            <motion.div layout className="w-full max-w-3xl px-0 sm:px-6">
              <ChatInput onSend={handleSendMessage} onLoginClick={onLoginClick} position="center" />
            </motion.div>
          </div>
        )}
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
    </div>
  );
}
