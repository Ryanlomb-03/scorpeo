"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import LibraryPopup from "@/components/LibraryPopup";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPopup, setShowPopup] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [sortColumn, setSortColumn] = useState<'name' | 'modified' | 'size' | null>(null);
  const [sortDirection, setSortDirection] = useState<Record<'name' | 'modified' | 'size', 'asc' | 'desc'>>({
    name: 'asc',
    modified: 'asc',
    size: 'asc'
  });
  const [filterType, setFilterType] = useState<'all' | 'images' | 'files'>('all');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [noteName, setNoteName] = useState('Untitled');
  const [noteContent, setNoteContent] = useState('');
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [currentNoteFile, setCurrentNoteFile] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [showAiReview, setShowAiReview] = useState(false);
  const [originalNoteContent, setOriginalNoteContent] = useState("");
  const [isAiInputScrolledTop, setIsAiInputScrolledTop] = useState(false);
  const [isAiInputScrolledBottom, setIsAiInputScrolledBottom] = useState(false);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { isMobile, setIsSidebarOpen } = useSidebar();

  const handleAiWrite = async () => {
    if (!aiInput.trim() || isAiProcessing || showAiReview) return;
    
    setIsAiProcessing(true);
    setOriginalNoteContent(noteContent);
    const instruction = aiInput;
    
    try {
      const response = await fetch('/api/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent, instruction }),
      });
      
      const result = await response.json();
      
      if (!isAiProcessing) return; 

      if (result.improved) {
        setNoteContent(result.improved);
        setShowAiReview(true);
        setAiInput("");
      } else {
        throw new Error(result.error || "API_ERROR");
      }
    } catch (error) {
      console.error("AI writing failed:", error);
      // No simulation fallback here anymore - we want the real thing.
      // If there's a genuine error, we notify the user.
      if (isAiProcessing) {
        alert("The AI had trouble connecting. Please try again.");
      }
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleStopAi = () => {
    setIsAiProcessing(false);
  };

  const handleAcceptChanges = async () => {
    if (!currentNoteFile) return;

    try {
      // Save changes to database
      const response = await fetch('/api/library/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: currentNoteFile.id,
          content: noteContent
        }),
      });

      if (response.ok) {
        // Update local state
        setUploadedFiles(prev => prev.map(f => 
          f.id === currentNoteFile.id ? { ...f, fileData: noteContent } : f
        ));
        setShowAiReview(false);
        setAiInput("");
      } else {
        console.error('Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
    }
  };

  const handleDeclineChanges = () => {
    setNoteContent(originalNoteContent);
    setShowAiReview(false);
    setAiInput("");
  };

  useEffect(() => {
    // Check if user has seen the library popup before
    const hasSeenPopup = localStorage.getItem("libraryPopupSeen");
    if (!hasSeenPopup) {
      setShowPopup(true);
    }
  }, []);

  useEffect(() => {
    if (showNotePopup && noteInputRef.current) {
      noteInputRef.current.select();
    }
  }, [showNotePopup]);

  useEffect(() => {
    // Read URL query parameter for filter type
    const tab = searchParams.get('tab');
    if (tab === 'images' || tab === 'files' || tab === 'all') {
      setFilterType(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!user) return;
      
      setIsLoadingFiles(true);
      try {
        const response = await fetch(`/api/library/files?userId=${user.uid}`);
        const data = await response.json();
        
        if (data.success) {
          setUploadedFiles(data.files);
        }
      } catch (error) {
        console.error('Fetch files error:', error);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    fetchFiles();
  }, [user]);

  useEffect(() => {
    if (searchQuery.length > 0) {
      setIsSearching(true);
      // Simulate search delay
      const timer = setTimeout(() => {
        setIsSearching(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const getSearchResults = () => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return getFilteredFiles().filter(file => 
      file.name.toLowerCase().includes(query)
    );
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-500/30 text-white px-1 rounded">$1</mark>');
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const toggleAllFiles = () => {
    const currentFiles = getFilteredFiles();
    if (selectedFiles.size === currentFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(currentFiles.map(f => f.id)));
    }
  };

  const handleDownload = async () => {
    const selectedFilesList = getFilteredFiles().filter(file => selectedFiles.has(file.id));
    console.log('Selected files for download:', selectedFilesList);
    
    if (selectedFilesList.length === 0) {
      console.error('No files selected for download');
      return;
    }
    
    selectedFilesList.forEach(async (file, index) => {
      try {
        console.log(`Downloading file ${index + 1}:`, file.name);
        
        // Fetch file from download API
        const response = await fetch(`/api/library/files?fileId=${file.id}`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          console.error('Failed to download file:', file.name, response.statusText);
          return;
        }
        
        // Get blob from response
        const blob = await response.blob();
        console.log('Blob created, size:', blob.size);
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.style.display = 'none';
        document.body.appendChild(link);
        
        // Trigger download
        setTimeout(() => {
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log('Download triggered for:', file.name);
        }, 100 * index); // Stagger downloads for multiple files
      } catch (error) {
        console.error('Error downloading file:', file.name, error);
      }
    });
  };

  const handleDelete = async () => {
    const selectedFilesList = getFilteredFiles().filter(file => selectedFiles.has(file.id));
    
    try {
      // Delete from database
      const deletePromises = selectedFilesList.map(file => 
        fetch(`/api/library/files?fileId=${file.id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);
      
      // Remove from UI
      setUploadedFiles(prev => prev.filter(file => !selectedFiles.has(file.id)));
      setSelectedFiles(new Set());
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting files:', error);
    }
  };

  const handleCreateNote = async () => {
    const fileName = `${noteName}.md`;
    const content = '';
    
    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/markdown' });
      formData.append('file', blob, fileName);
      formData.append('userId', user?.uid || '');
      
      const response = await fetch('/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        const newFile = {
          id: data.file.id,
          name: fileName,
          type: 'text/markdown',
          size: data.file.size,
          mimeType: 'text/markdown',
          userId: user?.uid,
          createdAt: data.file.createdAt,
          fileData: content,
        };
        
        setUploadedFiles(prev => [newFile, ...prev]);
        setCurrentNoteFile(newFile);
        setShowNotePopup(false);
        setShowNoteEditor(true);
        setNoteContent('');
      }
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const JellyCheckbox = ({ id, checked, onChange, indeterminate }: { id: string, checked: boolean, onChange: () => void, indeterminate?: boolean }) => {
    return (
      <div className="jelly-checkbox-wrapper">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          style={{ display: 'none' }}
        />
        <label 
          htmlFor={id}
          className="jelly-checkbox-label"
          style={{
            position: 'relative',
            top: '1px',
            width: '18px',
            height: '18px',
            border: '1px solid #6b7280',
            borderRadius: '3px',
            verticalAlign: 'middle',
            transition: 'background 0.1s ease',
            cursor: 'pointer',
            display: 'block',
            backgroundColor: checked || indeterminate ? '#ffffff' : '#000000',
            borderColor: '#6b7280'
          }}
        >
          {checked && !indeterminate && (
            <span style={{
              position: 'absolute',
              top: '2px',
              left: '5px',
              width: '5px',
              height: '10px',
              borderRight: '2px solid #000',
              borderBottom: '2px solid #000',
              transform: 'rotate(45deg)'
            }} />
          )}
          {indeterminate && (
            <span style={{
              position: 'absolute',
              top: '7px',
              left: '4px',
              width: '10px',
              height: '2px',
              backgroundColor: '#000'
            }} />
          )}
        </label>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes jelly {
              from { transform: scale(1, 1); }
              30% { transform: scale(1.25, 0.75); }
              40% { transform: scale(0.75, 1.25); }
              50% { transform: scale(1.15, 0.85); }
              65% { transform: scale(0.95, 1.05); }
              75% { transform: scale(1.05, 0.95); }
              to { transform: scale(1, 1); }
            }
            .jelly-checkbox-wrapper input:checked ~ .jelly-checkbox-label {
              animation: jelly 0.6s ease;
            }
          `
        }} />
      </div>
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', user.uid);

    try {
      const response = await fetch('/api/library/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadedFiles([...uploadedFiles, data.file]);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }
  };

  const isImageFile = (fileType: string) => {
    return fileType.startsWith('image/') || fileType === 'image/svg+xml';
  };

  const getFileIcon = (file: any) => {
    console.log('getFileIcon called for:', file.name, 'type:', file.type, 'has fileData:', !!file.fileData);
    
    if (isImageFile(file.type) && file.fileData) {
      console.log('Rendering image for:', file.name);
      return (
        <div className="w-8 h-8 bg-neutral-700 rounded flex items-center justify-center overflow-hidden">
          <img 
            src={`data:${file.mimeType};base64,${file.fileData}`} 
            alt={file.name} 
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error('Image failed to load for:', file.name, e);
              // Fallback to file icon if image fails to load
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              `;
            }}
          />
        </div>
      );
    }
    console.log('Rendering file icon for:', file.name);
    return (
      <div className="w-8 h-8 bg-neutral-700 rounded flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
    );
  };

  const handleSort = (column: 'name' | 'modified' | 'size') => {
    setSortColumn(column);
    setSortDirection((prev: Record<'name' | 'modified' | 'size', 'asc' | 'desc'>) => ({
      ...prev,
      [column]: prev[column] === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedFiles = () => {
    if (!sortColumn) return uploadedFiles;

    const sorted = [...uploadedFiles].sort((a, b) => {
      if (sortColumn === 'name') {
        return sortDirection[sortColumn] === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (sortColumn === 'modified') {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortDirection[sortColumn] === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortColumn === 'size') {
        return sortDirection[sortColumn] === 'asc' ? a.size - b.size : b.size - a.size;
      }
      return 0;
    });

    return sorted;
  };

  const getFilteredFiles = () => {
    const sorted = getSortedFiles();
    
    if (filterType === 'all') return sorted;
    if (filterType === 'images') return sorted.filter(file => isImageFile(file.type));
    if (filterType === 'files') return sorted.filter(file => !isImageFile(file.type));
    
    return sorted;
  };

  const handlePopupClose = () => {
    setShowPopup(false);
    localStorage.setItem("libraryPopupSeen", "true");
  };

  return (
    <>
      <div className={`flex-1 bg-black overflow-y-auto ${showNoteEditor && currentNoteFile ? '' : 'flex items-center justify-center p-8'}`}>
        {showNoteEditor && currentNoteFile ? (
          <div className="w-full h-full flex flex-col relative">
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-neutral-800 transition-opacity ${isAiProcessing || showAiReview ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => !isAiProcessing && !showAiReview && setShowNoteEditor(false)}
                  disabled={isAiProcessing || showAiReview}
                  className={`text-white hover:text-gray-300 transition-colors ${isAiProcessing || showAiReview ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <span className="text-white text-sm font-medium">{currentNoteFile.name.replace('.md', '')}</span>
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(noteContent);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-white hover:text-gray-300 transition-colors"
              >
                {copied ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Editor area */}
            <div className="flex-1 flex flex-col bg-neutral-800 relative overflow-hidden">
              {isAiProcessing && (
                <div 
                  className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
                  onClick={(e) => e.stopPropagation()} 
                >
                  <div className="flex flex-col items-center gap-4 bg-[#1a1a1a] p-8 rounded-3xl border border-neutral-700 shadow-2xl">
                    <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-white font-medium text-lg">Scorpio AI is writing...</span>
                      <span className="text-gray-400 text-sm text-center px-4">Creating your document with Minimax m2.7</span>
                    </div>
                    <button 
                      onClick={handleStopAi}
                      className="mt-2 px-8 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-semibold rounded-full border border-neutral-700 transition-all active:scale-95"
                    >
                      Stop writing
                    </button>
                  </div>
                </div>
              )}
              
              {showAiReview && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex bg-[#2a2a2a] rounded-full overflow-hidden shadow-2xl border border-neutral-700/50">
                  <button 
                    onClick={handleDeclineChanges}
                    className="px-6 py-2.5 text-sm text-gray-300 hover:bg-neutral-700 transition-colors font-medium border-r border-neutral-700/50"
                  >
                    Undo
                  </button>
                  <button 
                    onClick={handleAcceptChanges}
                    className="px-6 py-2.5 text-sm bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium"
                  >
                    Accept
                  </button>
                </div>
              )}
              
              <textarea
                value={noteContent}
                onChange={(e) => !isAiProcessing && !showAiReview && setNoteContent(e.target.value)}
                placeholder="Write anything..."
                className={`w-full h-full bg-transparent text-gray-300 text-base resize-none focus:outline-none placeholder-gray-500 text-left leading-relaxed p-8 ${isAiProcessing || showAiReview ? 'opacity-30' : ''}`}
                style={{ cursor: isAiProcessing || showAiReview ? 'not-allowed' : 'text' }}
                readOnly={isAiProcessing || showAiReview}
                spellCheck={false}
              />
            </div>
            
            {/* Chat pill at bottom */}
            <div className="flex items-center justify-center px-8 py-4 bg-neutral-800">
              <div className={`flex items-end justify-between backdrop-blur-sm rounded-3xl px-4 py-3 w-full max-w-4xl shadow-lg transition-all duration-300 ${isAiProcessing || showAiReview ? 'bg-neutral-800 border border-neutral-700 opacity-40' : 'bg-neutral-800 border border-neutral-700'}`}>
                <textarea
                  value={aiInput}
                  onChange={(e) => {
                    setAiInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                    setIsAiInputScrolledTop(e.target.scrollTop > 0);
                    setIsAiInputScrolledBottom(Math.ceil(e.target.scrollTop + e.target.clientHeight) < e.target.scrollHeight - 1);
                  }}
                  onScroll={(e) => {
                    const target = e.currentTarget;
                    setIsAiInputScrolledTop(target.scrollTop > 0);
                    setIsAiInputScrolledBottom(Math.ceil(target.scrollTop + target.clientHeight) < target.scrollHeight - 1);
                  }}
                  readOnly={isAiProcessing || showAiReview}
                  placeholder="Describe edits"
                  rows={1}
                  className={`flex-1 bg-transparent text-white placeholder-gray-500 text-base focus:outline-none resize-none overflow-visible leading-6 scrollbar-thin scrollbar-thumb-neutral-600 min-h-[32px] py-1 ${isAiProcessing || showAiReview ? 'cursor-not-allowed' : ''}`}
                  style={{
                    maskImage: isAiInputScrolledTop && isAiInputScrolledBottom
                      ? 'linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)'
                      : isAiInputScrolledTop
                      ? 'linear-gradient(to bottom, transparent 0, black 16px)'
                      : isAiInputScrolledBottom
                      ? 'linear-gradient(to bottom, black 0, black calc(100% - 16px), transparent 100%)'
                      : 'none',
                    WebkitMaskImage: isAiInputScrolledTop && isAiInputScrolledBottom
                      ? 'linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)'
                      : isAiInputScrolledTop
                      ? 'linear-gradient(to bottom, transparent 0, black 16px)'
                      : isAiInputScrolledBottom
                      ? 'linear-gradient(to bottom, black 0, black calc(100% - 16px), transparent 100%)'
                      : 'none',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAiWrite();
                    }
                  }}
                />
                {isAiProcessing ? (
                  <button 
                    onClick={handleStopAi}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white transition-colors shrink-0 shadow-sm"
                  >
                    <div className="w-2.5 h-2.5 bg-black rounded-sm"></div>
                  </button>
                ) : (
                  <button 
                    onClick={handleAiWrite}
                    disabled={!aiInput.trim() || showAiReview}
                    className={`w-8 h-8 flex items-center justify-center rounded-full bg-white text-black transition-colors shrink-0 shadow-sm ${!aiInput.trim() || showAiReview ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-200'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            {/* Top Navigation Bar */}
            <div className="p-3 sm:p-4 flex items-center gap-3 w-full">
              {isMobile && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-neutral-800 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
              )}
              {isMobile && (
                <h1 className="text-white text-lg font-semibold" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
                  Scorpio
                </h1>
              )}
            </div>

            <div className="max-w-4xl mx-auto w-full px-4 sm:px-0">
            {/* Header */}
            <div className="flex flex-col mb-8 mt-4 sm:mt-0">
            <div className="flex items-center justify-between w-full mb-4">
              <h1 className="text-white text-3xl font-light">Library</h1>
              <div className="flex items-center gap-4">
                {/* Search bar */}
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search library"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neutral-700 w-48"
                  />
                </div>
                {/* New dropdown button */}
                <div className="relative">
                  <button 
                    onClick={() => setShowNewMenu(!showNewMenu)}
                    className="bg-white text-black font-medium px-4 py-2 rounded-full text-sm hover:bg-gray-200 transition-colors flex items-center gap-2"
                  >
                    New
                    <svg className={`w-4 h-4 transition-transform ${showNewMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Dropdown menu */}
                  {showNewMenu && (
                    <div className="absolute top-full mt-2 right-0 bg-neutral-900 border border-neutral-700 rounded-lg py-2 w-40 z-50">
                      <button 
                        onClick={() => {
                          setShowNewMenu(false);
                          document.getElementById('dropdown-file-upload')?.click();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-neutral-800 flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload
                      </button>
                      <button 
                        onClick={() => {
                          setShowNewMenu(false);
                          setShowNotePopup(true);
                          setNoteName('Untitled');
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-neutral-800 flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Note
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {selectedFiles.size > 0 ? (
              <div className="flex gap-2">
                <button onClick={handleDownload} className="bg-white text-black font-medium px-4 py-2 rounded-full text-sm hover:bg-gray-200 transition-colors">
                  Download
                </button>
                <button onClick={() => setShowDeleteConfirm(true)} className="bg-red-500 text-white font-medium px-4 py-2 rounded-full text-sm hover:bg-red-600 transition-colors">
                  Delete
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFilterType('all');
                    router.push('/library', { scroll: false });
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filterType === 'all'
                      ? 'bg-white text-black'
                      : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => {
                    setFilterType('images');
                    router.push('/library?tab=images', { scroll: false });
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filterType === 'images'
                      ? 'bg-white text-black'
                      : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                  }`}
                >
                  Images
                </button>
                <button
                  onClick={() => {
                    setFilterType('files');
                    router.push('/library?tab=files', { scroll: false });
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filterType === 'files'
                      ? 'bg-white text-black'
                      : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                  }`}
                >
                  Files
                </button>
              </div>
            )}
          </div>
          
          {/* Hidden file input for dropdown upload */}
          <input
            type="file"
            id="dropdown-file-upload"
            className="hidden"
            onChange={handleFileUpload}
          />
          
          {/* Central Drop Zone Area */}
          {/* Central Drop Zone Area */}
          {searchQuery.length > 0 ? (
            <div className="w-full">
              {/* Table Header */}
              <div className="flex items-center px-4 py-3 border-b border-neutral-700 group">
                <div className={`w-8 flex items-center justify-center transition-opacity ${selectedFiles.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <JellyCheckbox 
                    id="search-select-all"
                    checked={getSearchResults().length > 0 && selectedFiles.size === getSearchResults().length}
                    indeterminate={selectedFiles.size > 0 && selectedFiles.size < getSearchResults().length}
                    onChange={() => {
                      const searchResults = getSearchResults();
                      if (selectedFiles.size === searchResults.length) {
                        setSelectedFiles(new Set());
                      } else {
                        setSelectedFiles(new Set(searchResults.map(f => f.id)));
                      }
                    }}
                  />
                </div>
                <div className="flex-1 text-gray-400 text-sm font-medium">Name</div>
                <div className="flex-1 text-gray-400 text-sm font-medium">Modified</div>
                <div className="flex-1 text-gray-400 text-sm font-medium">Size</div>
              </div>
              
              {/* Search Results */}
              {isSearching ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center px-4 py-4 border-b border-neutral-800">
                    <div className="w-8"></div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="w-8 h-8 bg-neutral-700 rounded animate-pulse"></div>
                      <div className="h-4 bg-neutral-700 rounded w-32 animate-pulse"></div>
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-neutral-700 rounded-full w-24 animate-pulse"></div>
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-neutral-700 rounded-full w-16 animate-pulse"></div>
                    </div>
                  </div>
                ))
              ) : getSearchResults().length > 0 ? (
                getSearchResults().map((file) => (
                  <div 
                    key={file.id} 
                    className="flex items-center px-4 py-4 border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors group cursor-pointer"
                    onClick={() => {
                      if (!isImageFile(file.type)) {
                        setCurrentNoteFile(file);
                        // Safety check for Buffer JSON or Hex strings
                        let content = file.fileData || '';
                        if (typeof content === 'string') {
                          if (content.startsWith('{"type":"Buffer"')) {
                            try {
                              const parsed = JSON.parse(content);
                              content = String.fromCharCode.apply(null, parsed.data);
                            } catch (e) {}
                          } else if (content.startsWith('\\x')) {
                            try {
                              const hex = content.replace(/^\\x/, '');
                              content = hex.match(/.{1,2}/g)?.map(byte => String.fromCharCode(parseInt(byte, 16))).join('') || '';
                            } catch (e) {}
                          }
                        }
                        setNoteContent(content);
                        setShowNoteEditor(true);
                      }
                    }}
                  >
                    <div className={`w-8 flex items-center justify-center transition-opacity ${selectedFiles.has(file.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <JellyCheckbox 
                        id={`search-file-${file.id}`}
                        checked={selectedFiles.has(file.id)}
                        onChange={() => toggleFileSelection(file.id)}
                      />
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      {getFileIcon(file)}
                      <span 
                        className="text-gray-200 text-sm truncate"
                        dangerouslySetInnerHTML={{ __html: highlightText(file.name, searchQuery) }}
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-gray-400 text-sm">{formatDate(file.createdAt)}</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-gray-400 text-sm">{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center">
                  <div className="w-full">
                    <div className="bg-neutral-800 border-2 border-dashed border-neutral-700 rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer">
                      {/* Search icon */}
                      <div className="mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                          <circle cx="11" cy="11" r="8"/>
                          <path d="m21 21-4.3-4.3"/>
                        </svg>
                      </div>
                      
                      <p className="text-gray-400 text-sm">No files found</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : isLoadingFiles ? (
            <div className="w-full">
              {/* Table Header */}
              <div className="flex items-center px-4 py-3 border-b border-neutral-700">
                <div className="w-1/3 text-gray-400 text-sm font-medium">Name</div>
                <div className="w-1/3 text-gray-400 text-sm font-medium">Modified</div>
                <div className="w-1/3 text-gray-400 text-sm font-medium">Size</div>
              </div>
              
              {/* Skeleton Loaders */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center px-4 py-4 border-b border-neutral-800">
                  <div className="w-1/3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-neutral-700 rounded animate-pulse"></div>
                    <div className="h-4 bg-neutral-700 rounded w-32 animate-pulse"></div>
                  </div>
                  <div className="w-1/3">
                    <div className="h-3 bg-neutral-700 rounded-full w-24 animate-pulse"></div>
                  </div>
                  <div className="w-1/3">
                    <div className="h-3 bg-neutral-700 rounded-full w-16 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filterType !== 'all' && getFilteredFiles().length === 0 ? (
            <div className="flex items-center justify-center">
              <div className="w-full">
                <div className="bg-neutral-800 border-2 border-dashed border-neutral-700 rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer">
                  {/* Search icon */}
                  <div className="mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.3-4.3"/>
                    </svg>
                  </div>
                  
                  <p className="text-gray-400 text-sm">No files found</p>
                </div>
              </div>
            </div>
          ) : uploadedFiles.length > 0 ? (
            <div className="w-full">
              {/* Table Header */}
              <div className="flex items-center px-4 py-3 border-b border-neutral-700 group">
                <div className={`w-8 flex items-center justify-center transition-opacity ${selectedFiles.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <JellyCheckbox 
                    id="select-all"
                    checked={getFilteredFiles().length > 0 && selectedFiles.size === getFilteredFiles().length}
                    indeterminate={selectedFiles.size > 0 && selectedFiles.size < getFilteredFiles().length}
                    onChange={toggleAllFiles}
                  />
                </div>
                <button 
                  onClick={() => handleSort('name')}
                  className="flex-1 text-gray-400 text-sm font-medium flex items-center gap-1 hover:text-white transition-colors"
                >
                  Name
                  {sortColumn === 'name' && (
                    <span className="text-gray-400">
                      {sortDirection.name === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => handleSort('modified')}
                  className="flex-1 text-gray-400 text-sm font-medium flex items-center gap-1 hover:text-white transition-colors"
                >
                  Modified
                  {sortColumn === 'modified' && (
                    <span className="text-gray-400">
                      {sortDirection.modified === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => handleSort('size')}
                  className="flex-1 text-gray-400 text-sm font-medium flex items-center gap-1 hover:text-white transition-colors"
                >
                  Size
                  {sortColumn === 'size' && (
                    <span className="text-gray-400">
                      {sortDirection.size === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </div>
              
              {/* Uploaded Files */}
              {getFilteredFiles().map((file) => (
                <div 
                  key={file.id} 
                  className="flex items-center px-4 py-4 border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors group cursor-pointer"
                  onClick={() => {
                    if (!isImageFile(file.type)) {
                      setCurrentNoteFile(file);
                      // Safety check for Buffer JSON or Hex strings
                      let content = file.fileData || '';
                      if (typeof content === 'string') {
                        if (content.startsWith('{"type":"Buffer"')) {
                          try {
                            const parsed = JSON.parse(content);
                            content = String.fromCharCode.apply(null, parsed.data);
                          } catch (e) {}
                        } else if (content.startsWith('\\x')) {
                          try {
                            const hex = content.replace(/^\\x/, '');
                            content = hex.match(/.{1,2}/g)?.map(byte => String.fromCharCode(parseInt(byte, 16))).join('') || '';
                          } catch (e) {}
                        }
                      }
                      setNoteContent(content);
                      setShowNoteEditor(true);
                    }
                  }}
                >
                  <div className={`w-8 flex items-center justify-center transition-opacity ${selectedFiles.has(file.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <JellyCheckbox 
                      id={`file-${file.id}`}
                      checked={selectedFiles.has(file.id)}
                      onChange={() => toggleFileSelection(file.id)}
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    {getFileIcon(file)}
                    <span className="text-gray-200 text-sm truncate">{file.name}</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-gray-400 text-sm">{formatDate(file.createdAt)}</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-gray-400 text-sm">{formatFileSize(file.size)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : isUploading ? (
            <div className="w-full">
              {/* Table Header */}
              <div className="flex items-center px-4 py-3 border-b border-neutral-700">
                <div className="w-1/3 text-gray-400 text-sm font-medium">Name</div>
                <div className="w-1/3 text-gray-400 text-sm font-medium">Modified</div>
                <div className="w-1/3 text-gray-400 text-sm font-medium">Size</div>
              </div>
              
              {/* Upload Progress Skeleton Loader */}
              <div className="flex items-center px-4 py-4 border-b border-neutral-800">
                <div className="w-1/3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-neutral-700 rounded animate-pulse"></div>
                  <div className="h-4 bg-neutral-700 rounded w-48 animate-pulse"></div>
                </div>
                <div className="w-1/3">
                  <div className="h-2 bg-neutral-700 rounded-full w-32 animate-pulse"></div>
                </div>
                <div className="w-1/3">
                  <div className="h-2 bg-neutral-700 rounded-full w-20 animate-pulse"></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <div className="w-full">
                <div className="bg-neutral-800 border-2 border-dashed border-neutral-700 rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer">
                  {/* Upload icon */}
                  <div className="mb-6">
                    <Image src="/upload_24dp_EFEFEF_FILL0_wght400_GRAD0_opsz24.svg" alt="Upload" width={48} height={48} />
                  </div>
                  
                  {/* Upload files button */}
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button 
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="bg-black text-white font-medium px-6 py-3 rounded-full text-sm hover:bg-neutral-900 hover:border hover:border-white transition-colors"
                  >
                    Upload files
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </div>

      <LibraryPopup isOpen={showPopup} onClose={handlePopupClose} />

      {/* Delete Confirmation Popup */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-900 rounded-2xl p-6 w-96">
            <h2 className="text-white text-lg font-medium mb-4">Delete file{selectedFiles.size > 1 ? 's' : ''}?</h2>
            <p className="text-gray-300 text-sm mb-2">This will delete {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''}.</p>
            <p className="text-gray-500 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="bg-black text-white font-medium px-4 py-2 rounded-full text-sm hover:bg-neutral-800 transition-colors"
              >
                Back
              </button>
              <button 
                onClick={handleDelete}
                className="bg-red-500 text-white font-medium px-4 py-2 rounded-full text-sm hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Creation Popup */}
      {showNotePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-900 rounded-3xl p-6 w-96">
            <h2 className="text-white text-lg font-medium mb-4">New note</h2>
            <input
              ref={noteInputRef}
              type="text"
              value={noteName}
              onChange={(e) => setNoteName(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-full px-4 py-3 text-white text-sm focus:outline-none focus:border-neutral-500 mb-6"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowNotePopup(false)}
                className="bg-black text-white font-medium px-4 py-2 rounded-full text-sm hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateNote}
                className="bg-white text-black font-medium px-4 py-2 rounded-full text-sm hover:bg-gray-200 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="flex h-screen bg-black"></div>}>
      <LibraryContent />
    </Suspense>
  );
}