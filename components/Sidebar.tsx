"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";

interface SidebarProps {
  onLoginClick: () => void;
}

export default function Sidebar({ onLoginClick }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isRecentsCollapsed, setIsRecentsCollapsed] = useState(false);
  const [isPinnedCollapsed, setIsPinnedCollapsed] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const convMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut, authLoading } = useAuth();
  const { conversations, currentConversation, selectConversation, resetChat, deleteConversation, renameConversation, togglePinConversation, isSending } = useChat();

  const pinnedConversations = Array.isArray(conversations) ? conversations.filter(c => c.is_pinned) : [];
  const recentConversations = Array.isArray(conversations) ? conversations.filter(c => !c.is_pinned) : [];

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Profile menu logic
      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
      
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

  const renderConversation = (conv: any) => (
    <div 
      key={conv.id} 
      className={`group relative flex items-center justify-between rounded-lg transition-colors p-1 ${
        currentConversation?.id === conv.id
          ? "bg-neutral-800 text-white"
          : "text-white hover:bg-neutral-800"
      }`}
    >
      {editingConvId === conv.id ? (
        <input
          ref={inputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveRename}
          className="flex-1 bg-neutral-800 text-sm text-white outline-none border border-neutral-600 rounded px-2 py-1"
          autoFocus
        />
      ) : (
        <button
          onClick={() => handleConversationClick(conv.id)}
          className="flex-1 text-left text-sm flex items-center gap-1.5 overflow-hidden"
          title={conv.title || ""}
        >
          {conv.is_pinned && (
            <Image 
              src="/quickreply.svg" 
              alt="Pinned" 
              width={16} 
              height={16} 
              className="flex-shrink-0"
            />
          )}
          {conv.title ? (
            <span className="truncate">{conv.title}</span>
          ) : (
            <div className="flex items-center gap-1">
              <div className="h-3 w-16 bg-neutral-700 rounded animate-pulse" />
            </div>
          )}
        </button>
      )}
      <div className="flex-shrink-0 z-50">
        <button
          data-menu-toggle={conv.id}
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenuId(openMenuId === conv.id ? null : conv.id);
          }}
          className={`p-1 text-gray-400 hover:text-white transition-all rounded-md hover:bg-neutral-700 ${
            openMenuId === conv.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          title="Options"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"/>
            <circle cx="19" cy="12" r="1"/>
            <circle cx="5" cy="12" r="1"/>
          </svg>
        </button>
        
        <AnimatePresence>
          {openMenuId === conv.id && (
            <div ref={convMenuRef}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                style={{ zIndex: 9999 }}
                className="absolute right-0 top-full mt-1 w-40 bg-[#2f2f2f] border border-[#404040] rounded-xl shadow-xl overflow-hidden py-1.5"
              >
                <button
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#404040] transition-colors flex items-center gap-2.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingConvId(conv.id);
                    setEditTitle(conv.title || "");
                    setOpenMenuId(null);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                  </svg>
                  Rename
                </button>
                
                <button
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#404040] transition-colors flex items-center gap-2.5"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setOpenMenuId(null);
                    await togglePinConversation(conv.id, !conv.is_pinned);
                  }}
                >
                  {conv.is_pinned ? (
                    <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor" className="text-gray-400">
                      <path d="M680-840v80h-40v327l-80-80v-247H400v87l-87-87-33-33v-47h400ZM480-40l-40-40v-240H240v-80l80-80v-46L56-792l56-56 736 736-58 56-264-264h-6v240l-40 40ZM354-400h92l-44-44-2-2-46 46Zm126-193Zm-78 149Z"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor" className="text-gray-400 rotate-45">
                      <path d="m640-480 80 80v80H520v240l-40 40-40-40v-240H240v-80l80-80v-280h-40v-80h400v80h-40v280Zm-286 80h252l-46-46v-314H400v314l-46 46Zm126 0Z"/>
                    </svg>
                  )}
                  {conv.is_pinned ? "Unpin chat" : "Pin chat"}
                </button>
                
                <div className="h-[1px] bg-[#404040] my-1 mx-2" />
  
                <button
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  className="w-full text-left px-3 py-2 text-sm text-[#ff6b6b] hover:bg-[#404040] transition-colors flex items-center gap-2.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
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
  };

  const handleConversationClick = (id: string) => {
    router.push(`/chat/${id}`);
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

  return (
    <motion.div
      initial={false}
      animate={{ width: isOpen ? 280 : 48 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="bg-black flex flex-col border-r border-neutral-800 h-full"
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pl-2 pr-4 py-4 flex flex-col h-full"
          >
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 relative">
                  <Image
                    src="/logo.png"
                    alt="Scorpio Logo"
                    fill
                    sizes="32px"
                    className="object-contain"
                  />
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="ml-auto w-6 h-6 flex items-center justify-center hover:bg-neutral-800 rounded transition-colors"
                  title="Close sidebar"
                >
                  <Image src="/close.svg" alt="Close" width={16} height={16} />
                </button>
              </div>

              <button 
                onClick={handleNewChat}
                className={`p-3 rounded-lg text-left text-sm flex items-center gap-2 transition-colors w-full ${
                  pathname === '/' 
                    ? 'bg-neutral-800 text-white' 
                    : 'hover:bg-neutral-800/50 text-white'
                }`}
              >
                <Image src="/newchat.svg" alt="New Chat" width={16} height={16} />
                New Chat
              </button>

              <button 
                onClick={() => {
                  if (pathname !== '/search') {
                    router.push('/search');
                  }
                }}
                className={`p-3 rounded-lg text-left text-sm flex items-center gap-2 transition-colors w-full ${
                  pathname === '/search' 
                    ? 'bg-neutral-800 text-white' 
                    : 'hover:bg-neutral-800/50 text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                Search chats
              </button>

              <button 
                onClick={() => {
                  if (pathname !== '/library') {
                    router.push('/library');
                  }
                }}
                className={`p-3 rounded-lg text-left text-sm flex items-center gap-2 transition-colors w-full ${
                  pathname === '/library' 
                    ? 'bg-neutral-800 text-white' 
                    : 'hover:bg-neutral-800/50 text-white'
                }`}
              >
                <div className="w-4 h-4 relative">
                  <Image src="/library.svg" alt="Library" fill className="object-contain" />
                </div>
                Library
              </button>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto mt-4 pb-2">
              
              {/* Pinned Section */}
              {pinnedConversations.length > 0 && (
                <div>
                  <button
                    onClick={() => setIsPinnedCollapsed(!isPinnedCollapsed)}
                    className="w-full group flex items-center gap-1 px-2 py-1 text-xs font-semibold transition-colors"
                  >
                    <span className="text-white">Pinned</span>
                    <span className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    className="w-full group flex items-center gap-1 px-2 py-1 text-xs font-semibold transition-colors"
                  >
                    <span className="text-white">Recents</span>
                    <span className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
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

            <div className="mt-auto pt-4 border-t border-neutral-800">
              {authLoading ? (
                <div className="flex items-center gap-1.5 p-1">
                  <div className="w-5 h-5 rounded-full bg-neutral-800 animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-16 bg-neutral-800 rounded animate-pulse" />
                    <div className="h-2 w-8 bg-neutral-800 rounded animate-pulse" />
                  </div>
                </div>
              ) : user ? (
                <div ref={menuRef} className="relative">
                  <motion.div 
                    className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                  >
                    <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                      <Image
                        src={user.photoURL}
                        alt={user.displayName}
                        width={20}
                        height={20}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-xs font-semibold text-white truncate">{user.displayName}</span>
                      <span className="text-[10px] text-gray-400 font-light">Free</span>
                    </div>
                  </motion.div>
                  
                  {/* Profile Popup Menu */}
                  {showProfileMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute left-0 bottom-full mb-2 w-64 bg-neutral-800 rounded-xl shadow-2xl border border-neutral-700 overflow-hidden z-50"
                    >
                      {/* User Header */}
                      <div className="p-3 border-b border-neutral-700">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-600 flex items-center justify-center">
                            {user.photoURL ? (
                              <Image
                                src={user.photoURL}
                                alt={user.displayName}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-white">
                                {user.displayName?.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-white block truncate">{user.displayName}</span>
                            <span className="text-xs text-gray-400">Free</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Menu Items */}
                      <div className="py-1">
                        <button className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-white hover:bg-neutral-700 transition-colors text-left">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                          Upgrade for free
                        </button>
                        <div className="border-t border-neutral-700 my-1" />
                        <button className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-white hover:bg-neutral-700 transition-colors text-left">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 2a7 7 0 1 0 10 10"/>
                          </svg>
                          Personalization
                        </button>
                        <button className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-white hover:bg-neutral-700 transition-colors text-left">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          Profile
                        </button>
                        <button className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-white hover:bg-neutral-700 transition-colors text-left">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1.05 1.75l-.34.2a2 2 0 0 1-2.18 0l-.34-.2a2 2 0 0 1-1.05-1.75V4a2 2 0 0 0-2-2h-.44a2 2 0 0 0-2 2v3.38a2 2 0 0 0 1.05 1.75l.34.2a2 2 0 0 1 0 2.18l-.34.2a2 2 0 0 0-1.05 1.75V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1.05-1.75l.34-.2a2 2 0 0 1 2.18 0l.34.2a2 2 0 0 1 1.05 1.75V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-3.38a2 2 0 0 0-1.05-1.75l-.34-.2a2 2 0 0 1 0-2.18l.34-.2a2 2 0 0 0 1.05-1.75V4a2 2 0 0 0-2-2z"/>
                          </svg>
                          Settings
                        </button>
                        <div className="border-t border-neutral-700 my-1" />
                        <button className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-white hover:bg-neutral-700 transition-colors text-left">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 6"/>
                            <path d="M12 17h.01"/>
                          </svg>
                          Help
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 ml-auto">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                        <button 
                          onClick={() => { signOut(); setShowProfileMenu(false); }}
                          className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-white hover:bg-neutral-700 transition-colors text-left"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                          </svg>
                          Log out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                <>
                  <button 
                    onClick={onLoginClick}
                    className="w-full bg-white hover:bg-gray-100 p-3 rounded-full text-sm text-black font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Log in
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-2">get more features</p>
                </>
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
                onClick={() => setIsOpen(true)}
                className="w-8 h-8 relative flex items-center justify-center hover:bg-neutral-800 rounded transition-colors group"
                title="Open sidebar"
              >
                <Image src="/logo.png" alt="Logo" fill className="object-contain group-hover:opacity-0 transition-opacity" />
                <Image 
                  src="/open.svg" 
                  alt="Open" 
                  width={20} 
                  height={20} 
                  className="absolute inset-0 m-auto opacity-0 group-hover:opacity-100" 
                />
              </button>
              <button
                onClick={handleNewChat}
                className="w-8 h-8 flex items-center justify-center hover:bg-neutral-800 rounded transition-colors mt-2"
                title="New Chat"
              >
                <Image src="/newchat.svg" alt="New Chat" width={16} height={16} />
              </button>
              <button
                onClick={() => {
                  setIsOpen(true);
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
            {authLoading ? (
              <div className="w-6 h-6 rounded-full bg-neutral-800 animate-pulse mb-1" />
            ) : user && (
              <motion.div 
                className="w-6 h-6 rounded-full overflow-hidden mb-1"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Image
                  src={user.photoURL}
                  alt={user.displayName}
                  width={24}
                  height={24}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            )}
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
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-[#2f2f2f] rounded-2xl w-[400px] max-w-[90vw] shadow-2xl border border-[#404040] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-white text-lg font-semibold mb-2">Delete chat?</h2>
                <p className="text-gray-300 text-sm mb-1">
                  This will delete <strong className="text-white">{deleteConfirm.title}</strong>.
                </p>
                <p className="text-gray-400 text-sm">
                  Your conversation with Scorpio will be deleted.
                </p>
              </div>
              <div className="flex justify-end gap-2 px-6 pb-5">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-neutral-700 rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#dc2626] hover:bg-[#b91c1c] rounded-full transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
