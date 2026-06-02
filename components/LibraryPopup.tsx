"use client";

import { motion, AnimatePresence } from "framer-motion";

interface LibraryPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LibraryPopup({ isOpen, onClose }: LibraryPopupProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-[#12161a] rounded-2xl p-8 w-full max-w-md border border-neutral-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div></div>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-blue-500/20 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="relative w-[140px] h-[180px]">
                {/* Back Left Card */}
                <div className="absolute w-full h-full rounded-[40px] bg-[#242424] shadow-2xl p-[15px] z-10" style={{ transform: 'rotate(-8deg) translate(-15px, -10px)' }}>
                  <div className="w-10 h-10 rounded-2xl bg-[#e5a900] flex items-center justify-center mb-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#242424]">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </div>
                </div>

                {/* Back Right Card */}
                <div className="absolute w-full h-full rounded-[40px] bg-[#1e1e1e] shadow-2xl z-20" style={{ transform: 'rotate(6deg) translate(18px, -8px)' }}></div>

                {/* Front Card */}
                <div className="absolute w-full h-full rounded-[40px] bg-[#262626] border border-white/5 shadow-2xl shadow-blue-500/20 p-[15px] z-30 flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-[#0084ff] flex items-center justify-center mb-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  </div>
                  
                  <div className="w-1/2 h-4 bg-[#333333] rounded-xl"></div>
                  <div className="w-2/5 h-3 bg-[#333333] rounded-xl mb-2"></div>
                  
                  <div className="flex flex-col gap-1.5">
                    <div className="w-full h-[10px] bg-[#333333] rounded-xl"></div>
                    <div className="w-full h-[10px] bg-[#333333] rounded-xl"></div>
                    <div className="w-full h-[10px] bg-[#333333] rounded-xl"></div>
                  </div>
                  
                  <div className="w-[70%] h-[10px] bg-[#333333] rounded-xl mt-1"></div>
                </div>
              </div>
            </div>
            
            <h2 className="text-white text-xl font-semibold mb-2 text-center">Your files are ready</h2>
            <p className="text-gray-300 text-sm mb-6 leading-relaxed text-center">
              All your uploaded documents, notes, and sheets live here — ready to reference in any chat, anytime.
            </p>
            
            <div className="flex justify-center">
              <button 
                onClick={onClose}
                className="bg-white text-black font-medium px-6 py-2 rounded-full hover:bg-gray-200 transition-colors text-sm"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
