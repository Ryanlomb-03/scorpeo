"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

const documentFormats = [
  "txt", "log", "text", "csv", "tsv", "doc", "docx", "rtf", "odt", "wpd", "pages", "abw",
  "pdf", "xps", "epub", "mobi", "azw", "djvu", "html", "xhtml", "xml", "md", "tex", "adoc", "rst",
  "xls", "xlsx", "ods", "ppt", "pptx", "odp", "key", "json", "yaml", "yml", "toml", "ini",
  "azw3", "fb2", "zip", "rar", "7z", "tar", "gz", "odg", "vsdx", "pub"
];

const vectorFormats = [
  "svg", "svgz", "eps", "ai", "pdf", "cdr", "wmf", "emf", "dxf", "cgm", "odg", "vsdx"
];

const imageFormats = [
  "ico", "icns", "png", "jpg", "jpeg", "webp", "bmp", "cur", "ani", "gif", "apng", "tif", "tiff", "heif", "heic", "avif", "jxl", "psd", "xcf"
];

export default function ChatInput({ 
  onSend, 
  onLoginClick, 
  isAIThinking,
  position = "bottom"
}: { 
  onSend?: (message: string) => void; 
  onLoginClick?: () => void; 
  isAIThinking?: boolean;
  position?: "bottom" | "center";
}) {
  const [input, setInput] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const [isWebSearch, setIsWebSearch] = useState(false);
  const [isScrolledTop, setIsScrolledTop] = useState(false);
  const [isScrolledBottom, setIsScrolledBottom] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    id: string;
    file: File;
    isLoading: boolean;
    lines: number;
    extension: string;
    isDoc: boolean;
    isVector: boolean;
    content?: string;
  }>>([]);
  const [previewFile, setPreviewFile] = useState<{
    id: string;
    file: File;
    isLoading: boolean;
    lines: number;
    extension: string;
    isDoc: boolean;
    isVector: boolean;
    content?: string;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutsideTools = (event: MouseEvent) => {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target as Node)) {
        setShowToolsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideTools);
    return () => document.removeEventListener("mousedown", handleClickOutsideTools);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      if (onSend) {
        onSend(input);
      }
      setInput("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const newAttachedFiles = filesArray.map(file => {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        const isVector = vectorFormats.includes(extension);
        const isDoc = documentFormats.includes(extension) || isVector;
        
        return {
          id: Math.random().toString(36).substring(7),
          file,
          isLoading: true,
          lines: 0,
          extension: extension.toUpperCase(),
          isDoc,
          isVector
        };
      });

      setAttachedFiles(prev => [...prev, ...newAttachedFiles]);
      setShowPopup(false);

      // Simulate loading and count lines
      newAttachedFiles.forEach(fileObj => {
        if (fileObj.isVector) {
          setTimeout(() => {
            setAttachedFiles(prev => prev.map(f => 
              f.id === fileObj.id ? { ...f, isLoading: false } : f
            ));
          }, 1500);
        } else if (fileObj.isDoc) {
          let lines = 1;
          if (fileObj.file.size > 5 * 1024 * 1024) {
            // Estimate for large files (assume ~50 chars per line)
            lines = Math.max(1, Math.floor(fileObj.file.size / 50));
            setTimeout(() => {
              setAttachedFiles(prev => prev.map(f => 
                f.id === fileObj.id ? { ...f, isLoading: false, lines, content: "File is too large to preview." } : f
              ));
            }, 1500);
          } else {
            const reader = new FileReader();
            reader.onload = (event) => {
              const text = event.target?.result as string;
              lines = text ? text.split('\n').length : 1;
              
              setTimeout(() => {
                setAttachedFiles(prev => prev.map(f => 
                  f.id === fileObj.id ? { ...f, isLoading: false, lines, content: text } : f
                ));
              }, 1500); // 1.5s loading skeleton
            };
            reader.readAsText(fileObj.file);
          }
        } else {
            setTimeout(() => {
              setAttachedFiles(prev => prev.map(f => 
                f.id === fileObj.id ? { ...f, isLoading: false } : f
              ));
            }, 1000);
        }
      });
      
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="px-2 sm:px-4 py-2 relative w-full">
      {/* AI Thinking Dots — floats above the input pill */}
      <AnimatePresence>
        {isAIThinking && (
          <motion.div
            key="thinking-dots"
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.85 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-30 pointer-events-none"
          >
            <div
              style={{
                background: "rgba(24, 24, 26, 0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
                width: "42px",
                height: "28px",
                borderRadius: "14px",
              }}
              className="flex items-center justify-center gap-[4px]"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="block w-[4px] h-[4px] rounded-full"
                  style={{ background: "rgba(215, 215, 220, 0.8)" }}
                  animate={{ y: [0, -3, 0] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.form 
        layout
        onSubmit={handleSubmit} 
        className="max-w-3xl mx-auto w-full"
      >
        <motion.div layout className="bg-neutral-800/80 backdrop-blur-sm rounded-3xl px-3 sm:px-4 py-2 sm:py-3 border border-neutral-700/50 shadow-lg">
          
          {/* File Previews */}
          {attachedFiles.length > 0 && (
            <motion.div layout className="flex flex-wrap gap-3 mb-3">
              {attachedFiles.map((file) => (
                <div key={file.id} className="relative group">
                  {file.isDoc ? (
                    <button 
                      type="button"
                      onClick={() => !file.isLoading && setPreviewFile(file)}
                      className="w-28 h-28 bg-[#1a1a1a] rounded-xl border border-neutral-700/50 p-3 flex flex-col relative shadow-sm overflow-visible text-left hover:bg-[#252525] transition-colors focus:outline-none"
                    >
                      {file.isLoading ? (
                        <>
                          <div className="w-full h-3 bg-neutral-700 rounded-full mb-2 animate-pulse" />
                          <div className="w-2/3 h-3 bg-neutral-700 rounded-full animate-pulse" />
                          <div className="absolute bottom-3 left-3 w-8 h-5 bg-neutral-700 rounded animate-pulse" />
                        </>
                      ) : (
                        <>
                          <div className="text-gray-200 text-[11px] font-medium leading-tight line-clamp-3 break-all">{file.file.name}</div>
                          {!file.isVector && (
                            <div className="text-gray-500 text-[10px] mt-1">{file.lines === 1 ? '1 line' : `${file.lines} lines`}</div>
                          )}
                          <div className="absolute bottom-3 left-3 px-1.5 py-0.5 border border-neutral-600 rounded text-[10px] font-bold text-gray-300 bg-neutral-800 shadow-sm uppercase">
                            {file.extension}
                          </div>
                        </>
                      )}
                      
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        className="absolute -top-2 -left-2 w-6 h-6 bg-neutral-600 border-2 border-[#1a1a1a] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-neutral-500 z-10"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </div>
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => !file.isLoading && setPreviewFile(file)}
                      className="w-28 h-28 bg-[#1a1a1a] rounded-xl border border-neutral-700/50 flex items-center justify-center relative overflow-visible focus:outline-none"
                    >
                       {file.isLoading ? (
                         <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                       ) : file.file.type.startsWith('image/') || imageFormats.includes(file.extension.toLowerCase()) ? (
                         <img src={URL.createObjectURL(file.file)} alt={file.file.name} className="w-full h-full object-cover rounded-xl" />
                       ) : (
                         <div className="text-white text-xs p-2 text-center break-all">{file.file.name}</div>
                       )}
                       <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        className="absolute -top-2 -left-2 w-6 h-6 bg-neutral-600 border-2 border-[#1a1a1a] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-neutral-500 z-10"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          <motion.div layout className="flex flex-wrap items-end gap-x-3 gap-y-2 relative">
            
            {/* The + Button */}
            <motion.div layout className={`flex items-center gap-2 relative group ${isWebSearch ? 'order-2' : 'order-1'}`} ref={dropdownRef}>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-700 text-gray-400 hover:text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowPopup(!showPopup); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>

              {/* Tooltip */}
              {!showPopup && (
                <div className="absolute top-full mt-4 -left-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center gap-2 bg-neutral-800 text-white text-sm px-3 py-1.5 rounded-xl shadow-lg border border-neutral-700 whitespace-nowrap z-50">
                  <span className="font-medium">Add files and more</span>
                  <span className="bg-neutral-600/50 text-gray-300 text-[11px] px-1.5 py-0.5 rounded font-semibold leading-none">/</span>
                </div>
              )}
              
              {showPopup && (
                <motion.div 
                  initial={{ opacity: 0, y: position === 'bottom' ? 10 : -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: position === 'bottom' ? 10 : -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute ${position === 'bottom' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 bg-[#2f2f2f] rounded-2xl shadow-xl border border-neutral-700/50 p-2 w-[220px] z-50`} 
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-200 hover:bg-[#3f3f3f] transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      Add photos & files
                    </button>
                    
                    <button disabled className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-200 hover:bg-[#3f3f3f] transition-colors cursor-not-allowed">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      Create image
                    </button>
                    
                    <button disabled className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-200 hover:bg-[#3f3f3f] transition-colors cursor-not-allowed">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.45.62 2.84 1.5 3.5.76.76 1.23 1.52 1.41 2.5"/></svg>
                      Thinking
                    </button>
                    
                    <button disabled className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-200 hover:bg-[#3f3f3f] transition-colors cursor-not-allowed">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/><path d="m13.56 11.747 4.332-.924"/><path d="m16 21-3.105-6.21"/><path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z"/><path d="m6.158 8.633 1.114 4.456"/><path d="m8 21 3.105-6.21"/><circle cx="12" cy="13" r="2"/></svg>
                      Deep research
                    </button>
                    
                    <button 
                      onClick={() => { 
                        setIsWebSearch(true); 
                        setShowPopup(false); 
                        textareaRef.current?.focus();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-200 hover:bg-[#3f3f3f] transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                      Web search
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>

            <AnimatePresence>
              {isWebSearch && (
                <motion.button 
                  layout
                  initial={{ opacity: 0, scale: 0.8, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: -10 }}
                  transition={{ duration: 0.2 }}
                  type="button"
                  onClick={() => setIsWebSearch(false)}
                  className="order-2 group/tag flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 transition-colors mr-auto"
                >
                  <div className="relative w-4 h-4 flex items-center justify-center">
                    <svg className="w-4 h-4 absolute inset-0 transition-opacity group-hover/tag:opacity-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                    <svg className="w-4 h-4 absolute inset-0 transition-opacity opacity-0 group-hover/tag:opacity-100" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </div>
                  <span className="text-sm font-medium">Search</span>
                </motion.button>
              )}
            </AnimatePresence>
            
            <motion.div layout className={`flex flex-col ${isWebSearch ? 'order-1 w-full flex-none' : 'order-2 flex-1'}`}>
              <textarea
                ref={textareaRef}
                className="w-full bg-transparent outline-none text-white placeholder-gray-500 text-base resize-none overflow-visible leading-6 scrollbar-thin scrollbar-thumb-neutral-600 min-h-[32px] py-1"
                style={{
                  maskImage: isScrolledTop && isScrolledBottom 
                    ? 'linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)'
                    : isScrolledTop
                    ? 'linear-gradient(to bottom, transparent 0, black 16px)'
                    : isScrolledBottom
                    ? 'linear-gradient(to bottom, black 0, black calc(100% - 16px), transparent 100%)'
                    : 'none',
                  WebkitMaskImage: isScrolledTop && isScrolledBottom 
                    ? 'linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)'
                    : isScrolledTop
                    ? 'linear-gradient(to bottom, transparent 0, black 16px)'
                    : isScrolledBottom
                    ? 'linear-gradient(to bottom, black 0, black calc(100% - 16px), transparent 100%)'
                    : 'none',
                }}
                placeholder={isWebSearch ? "Search the web" : "Ask anything"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={1}
                onScroll={(e) => {
                  const target = e.currentTarget;
                  setIsScrolledTop(target.scrollTop > 0);
                  setIsScrolledBottom(Math.ceil(target.scrollTop + target.clientHeight) < target.scrollHeight - 1);
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                  setIsScrolledTop(target.scrollTop > 0);
                  setIsScrolledBottom(Math.ceil(target.scrollTop + target.clientHeight) < target.scrollHeight - 1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
            </motion.div>
            
            <motion.div layout className={`flex items-center gap-2 ${isWebSearch ? 'order-3' : 'order-3'}`}>
              <div className="flex items-center gap-2 relative" ref={toolsDropdownRef}>
                <button
                  type="button"
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white transition-colors ${showToolsDropdown ? 'bg-neutral-700 text-white' : 'hover:bg-neutral-700'}`}
                  onClick={(e) => { e.stopPropagation(); setShowToolsDropdown(!showToolsDropdown); }}
                >
                  <Image src="/brush.svg" alt="Tools" width={18} height={18} style={{ filter: 'brightness(0) invert(1)' }} />
                </button>
                {showToolsDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: position === 'bottom' ? 10 : -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: position === 'bottom' ? 10 : -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute ${position === 'bottom' ? 'bottom-full mb-2' : 'top-10'} right-0 bg-neutral-800 rounded-2xl shadow-xl border border-neutral-700 p-3 w-64 z-50`} 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-2">
                      <button 
                        type="button"
                        onClick={() => { setShowToolsDropdown(false); fileInputRef.current?.click(); }}
                        className="w-full flex items-center gap-3 p-2 rounded-lg text-sm text-gray-200 hover:bg-[#3f3f3f] transition-colors"
                      >
                        <Image src="/add_photo.svg" alt="Add photos" width={16} height={16} style={{ filter: 'brightness(0) invert(0.6)' }} />
                        Add photos & files
                      </button>
                      <button disabled className="w-full flex items-center gap-3 p-2 rounded-lg text-sm text-gray-500 transition-colors cursor-not-allowed">
                        <Image src="/google_search.svg" alt="Web search" width={16} height={16} style={{ filter: 'brightness(0) invert(0.6)' }} />
                        Web search
                      </button>
                      <button disabled className="w-full flex items-center gap-3 p-2 rounded-lg text-sm text-gray-500 transition-colors cursor-not-allowed">
                        <Image src="/google_research.svg" alt="Deep research" width={16} height={16} style={{ filter: 'brightness(0) invert(0.6)' }} />
                        Deep research
                      </button>
                      <button disabled className="w-full flex items-center gap-3 p-2 rounded-lg text-sm text-gray-500 transition-colors cursor-not-allowed">
                        <Image src="/google_image.svg" alt="Create image" width={16} height={16} style={{ filter: 'brightness(0) invert(0.6)' }} />
                        Create image
                      </button>
                      <button disabled className="w-full flex items-center gap-3 p-2 rounded-lg text-sm text-gray-500 transition-colors cursor-not-allowed">
                        <Image src="/google_think.svg" alt="Think longer" width={16} height={16} style={{ filter: 'brightness(0) invert(0.6)' }} />
                        Think longer
                      </button>
                      <div className="border-t border-neutral-700 pt-2 mt-2">
                        <button 
                          onClick={() => { setShowToolsDropdown(false); onLoginClick?.(); }}
                          className="w-full bg-white text-black p-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Sign in
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
              
              {input.trim() ? (
                <button 
                  type="submit"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:bg-gray-200 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                  </svg>
                </button>
              ) : (
                <button type="button" className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-neutral-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple
          onChange={handleFileChange}
        />
      </motion.form>

      <AnimatePresence>
        {previewFile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewFile(null)}
          >
            {previewFile.isDoc || previewFile.isVector ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#1a1a1a] border border-neutral-800 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
              >
                <div className="flex items-start justify-between p-6 pb-4 border-b border-neutral-800">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1">{previewFile.file.name}</h3>
                    {!previewFile.isVector && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{(previewFile.file.size / 1024).toFixed(2)} KB</span>
                        <span>•</span>
                        <span>{previewFile.lines === 1 ? '1 line' : `${previewFile.lines} lines`}</span>
                        <span>•</span>
                        <span>Formatting may be inconsistent from source</span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setPreviewFile(null)}
                    className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-neutral-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="p-6 overflow-y-auto bg-[#1a1a1a] scrollbar-thin scrollbar-thumb-neutral-700">
                  {previewFile.isVector ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-gray-300 mb-6">Preview isn't available for {previewFile.file.name} ({(previewFile.file.size / 1024).toFixed(2)} KB).</p>
                      <button
                        onClick={() => {
                          const url = URL.createObjectURL(previewFile.file);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = previewFile.file.name;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-neutral-700 hover:bg-neutral-800 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#252525] border border-neutral-800 rounded-2xl p-4 md:p-6">
                      <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                        {previewFile.content || "Content not available for preview."}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="relative flex flex-col items-center justify-center w-full max-w-5xl h-full max-h-[90vh]"
              >
                <button 
                  onClick={() => setPreviewFile(null)}
                  className="absolute top-0 right-0 md:-right-12 md:top-0 text-gray-400 hover:text-white p-2 transition-colors z-50 bg-black/20 md:bg-transparent rounded-full"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
                <div className="bg-[#111] p-2 rounded-2xl shadow-2xl flex flex-col max-w-full max-h-[85vh] relative overflow-hidden">
                  <div className="flex-1 overflow-auto flex items-center justify-center">
                    <img 
                      src={URL.createObjectURL(previewFile.file)} 
                      alt={previewFile.file.name} 
                      className="max-w-full max-h-full object-contain rounded-lg" 
                    />
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                    <div className="bg-neutral-800/40 backdrop-blur-md text-gray-200 text-sm px-4 py-2 rounded-full shadow-lg pointer-events-auto border border-white/5">
                      {previewFile.file.name}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
