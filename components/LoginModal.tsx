"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const recommendedNames = [
  "CosmicExplorer", "StarGazer", "NebulaDreamer", "QuantumMind", "CosmosSeeker",
  "AstroKnight", "VoidWalker", "GalaxyPilot", "StellarSage", "OrbitRider",
  "NovaChaser", "PulsarPulse", "CometCrafter", "MeteorMaven", "EclipseEarner"
];

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { signInWithGoogle, completeSetup, pendingGoogleUser } = useAuth();

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setIsLoading(true);
    setError("");
    try {
      await completeSetup(username.trim());
      setUsername("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Username already taken");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecommendedClick = (name: string) => {
    setUsername(name);
  };

  // Show username setup if Google sign in is complete
  if (pendingGoogleUser) {
    return (
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-neutral-800 rounded-2xl p-6 w-full max-w-sm border border-neutral-700"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 relative">
                    <Image src="/logo.png" alt="Scorpio Logo" fill className="object-contain" />
                  </div>
                  <h2 className="text-xl font-semibold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Scorpio</h2>
                </div>
              </motion.div>
              <motion.p 
                className="text-gray-400 text-sm mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
              >What should Scorpio call you?</motion.p>
              
              <form onSubmit={handleCompleteSetup}>
                <motion.input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  placeholder="Enter your name"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-neutral-500 mb-3"
                  autoFocus
                  maxLength={20}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                />
                
                {error && (
                  <motion.p 
                    className="text-red-400 text-sm mb-3"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >{error}</motion.p>
                )}
                
                <motion.button
                  type="submit"
                  disabled={!username.trim() || isLoading}
                  className="w-full bg-white text-black font-medium py-3 rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? "Setting up..." : "Continue"}
                </motion.button>
              </form>

              <motion.div 
                className="mt-4 pt-4 border-t border-neutral-700"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-xs text-gray-500 mb-2">Recommended</p>
                <div className="flex flex-wrap gap-2">
                  {recommendedNames.slice(0, 6).map((name, i) => (
                    <motion.button
                      key={name}
                      onClick={() => handleRecommendedClick(name)}
                      className="text-xs px-3 py-1.5 rounded-full bg-neutral-700 text-gray-300 hover:bg-neutral-600 hover:text-white transition-colors"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.35 + i * 0.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {name}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  // Initial login screen with Google sign in
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-neutral-800 rounded-2xl p-6 w-full max-w-sm border border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 relative">
                  <Image src="/logo.png" alt="Scorpio Logo" fill className="object-contain" />
                </div>
                <h2 className="text-xl font-semibold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Scorpio</h2>
              </div>
            </motion.div>
            <motion.p 
              className="text-gray-400 text-sm mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >Sign in to continue</motion.p>
            
            <motion.button 
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-white text-black font-medium py-3 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {isLoading ? "Signing in..." : "Continue with Google"}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
