"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import { useSidebar } from "@/context/SidebarContext";

export default function Sidebar() {
  const { isSidebarOpen: isOpen, setIsSidebarOpen, isMobile, hydrated, closeSidebar } = useSidebar();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameConvId, setRenameConvId] = useState<string | null>(null);
  const [originalTitle, setOriginalTitle] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isRecentsCollapsed, setIsRecentsCollapsed] = useState(false);
  const [isPinnedCollapsed, setIsPinnedCollapsed] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [searchTooltipVisible, setSearchTooltipVisible] = useState(false);
  const [closeTooltipVisible, setCloseTooltipVisible] = useState(false);
  const [openTooltipVisible, setOpenTooltipVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<'bottom' | 'top'>('bottom');
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [typingTitle, setTypingTitle] = useState<{ id: string; text: string; index: number } | null>(null);
  const convMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { conversations, currentConversation, selectConversation, resetChat, deleteConversation, renameConversation, togglePinConversation, isSending } = useChat();

  // Reset tooltips when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      setOpenTooltipVisible(false);
    }
  }, [isOpen]);
  useEffect(() => {
    const loadConversations = () => {
      const cached = localStorage.getItem("guestConversations");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            // The ChatContext will handle loading these, but we can trigger a refresh
            // by using the chat context's internal state
          }
        } catch (error) {
          console.error("Failed to load conversations:", error);
        }
      }
    };
    loadConversations();
  }, []);

  // Scroll to top when new conversation is added
  useEffect(() => {
    if (conversations.length > 0) {
      const conversationsContainer = document.querySelector('.conversations-list');
      if (conversationsContainer) {
        conversationsContainer.scrollTop = 0;
      }
    }
  }, [conversations.length]);

  const pinnedConversations = Array.isArray(conversations) ? conversations.filter(c => c.is_pinned) : [];
  const recentConversations = Array.isArray(conversations) ? conversations.filter(c => !c.is_pinned) : [];

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Conversation menu logic
      if (openMenuId) {
        // If clicking the toggle button for the CURRENTLY open menu, 
        // let the button's onClick handler handle the toggle (close).
        const toggleButton = (event.target as Element).closest(`[data-menu-toggle="${openMenuId}"]`);
        if (toggleButton) return;

        // If clicking outside the menu, close it
        if (convMenuRef.current && !convMenuRef.current.contains(target)) {
          setOpenMenuId(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const renderConversation = (conv: any) => {
    const isTyping = typingTitle?.id === conv.id;
    const displayTitle = isTyping && typingTitle
      ? typingTitle.text.substring(0, typingTitle.index)
      : conv.title;

    return (
      <div
        key={conv.id}
        className={`group relative flex items-center justify-between w-full rounded-full transition-colors p-1 ${
          currentConversation?.id === conv.id
            ? "bg-zinc-800 text-white font-medium"
            : "bg-transparent text-gray-200 hover:bg-zinc-800/50 hover:text-white font-medium"
        }`}
      >
        {editingConvId === conv.id ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => { setEditTitle(e.target.value); }}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveRename}
            className="flex-1 bg-neutral-800 text-sm text-white outline-none border border-neutral-800 rounded-full px-3.5 py-2"
            autoFocus
          />
        ) : (
          <button
            onClick={() => handleConversationClick(conv.id)}
            className="flex-1 text-left text-xs flex items-center gap-3 overflow-hidden py-0.5 px-3 font-medium"
            title={conv.title || ""}
          >
            {conv.is_pinned && (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 brightness-0 invert">
                <path d="m5 10.726l-3 .505L11.23 2l-.504 3M12 16.881l-.77 2.042l7.693-7.692l-2.042.769m-1.804 3.077L21 21M3.538 9.692l6.154-6.154l.236.341a52.2 52.2 0 0 0 7.376 8.518l.235.218l-4.924 4.923l-.218-.234A52.2 52.2 0 0 0 3.88 9.928z" />
              </svg>
            )}
            {displayTitle ? (
              <span className="truncate flex-1 min-w-0 text-ellipsis overflow-hidden whitespace-nowrap">{displayTitle}</span>
            ) : (
              <div className="flex items-center gap-1">
                <div className="h-3 w-16 bg-neutral-700 rounded animate-pulse" />
              </div>
            )}
          </button>
        )}
        <div className={`flex-shrink-0 z-50 ml-auto transition-opacity duration-150 relative ${
          openMenuId === conv.id 
            ? 'opacity-100 pointer-events-auto' 
            : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
        }`}>
        <button
          data-menu-toggle={conv.id}
          onClick={(e) => {
            e.stopPropagation();
            const button = e.currentTarget;
            const rect = button.getBoundingClientRect();
            const sidebarRect = button.closest('[class*="bg-\\[\\#1e1e1e\\]"]')?.getBoundingClientRect();
            
            // Calculate if menu would overflow at bottom
            const spaceBelow = sidebarRect ? sidebarRect.bottom - rect.bottom : 0;
            const menuHeight = 200; // Approximate menu height
            const shouldFlip = spaceBelow < menuHeight;
            
            setMenuPosition(shouldFlip ? 'top' : 'bottom');
            
            // Calculate fixed position: 1/4 inside sidebar, 3/4 outside
            const left = rect.right - (rect.width * 0.25); // Start 1/4 from the right edge of button
            const top = shouldFlip ? rect.top - menuHeight : rect.bottom;
            
            setMenuCoords({ top, left });
            setOpenMenuId(openMenuId === conv.id ? null : conv.id);
          }}
          className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all hover:bg-white/10"
          title="Options"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 15 15">
            <path d="M0 0h15v15H0z" fill="none" />
            <path fill="currentColor" d="M5.5 2c0 1.1.9 2 2 2s2-.9 2-2s-.9-2-2-2s-2 .9-2 2m0 5.5c0 1.1.9 2 2 2s2-.9 2-2s-.9-2-2-2s-2 .9-2 2m0 5.5c0 1.1.9 2 2 2s2-.9 2-2s-.9-2-2-2s-2 .9-2 2" />
          </svg>
        </button>
        
        <AnimatePresence>
          {openMenuId === conv.id && menuCoords && (
            <div ref={convMenuRef}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{ 
                  zIndex: 9999,
                  position: 'fixed',
                  top: menuCoords.top,
                  left: menuCoords.left
                }}
                className="w-52 bg-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-1.5"
              >
                <button
                  className="flex items-center gap-3 w-full py-1.5 px-3.5 text-xs font-medium text-zinc-200 hover:bg-white/10 rounded-full transition-colors duration-150"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Implement share functionality
                    setOpenMenuId(null);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M0 0h24v24H0z" fill="none" />
                    <path fill="currentColor" fillRule="evenodd" d="M14.25 5.5a3.25 3.25 0 1 1 .833 2.173l-2.717 1.482l-3.04 1.737a3.25 3.25 0 0 1 .31 2.464l5.447 2.971a3.25 3.25 0 1 1-.719 1.316l-5.447-2.97a3.25 3.25 0 1 1-.652-4.902l3.37-1.926l2.729-1.489a3.3 3.3 0 0 1-.114-.856m3.25-1.75a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 0 0 0-3.5m-11 7a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 0 0 0-3.5m9.25 7.75a1.75 1.75 0 1 1 3.5 0a1.75 1.75 0 0 1-3.5 0" clipRule="evenodd" />
                  </svg>
                  Share conversation
                </button>
                
                <button
                  className="flex items-center gap-3 w-full py-1.5 px-3.5 text-xs font-medium text-zinc-200 hover:bg-white/10 rounded-full transition-colors duration-150"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setOpenMenuId(null);
                    await togglePinConversation(conv.id, !conv.is_pinned);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="white">
                    <path d="M0 0h16v16H0z" fill="none" />
                    <path fill="currentColor" d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479c-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A6 6 0 0 1 5 6.708V2.277a3 3 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354m1.58 1.408l-.002-.001zm-.002-.001l.002.001A.5.5 0 0 1 6 2v5a.5.5 0 0 1-.276.447h-.002l-.012.007l-.054.03a5 5 0 0 0-.827.58c-.318.278-.585.596-.725.936h7.792c-.14-.34-.407-.658-.725-.936a5 5 0 0 0-.881-.61l-.012-.006h-.002A.5.5 0 0 1 10 7V2a.5.5 0 0 1 .295-.458a1.8 1.8 0 0 0 .351-.271c.08-.08.155-.17.214-.271H5.14q.091.15.214.271a1.8 1.8 0 0 0 .37.282" />
                  </svg>
                  {conv.is_pinned ? "Unpin" : "Pin"}
                </button>
                
                <button
                  className="flex items-center gap-3 w-full py-1.5 px-3.5 text-xs font-medium text-zinc-200 hover:bg-white/10 rounded-full transition-colors duration-150"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameConvId(conv.id);
                    setOriginalTitle(conv.title || "");
                    setNewTitle(conv.title || "");
                    setRenameModalOpen(true);
                    setOpenMenuId(null);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="white">
                    <path d="M0 0h32v32H0z" fill="none" />
                    <path fill="currentColor" d="M5.488 8.511a3.5 3.5 0 0 1 .837 1.363l.548 1.682a.664.664 0 0 0 1.254 0l.548-1.682a3.47 3.47 0 0 1 2.197-2.196l1.684-.547a.665.665 0 0 0 0-1.254l-.034-.008l-1.684-.547a3.47 3.47 0 0 1-2.197-2.196l-.547-1.682a.665.665 0 0 0-1.255 0l-.547 1.682l-.014.042a3.47 3.47 0 0 0-2.15 2.154l-1.684.547a.665.665 0 0 0 0 1.254l1.684.546c.513.171.979.46 1.36.842m9.333 4.847l.918.298l.019.004a.362.362 0 0 1 0 .684l-.919.299a1.9 1.9 0 0 0-1.198 1.197l-.299.918a.363.363 0 0 1-.684 0l-.299-.918a1.89 1.89 0 0 0-1.198-1.202l-.919-.298a.362.362 0 0 1 0-.684l.919-.299a1.9 1.9 0 0 0 1.18-1.197l.299-.918a.363.363 0 0 1 .684 0l.298.918a1.89 1.89 0 0 0 1.199 1.197m8.243-8.51l-7.272 7.273l-.472-.152a.6.6 0 0 1-.14-.09a.34.34 0 0 1-.09-.15l-.3-.91a2 2 0 0 0-.167-.357l7.027-7.028a4.889 4.889 0 1 1 6.915 6.914l-.901.901l.275.276a3.5 3.5 0 0 1 0 4.95l-2.232 2.232a1 1 0 0 1-1.414-1.414l2.232-2.232a1.5 1.5 0 0 0 0-2.122l-.276-.275l-14.978 14.98a3.7 3.7 0 0 1-1.841 1l-6.22 1.334a1 1 0 0 1-1.188-1.187l1.333-6.221a3.7 3.7 0 0 1 1.002-1.84l5.118-5.12q.127.07.265.12l1 .31q.08.035.14.1a.3.3 0 0 1 .09.15l.162.492l-5.361 5.361a1.7 1.7 0 0 0-.46.846L4.3 27.7l4.71-1.01a1.7 1.7 0 0 0 .846-.46L27.15 8.934a2.89 2.89 0 0 0-4.086-4.086" />
                  </svg>
                  Rename
                </button>
                
                <button
                  className="flex items-center gap-3 w-full py-1.5 px-3.5 text-xs font-medium text-zinc-200 hover:bg-white/10 rounded-full transition-colors duration-150"
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M0 0h24v24H0z" fill="none" />
                    <g fill="currentColor" fillRule="evenodd" clipRule="evenodd">
                      <path d="M5.11686 7.7517C5.53016 7.72415 5.88754 8.03685 5.91509 8.45015L6.37503 15.3493C6.46489 16.6971 6.52892 17.6349 6.66948 18.3406C6.80583 19.025 6.99617 19.3873 7.26958 19.6431C7.54299 19.8989 7.91715 20.0647 8.60915 20.1552C9.32255 20.2485 10.2626 20.25 11.6134 20.25H12.3868C13.7376 20.25 14.6776 20.2485 15.391 20.1552C16.083 20.0647 16.4572 19.8989 16.7306 19.6431C17.004 19.3873 17.1943 19.025 17.3307 18.3406C17.4713 17.6349 17.5353 16.6971 17.6251 15.3493L18.0851 8.45015C18.1126 8.03685 18.47 7.72415 18.8833 7.7517C19.2966 7.77925 19.6093 8.13663 19.5818 8.54993L19.1183 15.5017C19.0328 16.7844 18.9638 17.8206 18.8018 18.6336C18.6334 19.4789 18.347 20.185 17.7554 20.7385C17.1638 21.2919 16.4402 21.5308 15.5856 21.6425C14.7635 21.7501 13.7251 21.7501 12.4395 21.75H11.5607C10.2751 21.7501 9.23664 21.7501 8.4146 21.6425C7.55995 21.5308 6.8364 21.2919 6.2448 20.7385C5.65321 20.185 5.36679 19.4789 5.19839 18.6336C5.03642 17.8205 4.96736 16.7844 4.88186 15.5017L4.41841 8.54993C4.39086 8.13663 4.70357 7.77925 5.11686 7.7517Z" />
                      <path d="M10.3553 2.25004L10.3094 2.25002C10.093 2.24988 9.90445 2.24976 9.72643 2.27819C9.02313 2.39049 8.41453 2.82915 8.08559 3.46084C8.00232 3.62074 7.94282 3.79964 7.87452 4.00496L7.86 4.04858L7.76291 4.33984C7.74392 4.39681 7.73863 4.41251 7.73402 4.42524C7.55891 4.90936 7.10488 5.23659 6.59023 5.24964C6.5767 5.24998 6.56013 5.25004 6.50008 5.25004H3.5C3.08579 5.25004 2.75 5.58582 2.75 6.00004C2.75 6.41425 3.08579 6.75004 3.5 6.75004L6.50865 6.75004L6.52539 6.75004H17.4748L17.4915 6.75004L20.5001 6.75004C20.9143 6.75004 21.2501 6.41425 21.2501 6.00004C21.2501 5.58582 20.9143 5.25004 20.5001 5.25004H17.5001C17.44 5.25004 17.4235 5.24998 17.4099 5.24964C16.8953 5.23659 16.4413 4.90933 16.2661 4.42522C16.2616 4.41258 16.2562 4.39653 16.2373 4.33984L16.1402 4.04858L16.1256 4.00494C16.0573 3.79961 15.9978 3.62073 15.9146 3.46084C15.5856 2.82915 14.977 2.39049 14.2737 2.27819C14.0957 2.24976 13.9072 2.24988 13.6908 2.25002L13.6448 2.25004H10.3553ZM9.14458 4.93548C9.10531 5.04404 9.05966 5.14902 9.00815 5.25004H14.992C14.9405 5.14902 14.8949 5.04405 14.8556 4.9355L14.8169 4.82216L14.7171 4.52292C14.626 4.2494 14.605 4.19363 14.5842 4.15364C14.4745 3.94307 14.2716 3.79686 14.0372 3.75942C13.9927 3.75231 13.9331 3.75004 13.6448 3.75004H10.3553C10.067 3.75004 10.0075 3.75231 9.96296 3.75942C9.72853 3.79686 9.52566 3.94307 9.41601 4.15364C9.39519 4.19363 9.37419 4.24942 9.28302 4.52292L9.18322 4.82234C9.1682 4.86742 9.1565 4.90251 9.14458 4.93548Z" />
                    </g>
                  </svg>
                  Delete
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
    );
  };

  const handleSaveRename = async () => {
    if (!editingConvId) return;
    const idToRename = editingConvId;
    const titleToSave = editTitle.trim();
    setEditingConvId(null);
    if (titleToSave) {
      await renameConversation(idToRename, titleToSave);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveRename();
    } else if (e.key === "Escape") {
      setEditingConvId(null);
    }
  };

  const handleNewChat = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetChat();
    // Use replace to avoid history issues
    router.replace('/');
    closeSidebar();
  };

  const handleConversationClick = (id: string) => {
    router.push(`/chat/${id}`);
    closeSidebar();
  };

  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenMenuId(null);
    const conv = conversations.find(c => c.id === id);
    setDeleteConfirm({ id, title: conv?.title || "this chat" });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    await deleteConversation(deleteConfirm.id);
    setDeleteConfirm(null);
    router.replace('/');
  };

  const handleRename = async () => {
    if (!renameConvId || newTitle.trim() === originalTitle.trim() || newTitle.trim() === "") return;
    const idToRename = renameConvId;
    const titleToSave = newTitle.trim();
    setRenameModalOpen(false);
    await renameConversation(idToRename, titleToSave);
    // Start typewriter effect
    setTypingTitle({ id: idToRename, text: titleToSave, index: 0 });
  };

  // Typewriter effect for renamed title
  useEffect(() => {
    if (typingTitle) {
      const interval = setInterval(() => {
        setTypingTitle(prev => {
          if (!prev || prev.index >= prev.text.length) {
            return null;
          }
          return { ...prev, index: prev.index + 1 };
        });
      }, 30); // Typing speed
      return () => clearInterval(interval);
    }
  }, [typingTitle?.id]);

  if (!hydrated) return null;

  return (
    <motion.div
      initial={false}
      animate={{
        width: isMobile ? 280 : (isOpen ? 280 : 48),
        x: isMobile && !isOpen ? -280 : 0
      }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className={`${isOpen ? 'bg-[#1e1e1e] border-[#1e1e1e]' : 'bg-neutral-900 border-neutral-900'} flex flex-col border-r h-full overflow-visible ${
        isMobile ? 'fixed inset-y-0 left-0 z-50' : 'relative z-30'
      }`}
    >
      <AnimatePresence mode="wait">
        {(isOpen || isMobile) ? (
          <motion.div
            key="open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pl-2 pr-4 py-4 flex flex-col h-full"
          >
            <div>
              <div className="flex items-center gap-2 mb-4 px-2">
                <div className="w-8 h-8 relative flex-shrink-0">
                  <Image
                    src="/logo.png"
                    alt="Scorpio Logo"
                    fill
                    sizes="32px"
                    className="object-contain"
                  />
                </div>
                <span className="text-white text-xs font-medium" style={{ fontFamily: "'Google Sans', system-ui, sans-serif" }}>SCORPEO</span>
                <div className="ml-auto flex items-center gap-1">
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (pathname !== '/search') {
                          router.push('/search');
                        }
                      }}
                      onMouseEnter={() => setSearchTooltipVisible(true)}
                      onMouseLeave={() => setSearchTooltipVisible(false)}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-neutral-700 rounded-full transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                    </button>
                    {searchTooltipVisible && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-100 text-gray-900 text-xs rounded-md whitespace-nowrap z-50 transition-opacity duration-300 ease-in-out opacity-100">
                        Search chats
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setIsSidebarOpen(false)}
                      onMouseEnter={() => setCloseTooltipVisible(true)}
                      onMouseLeave={() => setCloseTooltipVisible(false)}
                      className="w-8 h-8 relative flex items-center justify-center text-gray-400 hover:bg-neutral-700 rounded-full transition-colors group"
                    >
                      {isMobile ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="group-hover:opacity-0 transition-opacity">
                            <path d="M0 0h24v24H0z" fill="none" />
                            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm11-2v16" />
                              <path d="m10 10l-2 2l2 2" />
                            </g>
                          </svg>
                          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <path d="M0 0h24v24H0z" fill="none" />
                            <path fill="currentColor" d="M18 3a3 3 0 0 1 2.995 2.824L21 6v12a3 3 0 0 1-2.824 2.995L18 21H6a3 3 0 0 1-2.995-2.824L3 18V6a3 3 0 0 1 2.824-2.995L6 3zm-3 2H6a1 1 0 0 0-.993.883L5 6v12a1 1 0 0 0 .883.993L6 19h9zm-3.293 4.293a1 1 0 0 1 .083 1.32l-.083.094L10.415 12l1.292 1.293a1 1 0 0 1 .083 1.32l-.083.094a1 1 0 0 1-1.32.083l-.094-.083l-2-2a1 1 0 0 1-.083-1.32l.083-.094l2-2a1 1 0 0 1 1.414 0" />
                          </svg>
                        </>
                      )}
                    </button>
                    {closeTooltipVisible && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-100 text-gray-900 text-xs rounded-md whitespace-nowrap z-50 transition-opacity duration-300 ease-in-out opacity-100">
                        Close sidebar
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleNewChat}
                className={`py-1 px-3 rounded-full text-xs flex items-center gap-3 transition-colors w-full font-normal ${
                  pathname === '/'
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'bg-transparent text-gray-200 hover:bg-zinc-800/50 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" className="brightness-0 invert">
                  <path d="m234.96-292.12-73.66 73.86q-8.11 7.91-18.65 3.88-10.53-4.04-10.53-15.66v-529.77q0-28.21 19.93-48.24t48.33-20.03h479.43q28.21 0 48.24 20.03t20.03 48.24v172.73q0 11.47-8.41 19.27-8.4 7.81-19.86 7.81-11.77 0-19.73-8.07-7.96-8.06-7.96-20.01v-171.73q0-5.19-3.56-8.75-3.56-3.56-8.75-3.56H200.38q-5.38 0-8.84 3.56t-3.46 8.75v411.73h262.88q11.27 0 19.58 8.41 8.31 8.4 8.31 19.86 0 11.77-8.31 19.73-8.31 7.96-19.58 7.96h-216Zm77.35-320h255.38q11.64 0 19.86-8.12 8.22-8.13 8.22-19.77 0-11.64-8.22-19.85-8.22-8.22-19.86-8.22H312.31q-11.64 0-19.76 8.23-8.13 8.22-8.13 19.86 0 11.64 8.13 19.76 8.12 8.11 19.76 8.11Zm0 160h135.38q11.64 0 19.86-8.12 8.22-8.13 8.22-19.77 0-11.64-8.22-19.85-8.22-8.22-19.86-8.22H312.31q-11.64 0-19.76 8.23-8.13 8.22-8.13 19.86 0 11.64 8.13 19.76 8.12 8.11 19.76 8.11Zm379.81 160H600q-11.63 0-19.76-8.12-8.12-8.13-8.12-19.77 0-11.64 8.12-19.85 8.13-8.22 19.76-8.22h92.12V-440q0-11.63 8.12-19.86 8.13-8.22 19.77-8.22 11.64 0 19.85 8.22 8.22 8.23 8.22 19.86v91.92H840q11.63 0 19.86 8.23 8.22 8.22 8.22 19.86 0 11.64-8.22 19.76-8.23 8.11-19.86 8.11h-91.92V-200q0 11.63-8.23 19.76-8.22 8.12-19.86 8.12-11.64 0-19.76-8.12-8.11-8.13-8.11-19.76v-92.12Zm-504.04-55.96v-424.04 424.04Z" />
                </svg>
                <span>New chat</span>
              </button>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto mt-4 pb-2 conversations-list">
              
              {/* Pinned Section */}
              {pinnedConversations.length > 0 && (
                <div>
                  <button
                    onClick={() => setIsPinnedCollapsed(!isPinnedCollapsed)}
                    className="w-full group flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:text-gray-200"
                  >
                    <span>Pinned</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {isPinnedCollapsed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      )}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {!isPinnedCollapsed && (
                      <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                        {pinnedConversations.map(renderConversation)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Recents Section */}
              {recentConversations.length > 0 && (
                <div className="mb-2">
                  <button
                    onClick={() => setIsRecentsCollapsed(!isRecentsCollapsed)}
                    className="w-full group flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:text-gray-200"
                  >
                    <span>Recents</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {isRecentsCollapsed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      )}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {!isRecentsCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {recentConversations.map(renderConversation)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="closed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-12 p-2 flex flex-col h-full justify-between"
          >
            <div className="flex flex-col items-center">
              <button
                onClick={() => setIsSidebarOpen(true)}
                onMouseEnter={() => setOpenTooltipVisible(true)}
                onMouseLeave={() => setOpenTooltipVisible(false)}
                className="w-8 h-8 relative flex items-center justify-center text-gray-400 hover:bg-neutral-700 rounded-full transition-colors group"
                title="Open sidebar"
              >
                <Image src="/logo.png" alt="Logo" fill sizes="32px" className="object-contain group-hover:opacity-0 transition-opacity" />
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  <path d="M0 0h24v24H0z" fill="none" />
                  <path fill="currentColor" d="M18 3a3 3 0 0 1 2.995 2.824L21 6v12a3 3 0 0 1-2.824 2.995L18 21H6a3 3 0 0 1-2.995-2.824L3 18V6a3 3 0 0 1 2.824-2.995L6 3zm0 2H9v14h9a1 1 0 0 0 .993-.883L19 18V6a1 1 0 0 0-.883-.993zm-4.387 4.21l.094.083l2 2a1 1 0 0 1 .083 1.32l-.083.094l-2 2a1 1 0 0 1-1.497-1.32l.083-.094L13.585 12l-1.292-1.293a1 1 0 0 1-.083-1.32l.083-.094a1 1 0 0 1 1.32-.083" />
                </svg>
                {openTooltipVisible && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-100 text-gray-900 text-xs rounded-md whitespace-nowrap z-50 transition-opacity duration-300 ease-in-out opacity-100">
                    Open sidebar
                  </div>
                )}
              </button>
              <button
                onClick={handleNewChat}
                className="w-8 h-8 flex items-center justify-center hover:bg-neutral-800 rounded transition-colors mt-2"
                title="New Chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="m234.96-292.12-73.66 73.86q-8.11 7.91-18.65 3.88-10.53-4.04-10.53-15.66v-529.77q0-28.21 19.93-48.24t48.33-20.03h479.43q28.21 0 48.24 20.03t20.03 48.24v172.73q0 11.47-8.41 19.27-8.4 7.81-19.86 7.81-11.77 0-19.73-8.07-7.96-8.06-7.96-20.01v-171.73q0-5.19-3.56-8.75-3.56-3.56-8.75-3.56H200.38q-5.38 0-8.84 3.56t-3.46 8.75v411.73h262.88q11.27 0 19.58 8.41 8.31 8.4 8.31 19.86 0 11.77-8.31 19.73-8.31 7.96-19.58 7.96h-216Zm77.35-320h255.38q11.64 0 19.86-8.12 8.22-8.13 8.22-19.77 0-11.64-8.22-19.85-8.22-8.22-19.86-8.22H312.31q-11.64 0-19.76 8.23-8.13 8.22-8.13 19.86 0 11.64 8.13 19.76 8.12 8.11 19.76 8.11Zm0 160h135.38q11.64 0 19.86-8.12 8.22-8.13 8.22-19.77 0-11.64-8.22-19.85-8.22-8.22-19.86-8.22H312.31q-11.64 0-19.76 8.23-8.13 8.22-8.13 19.86 0 11.64 8.13 19.76 8.12 8.11 19.76 8.11Zm379.81 160H600q-11.63 0-19.76-8.12-8.12-8.13-8.12-19.77 0-11.64 8.12-19.85 8.13-8.22 19.76-8.22h92.12V-440q0-11.63 8.12-19.86 8.13-8.22 19.77-8.22 11.64 0 19.85 8.22 8.22 8.23 8.22 19.86v91.92H840q11.63 0 19.86 8.23 8.22 8.22 8.22 19.86 0 11.64-8.22 19.76-8.23 8.11-19.86 8.11h-91.92V-200q0 11.63-8.23 19.76-8.22 8.12-19.86 8.12-11.64 0-19.76-8.12-8.11-8.13-8.11-19.76v-92.12Zm-504.04-55.96v-424.04 424.04Z" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setIsSidebarOpen(true);
                  if (pathname !== '/search') {
                    router.push('/search');
                  }
                }}
                className={`w-8 h-8 flex items-center justify-center hover:bg-neutral-800 rounded transition-colors mt-2 ${
                  pathname === '/search' ? 'bg-neutral-800' : ''
                }`}
                title="Search chats"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={pathname === '/search' ? "text-white" : "text-gray-400"}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-neutral-800 rounded-2xl w-[500px] max-w-[90vw] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <h2 className="text-white text-lg font-semibold mb-2">Delete chat?</h2>
                <p className="text-gray-300 text-sm mb-6">
                  This will delete <strong className="text-white">{deleteConfirm.title}</strong> and all its messages.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-neutral-700 hover:bg-neutral-600 rounded-full transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-transparent border border-neutral-600 hover:bg-neutral-700 rounded-full transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Modal */}
      <AnimatePresence>
        {renameModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center"
            onClick={() => setRenameModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="bg-neutral-800 rounded-2xl shadow-2xl p-6 w-96"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-white text-lg font-medium mb-4">Rename this chat</h2>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename();
                  } else if (e.key === "Escape") {
                    setRenameModalOpen(false);
                  }
                }}
                className="w-full bg-neutral-900 text-white text-sm px-4 py-3 rounded-lg outline-none focus:outline-none transition-colors"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setRenameModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-neutral-700 hover:bg-neutral-600 rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRename}
                  disabled={newTitle.trim() === originalTitle.trim() || newTitle.trim() === ""}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                    newTitle.trim() !== originalTitle.trim() && newTitle.trim() !== ""
                      ? "bg-white text-black hover:bg-gray-200"
                      : "bg-neutral-700 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Rename
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}