"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { createClient } from "@supabase/supabase-js";

const firebaseConfig = {
  apiKey: "AIzaSyAyoBS2qSBYCQCzfJcoKig44H-gD2lpjqc",
  authDomain: "koda-021.firebaseapp.com",
  projectId: "koda-021",
  storageBucket: "koda-021.firebasestorage.app",
  messagingSenderId: "430672411340",
  appId: "1:430672411340:web:69a7a82ddbe926a71c6069",
  measurementId: "G-MY056KJXWS"
};

const supabaseUrl = "https://igofnasquyrrkrwvtqsq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnb2ZuYXNxdXlycmtyd3Z0cXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjAwNjQsImV4cCI6MjA5NTczNjA2NH0.bHAyDFqbD087z2fq4SfkLBCKOxRGwjGfOKaV-CCDY1w";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const supabase = createClient(supabaseUrl, supabaseKey);

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  pendingGoogleUser: User | null;
  signInWithGoogle: () => Promise<void>;
  completeSetup: (username: string) => Promise<void>;
  signOut: () => Promise<void>;
  authLoading: boolean;
  showLogin: boolean;
  setShowLogin: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const avatarColors = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
];

const getRandomColor = () => avatarColors[Math.floor(Math.random() * avatarColors.length)];

const generateAvatar = (name: string) => {
  const initial = name.charAt(0).toUpperCase();
  const color = getRandomColor();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" fill="${color}" rx="40"/>
    <text x="40" y="52" font-family="Arial" font-size="36" font-weight="bold" fill="white" text-anchor="middle">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const email = firebaseUser.email;
        if (!email) {
          setUser(null);
          setLoading(false);
          return;
        }

        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .single();

        if (user) {
          setUser({
            uid: user.id,
            displayName: user.username,
            photoURL: generateAvatar(user.username)
          });
        } else {
          setUser(null);
          setPendingGoogleUser(firebaseUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setPendingGoogleUser(result.user);
    } catch (error) {
      console.error("Google sign in error:", error);
      throw error;
    }
  };

  const completeSetup = async (username: string) => {
    if (pendingGoogleUser) {
      const email = pendingGoogleUser.email;
      if (!email) {
        throw new Error("Email not available");
      }

      // Check if username is taken
      const { data: existing } = await supabase
        .from("users")
        .select("username")
        .ilike("username", username)
        .single();

      if (existing) {
        throw new Error("Username already taken");
      }

      // Save user to database via API
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      const photoURL = generateAvatar(username);

      setUser({
        uid: data.user.id,
        displayName: username,
        photoURL
      });
      setPendingGoogleUser(null);
    }
  };

  const signOut = async () => {
    try {
      const { signOut: firebaseSignOut } = await import("firebase/auth");
      await firebaseSignOut(auth);
      setUser(null);
      setPendingGoogleUser(null);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const [showLogin, setShowLogin] = useState(false);

  return (
    <AuthContext.Provider value={{ user, loading, pendingGoogleUser, signInWithGoogle, completeSetup, signOut, authLoading: loading, showLogin, setShowLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
