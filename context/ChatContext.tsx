"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { isSimpleGreeting, getLocalGreetingResponse } from "@/lib/localGreetings";
import { loadPyodide } from "pyodide";

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
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
  isGreeting?: boolean;
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

/**
 * Generate a branded, cryptographically secure chat ID
 * Format: scpo + 16 random URL-safe characters (20 total)
 * Uses Web Crypto API for secure randomness
 */
function generateChatId(): string {
  const prefix = 'scpo';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = new Uint8Array(16);
  
  // Use Web Crypto API for secure randomness
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Fallback for environments without Web Crypto (shouldn't happen in modern browsers)
    for (let i = 0; i < 16; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  
  let result = prefix;
  for (let i = 0; i < 16; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
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
  const pyodideRef = useRef<any>(null);
  const [pyodideLoaded, setPyodideLoaded] = useState(false);

  // Load Pyodide for client-side Python execution
  useEffect(() => {
    const loadPyodideLib = async () => {
      try {
        const pyodide = await loadPyodide();
        await pyodide.loadPackage("micropip");
        await pyodide.installPackage("youtube-transcript-api");
        pyodideRef.current = pyodide;
        setPyodideLoaded(true);
        console.log('[ChatContext] Pyodide loaded successfully');
      } catch (error) {
        console.error('[ChatContext] Pyodide failed to load:', error);
      }
    };
    loadPyodideLib();
  }, []);
  const thinkingBufferRef = useRef<string>("");
  const textBufferRef = useRef<string>("");
  const lastUpdateTimeRef = useRef<number>(0);
  
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
    const id = generateChatId();
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

  /**
   * Generate a provisional title immediately from the first message
   * This is a fast, deterministic method that doesn't require AI
   */
  const generateProvisionalTitle = (message: string): string => {
    const trimmed = message.trim();
    const words = trimmed.split(/\s+/).slice(0, 5); // Take first 5 words
    
    // If message is very short, use it directly
    if (words.length <= 3) {
      return trimmed.length > 30 ? trimmed.substring(0, 30) + '...' : trimmed;
    }
    
    // Capitalize first letter of each word
    const title = words
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    
    return title.length > 40 ? title.substring(0, 40) + '...' : title;
  };

  const generateAndTypeTitle = async (id: string, firstMessage: string, isUpdate: boolean = false) => {
    // Set provisional title immediately
    const provisionalTitle = generateProvisionalTitle(firstMessage);
    
    if (!isUpdate) {
      setConversations(prev => {
        if (!prev.find(c => c.id === id)) return prev;
        return prev.map(c => c.id === id ? { ...c, title: provisionalTitle, isGreeting: false } : c);
      });
      
      setCurrentConversation(prev =>
        prev?.id === id ? { ...prev, title: provisionalTitle, isGreeting: false } : prev
      );
    }

    // Generate AI title in background (non-blocking)
    try {
      const res = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: firstMessage })
      });
      const data = await res.json();
      const finalTitle = data.title || provisionalTitle;
      const isGreeting = data.isGreeting || false;

      // Update conversation title in localStorage immediately
      setTimeout(() => {
        const cached = localStorage.getItem("guestConversations");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              localStorage.setItem("guestConversations", JSON.stringify(
                parsed.map((c: Conversation) => c.id === id ? { ...c, title: finalTitle, isGreeting } : c)
              ));
            }
          } catch {}
        }
      }, 0);

      // Update UI with final title (skip typewriter if it's an update)
      if (!isUpdate) {
        setConversations(prev => {
          if (!prev.find(c => c.id === id)) return prev;
          return prev.map(c => c.id === id ? { ...c, title: finalTitle, isGreeting } : c);
        });
        
        setCurrentConversation(prev => 
          prev?.id === id ? { ...prev, title: finalTitle, isGreeting } : prev
        );
      }
    } catch (error) {
      console.error("Failed to generate AI title, keeping provisional title:", error);
      // Keep provisional title on failure - don't break the chat
    }
  };

  // Fetch YouTube transcript using Pyodide (client-side Python)
  const fetchYouTubeTranscript = async (videoId: string): Promise<string | null> => {
    if (!pyodideLoaded || !pyodideRef.current) {
      console.log('[ChatContext] Pyodide not loaded, skipping transcript fetch');
      return null;
    }

    try {
      const pyodide = pyodideRef.current;
      const transcriptCode = `
from youtube_transcript_api import YouTubeTranscriptApi

try:
    api = YouTubeTranscriptApi()
    transcript = api.fetch("${videoId}", languages=['en'])
    transcript_text = ' '.join([snippet.text for snippet in transcript])
    result = {"success": True, "transcript": transcript_text}
except Exception as e:
    result = {"success": False, "error": str(e)}
result
      `;

      const result = await pyodide.runPythonAsync(transcriptCode);
      
      if (result.success && result.transcript) {
        console.log('[ChatContext] Transcript fetched successfully, length:', result.transcript.length);
        return result.transcript;
      } else {
        console.log('[ChatContext] Transcript fetch failed:', result.error);
        return null;
      }
    } catch (error) {
      console.error('[ChatContext] Transcript fetch error:', error);
      return null;
    }
  };

  // Extract YouTube video ID from text
  const extractVideoId = (text: string): string | null => {
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = text.match(youtubeRegex);
    return match ? match[1] : null;
  };

  const sendMessage = async (content: string, onChunk?: (chunk: string) => void) => {
    setIsSending(true);
    
    // Check if this is the first message and a simple greeting - respond locally in the native language to save tokens
    const isFirstMessage = messages.length === 0;
    if (isFirstMessage && isSimpleGreeting(content)) {
      let convId = currentConversation?.id;
      const isNewConversation = !convId;
      
      if (!convId) {
        convId = generateId();
        const newConv: Conversation = {
          id: convId,
          userId: guestUserId.current,
          title: "", // Start empty for skeleton loader
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setConversations(prev => Array.isArray(prev) ? [newConv, ...prev] : [newConv]);
        setCurrentConversation(newConv);
        setPendingConversationId(convId);
        
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
      
      // Add user message
      const userId = generateId();
      const userMessage: Message = {
        id: userId,
        conversationId: convId,
        role: "user",
        content
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Add AI placeholder with loading state
      const assistantId = generateId();
      setMessages(prev => [...prev, {
        id: assistantId,
        conversationId: convId,
        role: "assistant",
        content: "",
        isLoading: true
      }]);
      
      // Save to localStorage
      setTimeout(() => {
        const finalMessages = [...messages, userMessage];
        localStorage.setItem(`guestMessages_${convId}`, JSON.stringify(finalMessages));
      }, 0);
      
      // Fetch dynamic greeting (uses local dictionary for 35+ languages, or Token Harbor for any other language)
      let greetingResponse = getLocalGreetingResponse(content);
      try {
        const greetRes = await fetch("/api/greeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content })
        });
        if (greetRes.ok) {
          const greetData = await greetRes.json();
          if (greetData.greeting) {
            greetingResponse = greetData.greeting;
          }
        }
      } catch (err) {
        console.warn("Greeting fetch fallback to local:", err);
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: greetingResponse, isLoading: false }
            : m
        )
      );
      
      // Generate dynamic title via Token Harbor even for greetings instead of hardcoding "Greeting"
      if (isNewConversation) {
        generateAndTypeTitle(convId, content);
      }
      
      // Update localStorage with final message
      setTimeout(() => {
        const finalMessages = [...messages, userMessage, { id: assistantId, conversationId: convId, role: "assistant", content: greetingResponse }];
        localStorage.setItem(`guestMessages_${convId}`, JSON.stringify(finalMessages));
      }, 0);
      
      setIsSending(false);
      setPendingConversationId(null);
      return;
    }
    
    // Normal AI response for non-greeting messages
    let convId = currentConversation?.id;
    const isNewConversation = !convId;
    
    if (!convId) {
      // Show loading state for new conversation
      setLoading(true);
      
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
      
      // Don't wait - let navigation happen immediately
      setLoading(false);
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
    thinkingBufferRef.current = "";
    textBufferRef.current = "";
    lastUpdateTimeRef.current = 0;
    const BATCH_INTERVAL = 50; // Batch updates every 50ms for smooth rendering

    // Throttled update function using requestAnimationFrame with batching
    const flushUpdate = (id: string, cardData: any, thinking: string, newsData?: any) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === id ? { ...m, content: textBufferRef.current, wikiCardData: cardData, newsCardData: newsData, thinking } : m
        )
      );
    };

    // Call real AI API
    try {
      // Check if this is the second message and current title is a greeting - update title
      const currentConv = conversations.find(c => c.id === convId);
      const isSecondMessage = messages.length === 1;
      if (isSecondMessage && currentConv?.isGreeting) {
        // Regenerate title with new context (second message provides context)
        generateAndTypeTitle(convId, content, true); // true = isUpdate, skip typewriter
      } else if (isNewConversation) {
        // Start background title generation with typewriter effect
        generateAndTypeTitle(convId, content);
      }

      // Check for YouTube URL and fetch transcript if Pyodide is loaded
      let transcript = null;
      const videoId = extractVideoId(content);
      if (videoId) {
        console.log('[ChatContext] YouTube URL detected, waiting for Pyodide to load...');
        // Wait for Pyodide to load if not ready (with timeout)
        if (!pyodideLoaded) {
          console.log('[ChatContext] Pyodide not loaded, waiting...');
          await new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
              if (pyodideLoaded) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
            // Timeout after 10 seconds
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 10000);
          });
        }
        if (pyodideLoaded) {
          console.log('[ChatContext] Pyodide loaded, fetching transcript...');
          transcript = await fetchYouTubeTranscript(videoId);
          console.log('[ChatContext] Transcript result:', transcript ? `Found (${transcript.length} chars)` : 'Not found');
        } else {
          console.log('[ChatContext] Pyodide failed to load in time, skipping transcript');
        }
      }
      
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content }
          ],
          transcript: transcript,
          videoId: videoId
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
      let thinkingContent = "";

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

        // Parse thinking markers [THINKING_START]...[THINKING_END]
        // Extract thinking content from the current chunk first
        const chunkThinkingMatch = chunk.match(/\[THINKING_START\]([\s\S]*?)\[THINKING_END\]/g);
        if (chunkThinkingMatch) {
          chunkThinkingMatch.forEach(match => {
            const content = match.replace(/\[THINKING_START\]([\s\S]*?)\[THINKING_END\]/, '$1');
            thinkingContent += content;
            thinkingBufferRef.current = thinkingContent;
          });
        }
        
        // Remove ALL thinking markers from visible content
        const thinkingRegex = /\[THINKING_START\]([\s\S]*?)\[THINKING_END\]/g;
        buffer = buffer.replace(thinkingRegex, '');
        
        // Remove ALL wiki card markers from visible content
        const wikiRegex = /\[WIKI_CARD_START\]([\s\S]*?)\[WIKI_CARD_END\]/g;
        buffer = buffer.replace(wikiRegex, '');
        
        assistantContent = buffer;
        textBufferRef.current = assistantContent;

        // Replace {username} placeholder on the fly if needed
        let displayContent = assistantContent;
        displayContent = displayContent.replace(/{username}/gi, "Guest");

        // Update buffer and schedule throttled UI update with batching
        updateBufferRef.current = displayContent;

        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

        // As soon as the first chunk arrives, hide the pulsing dot and show the typed text
        if (isFirstChunk) {
          isFirstChunk = false;
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: displayContent, isLoading: false, wikiCardData, thinking: thinkingBufferRef.current } : m
          ));
          lastUpdateTimeRef.current = now;
        } else if (timeSinceLastUpdate >= BATCH_INTERVAL) {
          // Batched update - only update if enough time has passed
          if (!animationFrameId.current) {
            animationFrameId.current = requestAnimationFrame(() => {
              flushUpdate(assistantId, wikiCardData, thinkingBufferRef.current);
              animationFrameId.current = null;
              lastUpdateTimeRef.current = Date.now();
            });
          }
        }
      }

      // Final replacement just in case
      assistantContent = assistantContent.replace(/{username}/gi, "Guest");

      // Remove any remaining YouTube video markers from final content
      const youtubeRegex = /\[YOUTUBE_VIDEO_START\]([\s\S]*?)\[YOUTUBE_VIDEO_END\]/g;
      assistantContent = assistantContent.replace(youtubeRegex, '');

      // Update message with final AI response and make sure loading is disabled
      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { ...m, content: assistantContent, isLoading: false, wikiCardData, thinking: thinkingBufferRef.current } : m
      ));
      
      // Save messages to localStorage immediately
      setTimeout(() => {
        const finalMessages = [...messages, userMessage, {
          id: assistantId,
          conversationId: convId,
          role: "assistant",
          content: assistantContent,
          wikiCardData,
          thinking: thinkingBufferRef.current
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
