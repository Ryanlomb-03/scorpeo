"use client";
import { useState, useEffect } from "react";
import { useChat } from "@/context/ChatContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useSidebar } from "@/context/SidebarContext";

export default function SearchChats({ onClose }: { onClose?: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { conversations } = useChat();
  const { isMobile, setIsSidebarOpen } = useSidebar();
  const router = useRouter();

  // Helper function to format date
  const formatChatDate = (timestamp?: string | number) => {
    if (!timestamp) return "Unknown";
    
    // Parse the date, handling both ISO strings and numbers
    const date = new Date(timestamp);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) return "Unknown";

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  // Search through conversation titles and cached message contents
  useEffect(() => {
    if (searchQuery.length > 0) {
      const cached = localStorage.getItem("guestConversations");
      const searchResultsWithSnippets: any[] = [];
      
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            parsed.forEach((conv: any) => {
              // Search in title
              const titleMatch = (conv.title || "").toLowerCase().includes(searchQuery.toLowerCase());
              
              // Search in cached messages
              const cachedMessages = localStorage.getItem(`guestMessages_${conv.id}`);
              let contentMatches: string[] = [];
              
              if (cachedMessages) {
                try {
                  const msgs = JSON.parse(cachedMessages);
                  if (Array.isArray(msgs)) {
                    contentMatches = msgs
                      .filter((msg: any) => 
                        msg.role === "assistant" && 
                        msg.content && 
                        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((msg: any) => msg.content);
                  }
                } catch (error) {
                  console.error("Failed to parse cached messages:", error);
                }
              }
              
              // Include conversation if title or content matches
              if (titleMatch || contentMatches.length > 0) {
                searchResultsWithSnippets.push({
                  ...conv,
                  snippets: contentMatches.slice(0, 2) // Show up to 2 matching snippets
                });
              }
            });
            setSearchResults(searchResultsWithSnippets);
          }
        } catch (error) {
          console.error("Failed to search cached conversations:", error);
        }
      }
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Use search results if available, otherwise fall back to all conversations
  const displayResults = searchQuery.length > 0 ? searchResults : conversations;

  // Highlight search term in text
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? (
        <strong key={i} className="text-white font-semibold bg-neutral-700/50 px-0.5 rounded">{part}</strong>
      ) : part
    );
  };

  return (
    <div className="flex flex-col flex-1 bg-neutral-900 overflow-hidden">
      <div className="p-3 sm:p-4 flex items-center gap-3 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.5)] z-20 relative bg-neutral-900">
        {isMobile && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        )}
        <h1 className="text-white text-lg font-semibold" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
          Scorpio
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-12 scrollbar-thin scrollbar-thumb-neutral-600">
        <div className="max-w-2xl mx-auto">
          
          {/* Search Bar */}
          <div className="relative mb-12">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search chats"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#2f2f2f] text-white placeholder-gray-400 rounded-full py-2.5 pl-10 pr-4 outline-none border border-neutral-700 focus:border-neutral-500 transition-colors text-sm"
              autoFocus
            />
          </div>

          <h2 className="text-gray-400 text-sm font-medium mb-4 px-2">
            {searchQuery.length > 0 ? "Results" : "Recent"}
          </h2>

          {/* Results Area */}
          <div className="space-y-1">
            {displayResults.length > 0 ? (
              // Actual Results
              displayResults.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    router.push(`/chat/${conv.id}`);
                    if (onClose) onClose();
                  }}
                  className="w-full flex flex-col items-start p-3 rounded-xl hover:bg-neutral-800 transition-colors group text-left"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-gray-200 text-base font-medium truncate pr-4">
                      {searchQuery ? highlightText(conv.title || "New Chat", searchQuery) : (conv.title || "New Chat")}
                    </span>
                    <span className="text-gray-500 text-sm whitespace-nowrap opacity-100 group-hover:text-gray-400 transition-colors">
                      {formatChatDate(conv.created_at)}
                    </span>
                  </div>
                  {conv.snippets && conv.snippets.length > 0 && (
                    <div className="text-gray-400 text-sm mt-1 line-clamp-2">
                      {conv.snippets.map((snippet: string, i: number) => (
                        <span key={i} className="block">
                          {highlightText(snippet, searchQuery)}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))
            ) : (
              // No Results
              <div className="text-center py-12 text-gray-500">
                {searchQuery ? `No chats found for "${searchQuery}"` : "Type to search your chats"}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}