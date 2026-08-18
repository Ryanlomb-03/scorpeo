"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  loadingPhase?: number;
  createdAt?: string;
  currentVersion?: number;
  totalVersions?: number;
  versionHistory?: any[];
  wikiCardData?: {
    title: string;
    imageUrl?: string;
    description: string;
    extract: string;
  };
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
  retryMessage: (messageId: string, conversationId: string) => Promise<void>;
  updateMessageVersion: (messageId: string, version: number, content: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const guestUserId = useRef<string>("guest-user");
  const updateBufferRef = useRef<string>("");
  const animationFrameId = useRef<number | null>(null);
  
  // Generate or retrieve guest user ID
  useEffect(() => {
    const storedId = localStorage.getItem("guestUserId");
    if (storedId) {
      guestUserId.current = storedId;
    } else {
      const newId = "guest-" + generateId();
      guestUserId.current = newId;
      localStorage.setItem("guestUserId", newId);
    }
  }, []);
  
  // Load conversations from localStorage
  useEffect(() => {
    const loadConversations = () => {
      const cached = localStorage.getItem("guestConversations");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setConversations(parsed);
          }
        } catch (error) {
          console.error("Failed to load conversations:", error);
        }
      }
    };
    loadConversations();
  }, []);

  const createConversation = async (): Promise<string> => {
    const id = generateId();
    const newConv: Conversation = {
      id,
      userId: guestUserId.current,
      title: "New Chat",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversation(newConv);
    setMessages([]);
    
    // Save to localStorage immediately
    setTimeout(() => {
      const currentConvs = [...conversations, newConv];
      localStorage.setItem("guestConversations", JSON.stringify(currentConvs));
    }, 0);
    
    return id;
  };

  const selectConversation = async (id: string) => {
    // Skip if already on this conversation with messages
    if (currentConversation?.id === id && messages.length > 0) {
      return;
    }
    
    // Find conversation in local state
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversation(conv);
    }
    
    // Load messages from localStorage
    const cachedMessages = localStorage.getItem(`guestMessages_${id}`);
    if (cachedMessages) {
      try {
        const msgs = JSON.parse(cachedMessages);
        setMessages(msgs || []);
      } catch (error) {
        console.error("Failed to load messages:", error);
        setMessages([]);
      }
    } else {
      setMessages([]);
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

      // Update conversation title in localStorage immediately
      setTimeout(() => {
        const cached = localStorage.getItem("guestConversations");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              localStorage.setItem("guestConversations", JSON.stringify(
                parsed.map((c: Conversation) => c.id === id ? { ...c, title: finalTitle } : c)
              ));
            }
          } catch {}
        }
      }, 0);

      // Typewriter effect
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
    setIsSending(true);
    
    let convId = currentConversation?.id;
    const isNewConversation = !convId;
    
    if (!convId) {
      convId = generateId();
      // Set ALL local state immediately before any async
      const newConv: Conversation = {
        id: convId,
        userId: guestUserId.current,
        title: "", // Start empty for typewriter effect
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setConversations(prev => Array.isArray(prev) ? [newConv, ...prev] : [newConv]);
      setCurrentConversation(newConv);
      setPendingConversationId(convId);
      
      // Update localStorage cache immediately
      setTimeout(() => {
        const cached = localStorage.getItem("guestConversations");
        let existing: Conversation[] = [];
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            existing = Array.isArray(parsed) ? parsed : [];
          } catch {
            existing = [];
          }
        }
        localStorage.setItem("guestConversations", JSON.stringify([newConv, ...existing]));
      }, 0);
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
    
    // Add AI placeholder immediately
    const assistantId = generateId();
    setMessages(prev => [...prev, {
      id: assistantId,
      conversationId: convId,
      role: "assistant",
      content: "",
      isLoading: true
    }]);

    // Reset streaming refs
    updateBufferRef.current = "";
    animationFrameId.current = null;

    // Throttled update function using requestAnimationFrame
    const flushUpdate = (id: string, cardData: any) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === id ? { ...m, content: updateBufferRef.current, wikiCardData: cardData } : m
        )
      );
    };

    // Call real AI API
    try {
      if (isNewConversation) {
        // Start background title generation with typewriter effect
        generateAndTypeTitle(convId, content);
      }
      
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content }
          ]
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
      let buffer = "";
      let wikiCardData: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Check for wiki card markers
        const wikiCardMatch = buffer.match(/\[WIKI_CARD_START\]([\s\S]*?)\[WIKI_CARD_END\]/);
        if (wikiCardMatch && !wikiCardData) {
          try {
            const cardData = JSON.parse(wikiCardMatch[1]);
            if (cardData.type === 'wiki_card') {
              wikiCardData = cardData.data;
              // Remove the wiki card markers from the content
              buffer = buffer.replace(wikiCardMatch[0], '');
              assistantContent = buffer;
            }
          } catch (e) {
            console.error("Failed to parse wiki card data:", e);
          }
        }
        
        assistantContent = buffer;

        // Replace {username} placeholder on the fly if needed
        let displayContent = assistantContent;
        displayContent = displayContent.replace(/{username}/gi, "Guest");

        // Update buffer and schedule throttled UI update
        updateBufferRef.current = displayContent;

        // As soon as the first chunk arrives, hide the pulsing dot and show the typed text
        if (isFirstChunk) {
          isFirstChunk = false;
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: displayContent, isLoading: false, wikiCardData } : m
          ));
        } else {
          // Throttled update using requestAnimationFrame
          if (!animationFrameId.current) {
            animationFrameId.current = requestAnimationFrame(() => {
              flushUpdate(assistantId, wikiCardData);
              animationFrameId.current = null;
            });
          }
        }
      }

      // Final replacement just in case
      assistantContent = assistantContent.replace(/{username}/gi, "Guest");

      // Update message with final AI response and make sure loading is disabled
      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { ...m, content: assistantContent, isLoading: false, wikiCardData } : m
      ));
      
      // Save messages to localStorage immediately
      setTimeout(() => {
        const finalMessages = [...messages, userMessage, {
          id: assistantId,
          conversationId: convId,
          role: "assistant",
          content: assistantContent,
          wikiCardData
        }];
        localStorage.setItem(`guestMessages_${convId}`, JSON.stringify(finalMessages));
      }, 0);
      
    } catch (aiError) {
      console.error("AI API error:", aiError);
      
      // Check if error response contains JSON error message
      let errorMessage = "This model is at its peak hours. Many people are using this model at the same time.";
      
      if (aiError instanceof Response) {
        try {
          const errorData = await aiError.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If not JSON, use default message
        }
      }
      
      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { ...m, content: errorMessage, isLoading: false } : m
      ));
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
    try {
      setConversations(prev => prev.filter(c => c.id !== id));
      
      // Clear current if deleted
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
      
      // Update localStorage cache immediately
      setTimeout(() => {
        const cached = localStorage.getItem("guestConversations");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              localStorage.setItem("guestConversations", JSON.stringify(parsed.filter((c: Conversation) => c.id !== id)));
            }
          } catch {}
        }
      }, 0);
      
      // Delete messages for this conversation
      localStorage.removeItem(`guestMessages_${id}`);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const renameConversation = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    const trimmedTitle = newTitle.trim();

    // Optimistic UI update
    setConversations(prev => 
      prev.map(c => c.id === id ? { ...c, title: trimmedTitle } : c)
    );
    if (currentConversation?.id === id) {
      setCurrentConversation(prev => prev ? { ...prev, title: trimmedTitle } : null);
    }

    // Update localStorage cache immediately
    setTimeout(() => {
      const cached = localStorage.getItem("guestConversations");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            localStorage.setItem("guestConversations", JSON.stringify(
              parsed.map((c: Conversation) => c.id === id ? { ...c, title: trimmedTitle } : c)
            ));
          }
        } catch (error) {
          console.error("Failed to update localStorage:", error);
        }
      }
    }, 0);
  };

  const togglePinConversation = async (id: string, is_pinned: boolean) => {

    // Optimistic UI update
    setConversations(prev => 
      prev.map(c => c.id === id ? { ...c, is_pinned } : c)
    );
    if (currentConversation?.id === id) {
      setCurrentConversation(prev => prev ? { ...prev, is_pinned } : null);
    }

    // Update localStorage cache immediately
    setTimeout(() => {
      const cached = localStorage.getItem("guestConversations");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            localStorage.setItem("guestConversations", JSON.stringify(
              parsed.map((c: Conversation) => c.id === id ? { ...c, is_pinned } : c)
            ));
          }
        } catch (error) {
          console.error("Failed to update localStorage:", error);
        }
      }
    }, 0);
  };

  const retryMessage = async (messageId: string, conversationId: string) => {

    try {
      // Set the message to loading state with empty content
      setMessages(prev => 
        prev.map(m => m.id === messageId 
          ? { ...m, isLoading: true, content: '' } 
          : m
        )
      );

      // Call the retry API with streaming
      const response = await fetch('/api/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, conversationId })
      });

      if (!response.ok) {
        throw new Error('Retry failed');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let streamedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        streamedContent += chunk;

        // Update the message content as it streams in
        setMessages(prev => 
          prev.map(m => m.id === messageId 
            ? { ...m, isLoading: true, content: streamedContent } 
            : m
          )
        );
      }

      // Final update when streaming is complete
      setMessages(prev => 
        prev.map(m => m.id === messageId 
          ? { ...m, isLoading: false, content: streamedContent } 
          : m
        )
      );
      
      // Update localStorage with new message content immediately
      setTimeout(() => {
        const finalMessages = messages.map(m => 
          m.id === messageId ? { ...m, content: streamedContent, isLoading: false } : m
        );
        localStorage.setItem(`guestMessages_${conversationId}`, JSON.stringify(finalMessages));
      }, 0);

    } catch (error) {
      console.error('Error retrying message:', error);
      // Reset to original content on error
      setMessages(prev => 
        prev.map(m => m.id === messageId 
          ? { ...m, isLoading: false } 
          : m
        )
      );
    }
  };

  const updateMessageVersion = (messageId: string, version: number, content: string) => {
    // Update message content locally for version navigation
    setMessages(prev => 
      prev.map(m => m.id === messageId 
        ? { ...m, content, currentVersion: version } 
        : m
      )
    );
    
    // Update localStorage if we have a current conversation
    if (currentConversation) {
      const finalMessages = messages.map(m => 
        m.id === messageId ? { ...m, content, currentVersion: version } : m
      );
      localStorage.setItem(`guestMessages_${currentConversation.id}`, JSON.stringify(finalMessages));
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
      togglePinConversation,
      retryMessage,
      updateMessageVersion
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
      togglePinConversation: async () => {},
      retryMessage: async () => {},
      updateMessageVersion: () => {}
    };
  }
  return context;
}
