"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  loadingPhase?: number;
  createdAt?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  is_pinned?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ChatContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  isSending: boolean;
  pendingConversationId: string | null;
  createConversation: () => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  sendMessage: (content: string, onChunk?: (chunk: string) => void) => Promise<void>;
  clearCurrentConversation: () => void;
  resetChat: () => void;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, newTitle: string) => Promise<void>;
  togglePinConversation: (id: string, is_pinned: boolean) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const supabaseUrl = "https://ncbilugbsichgbdebbvn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jYmlsdWdic2ljaGdiZGViYnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2Mzg0MTMsImV4cCI6MjA5MzIxNDQxM30.uto7UUj9n1BZmrgqrf9NIa70__IQmt4ZFLmIr45YAvM";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const loadingConversationRef = useRef<string | null>(null);
  const conversationCacheRef = useRef<Record<string, Message[]>>({});
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    
    // Load cached conversations instantly
    const cached = localStorage.getItem("conversations");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setConversations(parsed);
        }
      } catch {}
    }
    
    try {
      const res = await fetch("/api/conversations", {
        headers: { "x-user-id": user.uid }
      });
      const data = await res.json();
      setConversations(data || []);
      // Cache for next load
      localStorage.setItem("conversations", JSON.stringify(data || []));
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const createConversation = async (): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    
    const id = generateId();
    
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": user.uid 
        },
        body: JSON.stringify({ id })
      });
      const conversation = await res.json();
      
      setConversations(prev => [conversation, ...prev]);
      setCurrentConversation(conversation);
      setMessages([]);
      
      return conversation.id;
    } catch (error) {
      console.error("Failed to create conversation:", error);
      throw error;
    }
  };

  const selectConversation = async (id: string) => {
    if (!user) return;
    
    // Prevent duplicate loads
    if (loadingConversationRef.current === id) return;
    loadingConversationRef.current = id;
    
    // Skip if already on this conversation with messages
    if (currentConversation?.id === id && messages.length > 0) {
      loadingConversationRef.current = null;
      return;
    }
    
    // If we have cached messages, use them
    if (conversationCacheRef.current[id]) {
      setMessages(conversationCacheRef.current[id]);
      setLoading(false);
      loadingConversationRef.current = null;
      // Also fetch conversation metadata if needed
      try {
        const convRes = await fetch(`/api/conversations?id=${id}`, {
          headers: { "x-user-id": user.uid }
        });
        const convData = await convRes.json();
        const conv = convData?.find((c: Conversation) => c.id === id);
        if (conv) setCurrentConversation(conv);
      } catch (error) {
        console.error("Failed to load conversation metadata:", error);
      }
      return;
    }
    
    // Only clear if switching to a different conversation
    if (currentConversation?.id !== id) {
      setMessages([]);
    }
    setLoading(true);
    
    try {
      const convRes = await fetch(`/api/conversations?id=${id}`, {
        headers: { "x-user-id": user.uid }
      });
      const convData = await convRes.json();
      const conv = convData?.find((c: Conversation) => c.id === id);
      if (conv) {
        setCurrentConversation(conv);
      }
      
      // Load last 20 messages only for speed
      const res = await fetch(`/api/messages?conversationId=${id}&limit=20`, {
        headers: { "x-user-id": user.uid }
      });
      const msgs = await res.json();
      setMessages(msgs || []);
      // Cache messages for future loads
      conversationCacheRef.current[id] = msgs || [];
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setLoading(false);
      loadingConversationRef.current = null;
    }
  };

  const generateAndTypeTitle = async (id: string, firstMessage: string) => {
    try {
      const res = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: firstMessage })
      });
      const data = await res.json();
      const finalTitle = data.title || "New Chat";

      // Update in Supabase Database FIRST to ensure persistence
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: finalTitle })
      });

      // Update local storage cache immediately after DB update
      const cached = localStorage.getItem("conversations");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            localStorage.setItem("conversations", JSON.stringify(
              parsed.map((c: Conversation) => c.id === id ? { ...c, title: finalTitle } : c)
            ));
          }
        } catch {}
      }

      // Typewriter effect - starts after DB is updated
      let currentTitle = "";
      for (let i = 0; i < finalTitle.length; i++) {
        currentTitle += finalTitle[i];
        
        setConversations(prev => {
          if (!prev.find(c => c.id === id)) return prev;
          return prev.map(c => c.id === id ? { ...c, title: currentTitle } : c);
        });
        
        setCurrentConversation(prev => 
          prev?.id === id ? { ...prev, title: currentTitle } : prev
        );
        
        await new Promise(r => setTimeout(r, 50));
      }
    } catch (e) {
      console.error("Failed to generate and type title:", e);
    }
  };

  const sendMessage = async (content: string, onChunk?: (chunk: string) => void) => {
    if (!user) return;
    
    setIsSending(true);
    
    let convId = currentConversation?.id;
    const isNewConversation = !convId;
    
    if (!convId) {
      convId = generateId();
      // Set ALL local state immediately before any async
      const newConv: Conversation = {
        id: convId,
        userId: user.uid,
        title: "", // Start empty for typewriter effect
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setConversations(prev => Array.isArray(prev) ? [newConv, ...prev] : [newConv]);
      setCurrentConversation(newConv);
      setPendingConversationId(convId);
      // Update localStorage cache
      const cached = localStorage.getItem("conversations");
      let existing: Conversation[] = [];
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          existing = Array.isArray(parsed) ? parsed : [];
        } catch {
          existing = [];
        }
      }
      localStorage.setItem("conversations", JSON.stringify([newConv, ...existing]));
    }
    
    // Add user message immediately
    const userId = generateId();
    const userMessage: Message = {
      id: userId,
      conversationId: convId,
      role: "user",
      content
    };
    setMessages(prev => [...prev, userMessage]);
    // Update cache for this conversation
    const existingCache = conversationCacheRef.current[convId] || [];
    conversationCacheRef.current[convId] = [...existingCache, userMessage];
    
    // Add AI placeholder immediately
    const assistantId = generateId();
    setMessages(prev => [...prev, {
      id: assistantId,
      conversationId: convId,
      role: "assistant",
      content: "",
      isLoading: true
    }]);
    
    // All API calls in background - don't block UI
    try {
      if (isNewConversation) {
        // Create conversation and generate title concurrently in the background without blocking the UI
        const initNewConversation = async () => {
          try {
            await fetch("/api/conversations", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "x-user-id": user.uid 
              },
              body: JSON.stringify({ id: convId, title: "New Chat" })
            });
            
            // Start background title generation with typewriter effect
            generateAndTypeTitle(convId, content);
          } catch (e) {
            console.error("Failed to initialize new conversation in background:", e);
          }
        };
        initNewConversation();
      }
      fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userMessage)
      });
      
      // Call real AI API immediately without artificial delays
      try {
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            history: messages,
            username: user?.displayName || null
          })
        });
        
        if (!chatRes.ok) {
          throw new Error(`API error: ${chatRes.status}`);
        }

        const reader = chatRes.body?.getReader();
        if (!reader) throw new Error("No readable stream");

        const decoder = new TextDecoder("utf-8");
        let assistantContent = "";
        let isFirstChunk = true;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;

          // Replace {username} placeholder on the fly if needed
          let displayContent = assistantContent;
          if (user?.displayName) {
            displayContent = displayContent.replace(/{username}/gi, user.displayName);
          }

          // As soon as the first chunk arrives, hide the pulsing dot and show the typed text
          if (isFirstChunk) {
            isFirstChunk = false;
            setMessages(prev => prev.map(m => 
              m.id === assistantId ? { ...m, content: displayContent, isLoading: false } : m
            ));
          } else {
            // Update message incrementally
            setMessages(prev => prev.map(m => 
              m.id === assistantId ? { ...m, content: displayContent } : m
            ));
          }
        }

        // Final replacement just in case
        if (user?.displayName) {
          assistantContent = assistantContent.replace(/{username}/gi, user.displayName);
        }

        // Update message with final AI response and make sure loading is disabled
        setMessages(prev => prev.map(m => 
          m.id === assistantId ? { ...m, content: assistantContent, isLoading: false } : m
        ));
        // Update cache with final assistant message
        const existingCache = conversationCacheRef.current[convId] || [];
        conversationCacheRef.current[convId] = [...existingCache, {
          id: assistantId,
          conversationId: convId,
          role: "assistant",
          content: assistantContent
        }];
        
        // Save to DB (with actual username, not placeholder)
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: assistantId,
            conversationId: convId,
            role: "assistant",
            content: assistantContent
          })
        });
      } catch (aiError) {
        console.error("AI API error:", aiError);
        setMessages(prev => prev.map(m => 
          m.id === assistantId ? { ...m, content: "Sorry, something went wrong. Please try again." } : m
        ));
      }
      
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
      setPendingConversationId(null);
    }
  };

  const clearCurrentConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
  };

  const resetChat = () => {
    setCurrentConversation(null);
    setMessages([]);
  };

  const deleteConversation = async (id: string) => {
    if (!user) return;
    
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
        headers: { "x-user-id": user.uid }
      });
      
      setConversations(prev => prev.filter(c => c.id !== id));
      
      // Clear current if deleted
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
      
      // Update localStorage cache
      const cached = localStorage.getItem("conversations");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            localStorage.setItem("conversations", JSON.stringify(parsed.filter((c: Conversation) => c.id !== id)));
          }
        } catch {}
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const renameConversation = async (id: string, newTitle: string) => {
    if (!user || !newTitle.trim()) return;

    const trimmedTitle = newTitle.trim();

    // Optimistic UI update
    setConversations(prev => 
      prev.map(c => c.id === id ? { ...c, title: trimmedTitle } : c)
    );
    if (currentConversation?.id === id) {
      setCurrentConversation(prev => prev ? { ...prev, title: trimmedTitle } : null);
    }

    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: trimmedTitle })
      });

      // Update localStorage cache
      const cached = localStorage.getItem("conversations");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            localStorage.setItem("conversations", JSON.stringify(
              parsed.map((c: Conversation) => c.id === id ? { ...c, title: trimmedTitle } : c)
            ));
          }
        } catch {}
      }
    } catch (error) {
      console.error("Failed to rename conversation:", error);
    }
  };

  const togglePinConversation = async (id: string, is_pinned: boolean) => {
    if (!user) return;

    // Optimistic UI update
    setConversations(prev => 
      prev.map(c => c.id === id ? { ...c, is_pinned } : c)
    );
    if (currentConversation?.id === id) {
      setCurrentConversation(prev => prev ? { ...prev, is_pinned } : null);
    }

    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_pinned })
      });

      // Update localStorage cache
      const cached = localStorage.getItem("conversations");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            localStorage.setItem("conversations", JSON.stringify(
              parsed.map((c: Conversation) => c.id === id ? { ...c, is_pinned } : c)
            ));
          }
        } catch {}
      }
    } catch (error) {
      console.error("Failed to toggle pin status:", error);
    }
  };

  return (
    <ChatContext.Provider value={{
      conversations,
      currentConversation,
      messages,
      loading,
      isSending,
      pendingConversationId,
      createConversation,
      selectConversation,
      sendMessage,
      clearCurrentConversation,
      resetChat,
      deleteConversation,
      renameConversation,
      togglePinConversation
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    return {
      conversations: [],
      currentConversation: null,
      messages: [],
      loading: false,
      isSending: false,
      pendingConversationId: null,
      createConversation: async () => "",
      selectConversation: async () => {},
      sendMessage: async () => {},
      clearCurrentConversation: () => {},
      resetChat: () => {},
      deleteConversation: async () => {},
      renameConversation: async () => {},
      togglePinConversation: async () => {}
    };
  }
  return context;
}
